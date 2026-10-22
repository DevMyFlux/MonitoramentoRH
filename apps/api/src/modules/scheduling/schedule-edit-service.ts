/**
 * Edição de uma escala já gerada.
 *
 *  - Rascunho ou reprovada: edita na PRÓPRIA versão (revisão +1, hash do conteúdo atualizado).
 *  - Em análise, aprovada ou publicada: nasce uma NOVA versão em rascunho, derivada da original. A aprovação anterior
 *    deixa de valer (ela estava atrelada ao conteúdo antigo): a versão em análise/aprovada é marcada como substituída;
 *    a publicada continua no ar até a nova ser publicada. Nada é apagado — a rastreabilidade é toda mantida.
 *
 * Toda edição é validada (rodízio, admissão/desligamento, afastamentos, aptidão, descanso) antes de gravar, roda numa
 * transação com concorrência otimista e deixa antes/depois, quem, quando e a justificativa no histórico e na auditoria.
 */
import { groupPendencies, type IssueGroup } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { json } from "../identity/access.js";
import { contentHashOf } from "./schedule-content.js";
import { loadScheduleContext, ruleCodeFor, prepareEmployee } from "./schedule-context.js";
import {
  applyChanges,
  blockingEditIssues,
  gridRows,
  recomputeResult,
  validateChanges,
  type EditChange,
  type EditIssue
} from "./schedule-validation.js";
import { isEditableInPlace } from "./schedule-workflow.js";
import type {
  EmployeeScheduleMetrics,
  EmployeeSchedulePendency
} from "./employee-schedule-service.js";
import type { ScheduleGridData } from "./xlsx-renderer.js";

export type EditInput = {
  expectedRevision: number;
  changes: EditChange[];
  justification?: string | null | undefined;
  dryRun?: boolean | undefined;
};

type StoredResult = {
  grid?: ScheduleGridData;
  pendencies?: EmployeeSchedulePendency[];
  metrics?: EmployeeScheduleMetrics;
};

export type EditOutcome = {
  changed: boolean;
  dryRun: boolean;
  /** Foi criada uma nova versão em rascunho (a original estava em análise, aprovada ou publicada). */
  derived: boolean;
  /** Versão que contém a edição (a mesma, ou a nova). */
  versionId: string;
  previousVersionId: string | null;
  revision: number;
  /** Avisos e informações (os impeditivos fazem a edição ser recusada), já em linguagem simples e agrupados. */
  issues: IssueGroup[];
  /** Para cada célula pedida: o que está na grade e o que a regra (rodízio/disponibilidade) colocaria ali. */
  cells: Array<{ employeeId: string; date: string; current: string; rule: string }>;
  metrics: EmployeeScheduleMetrics;
};

const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

const friendly = (issues: EditIssue[]): IssueGroup[] => groupPendencies(issues);

export async function editScheduleCells(
  db: PrismaClient,
  user: AuthenticatedUser,
  id: string,
  input: EditInput
): Promise<EditOutcome> {
  const version = await db.scheduleVersion.findUnique({ where: { id } });
  if (!version || version.archivedAt) {
    throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versao de escala nao encontrada.");
  }
  if (version.supersededAt) {
    throw new HttpError(
      409,
      "SCHEDULE_SUPERSEDED",
      "Esta versão foi substituída por uma mais recente e não pode mais ser editada."
    );
  }
  if (version.revision !== input.expectedRevision) {
    throw new HttpError(
      409,
      "SCHEDULE_REVISION_CONFLICT",
      "Esta escala foi alterada por outra pessoa depois que você a abriu."
    );
  }
  const stored = version.generatedResult as StoredResult | null;
  if (!stored?.grid)
    throw new HttpError(409, "SCHEDULE_NOT_EDITABLE", "Versão gerada por um fluxo anterior.");

  const month = version.month.toISOString().slice(0, 7);
  const ctx = await loadScheduleContext(db, user, version.operationId, month, {
    onlyEmployeeIds: gridRows(stored.grid).map((row) => row.employeeId)
  });

  const current = new Map(
    gridRows(stored.grid).flatMap((row) =>
      row.days.map(
        (code, i) =>
          [cellKey(row.employeeId, `${month}-${String(i + 1).padStart(2, "0")}`), code] as const
      )
    )
  );

  // O que está na grade e o que a regra colocaria em cada célula pedida (só dias válidos do mês). Vai na resposta,
  // inclusive na recusa, para a tela saber se o ajuste foge do rodízio (e então exige justificativa).
  const ruleOf = new Map<string, string>();
  const cells: EditOutcome["cells"] = input.changes.flatMap((c) => {
    const employee = ctx.employees.find((e) => e.id === c.employeeId);
    const day = Number(c.date.slice(8, 10));
    if (!employee || !c.date.startsWith(`${month}-`) || day < 1 || day > ctx.dayCount) return [];
    const rule = ruleCodeFor(prepareEmployee(ctx, employee), c.date);
    ruleOf.set(cellKey(c.employeeId, c.date), rule);
    return [
      {
        employeeId: c.employeeId,
        date: c.date,
        current: current.get(cellKey(c.employeeId, c.date)) ?? "",
        rule
      }
    ];
  });

  // 1) validação — nada é gravado se houver problema impeditivo. Célula que já está com esse código não é edição:
  //    não se revalida (assim reenviar a mesma edição é inofensivo e o diálogo pode consultar o código da regra).
  const edited = input.changes.filter((c) => current.get(cellKey(c.employeeId, c.date)) !== c.code);
  const issues = validateChanges(ctx, stored.grid, edited, {
    justification: input.justification ?? null
  });
  const blocking = blockingEditIssues(issues);
  if (blocking.length) {
    const groups = friendly(blocking);
    throw new HttpError(
      409,
      "SCHEDULE_EDIT_INVALID",
      groups.length === 1
        ? `A alteração não pôde ser aplicada: ${groups[0]!.title}.`
        : `A alteração não pôde ser aplicada: ${groups.length} problemas encontrados.`,
      { issues: groups, cells }
    );
  }

  // 2) efeito líquido: o que já está igual não muda nada
  const effective = edited;
  const warnings = issues.filter((i) => !blocking.includes(i));
  if (!effective.length) {
    return {
      changed: false,
      dryRun: Boolean(input.dryRun),
      derived: false,
      versionId: id,
      previousVersionId: null,
      revision: version.revision,
      issues: friendly(warnings),
      cells,
      metrics: stored.metrics ?? { required: 0, covered: 0, coverage: 0 }
    };
  }

  // 3) ajustes manuais resultantes: um código igual ao da regra volta a seguir a regra (sem ajuste)
  const finalOverrides = new Map<string, { code: string }>(
    ctx.overrides.map((o) => [
      cellKey(o.employeeId, o.date.toISOString().slice(0, 10)),
      { code: o.code }
    ])
  );
  const toArchive: EditChange[] = [];
  const toSet: EditChange[] = [];
  for (const change of effective) {
    const key = cellKey(change.employeeId, change.date);
    if (change.code === ruleOf.get(key)) {
      finalOverrides.delete(key);
      toArchive.push(change);
    } else {
      finalOverrides.set(key, { code: change.code });
      toSet.push(change);
    }
  }
  const newGrid = applyChanges(stored.grid, effective);
  const recomputed = recomputeResult(ctx, newGrid, finalOverrides);
  const newResult = {
    grid: newGrid,
    pendencies: recomputed.pendencies,
    metrics: recomputed.metrics
  };
  const newHash = contentHashOf(json(newResult));
  const names = new Map(ctx.employees.map((e) => [e.id, e.name]));
  const changeLog = effective.map((c) => ({
    employeeId: c.employeeId,
    employeeName: names.get(c.employeeId) ?? null,
    date: c.date,
    from: current.get(cellKey(c.employeeId, c.date)) ?? "",
    to: c.code,
    reason: c.reason?.trim() || null
  }));

  if (input.dryRun) {
    return {
      changed: true,
      dryRun: true,
      derived: !isEditableInPlace(version.status),
      versionId: id,
      previousVersionId: null,
      revision: version.revision,
      issues: friendly(warnings),
      cells,
      metrics: recomputed.metrics
    };
  }

  // 4) gravação, tudo ou nada
  const inPlace = isEditableInPlace(version.status);
  const now = new Date();
  const justification = input.justification?.trim() || null;
  const outcome = await db.$transaction(
    async (tx) => {
      const fresh = await tx.scheduleVersion.findUnique({
        where: { id },
        select: { revision: true, status: true, supersededAt: true, archivedAt: true }
      });
      if (!fresh || fresh.archivedAt)
        throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versao de escala nao encontrada.");
      if (
        fresh.revision !== version.revision ||
        fresh.status !== version.status ||
        fresh.supersededAt
      ) {
        throw new HttpError(
          409,
          "SCHEDULE_REVISION_CONFLICT",
          "Esta escala foi alterada por outra pessoa enquanto você a editava."
        );
      }

      // ajustes manuais do mês (mantidos nas próximas gerações da unidade)
      for (const change of toSet) {
        const date = new Date(`${change.date}T00:00:00Z`);
        const reason = change.reason?.trim() || justification;
        await tx.scheduleDayOverride.upsert({
          where: {
            operationId_employeeId_date: {
              operationId: version.operationId,
              employeeId: change.employeeId,
              date
            }
          },
          update: {
            code: change.code,
            reason,
            status: "ACTIVE",
            updatedBy: user.id,
            archivedAt: null
          },
          create: {
            operationId: version.operationId,
            employeeId: change.employeeId,
            date,
            code: change.code,
            reason,
            createdBy: user.id
          }
        });
      }
      for (const change of toArchive) {
        await tx.scheduleDayOverride.updateMany({
          where: {
            operationId: version.operationId,
            employeeId: change.employeeId,
            date: new Date(`${change.date}T00:00:00Z`),
            status: "ACTIVE"
          },
          data: { status: "ARCHIVED", archivedAt: now, updatedBy: user.id }
        });
      }

      const leanBefore = {
        status: version.status,
        revision: version.revision,
        contentHash: version.contentHash
      } as Prisma.InputJsonObject;
      let targetId = id;
      let revision = version.revision + 1;
      let previousVersionId: string | null = null;

      if (inPlace) {
        const updated = await tx.scheduleVersion.updateMany({
          where: { id, revision: version.revision },
          data: {
            generatedResult: json(newResult),
            contentHash: newHash,
            revision: { increment: 1 },
            updatedBy: user.id
          }
        });
        if (updated.count !== 1)
          throw new HttpError(
            409,
            "SCHEDULE_REVISION_CONFLICT",
            "Esta escala foi alterada por outra pessoa enquanto você a editava."
          );
        await tx.scheduleHistory.create({
          data: {
            scheduleId: id,
            action: "EDIT",
            before: leanBefore,
            after: {
              status: version.status,
              revision,
              contentHash: newHash,
              changes: changeLog,
              warnings: warnings.length
            } as unknown as Prisma.InputJsonObject,
            reason: justification,
            createdBy: user.id
          }
        });
      } else {
        // Em análise/aprovada/publicada: a original fica intacta; a edição vira uma nova versão em rascunho.
        const last = await tx.scheduleVersion.findFirst({
          where: { operationId: version.operationId, month: version.month },
          orderBy: { version: "desc" },
          select: { version: true }
        });
        const created = await tx.scheduleVersion.create({
          data: {
            operationId: version.operationId,
            month: version.month,
            version: (last?.version ?? version.version) + 1,
            status: "DRAFT",
            generatedInput: json({ engine: "employee-schedule", derivedFrom: id, month }),
            generatedResult: json(newResult),
            contentHash: newHash,
            basedOnVersionId: id,
            createdBy: user.id,
            history: {
              create: {
                action: "EDIT",
                before: {
                  fromVersion: version.version,
                  fromStatus: version.status
                } as Prisma.InputJsonObject,
                after: {
                  status: "DRAFT",
                  revision: 1,
                  contentHash: newHash,
                  changes: changeLog,
                  warnings: warnings.length
                } as unknown as Prisma.InputJsonObject,
                reason:
                  justification ??
                  `Editada a partir da versão ${version.version} (${version.status}).`,
                createdBy: user.id
              }
            }
          }
        });
        targetId = created.id;
        revision = 1;
        previousVersionId = id;
        if (version.status === "IN_REVIEW" || version.status === "APPROVED") {
          // a análise/aprovação era do conteúdo antigo: esta versão não pode mais ser decidida
          const superseded = await tx.scheduleVersion.updateMany({
            where: { id, revision: version.revision },
            data: {
              supersededAt: now,
              supersededById: created.id,
              revision: { increment: 1 },
              updatedBy: user.id
            }
          });
          if (superseded.count !== 1)
            throw new HttpError(
              409,
              "SCHEDULE_REVISION_CONFLICT",
              "Esta escala foi alterada por outra pessoa enquanto você a editava."
            );
          await tx.scheduleHistory.create({
            data: {
              scheduleId: id,
              action: "SUPERSEDED",
              before: leanBefore,
              after: { status: version.status, supersededBy: created.id } as Prisma.InputJsonObject,
              reason: `Editada: a versão ${created.version} (rascunho) substitui esta; a ${version.status === "APPROVED" ? "aprovação" : "análise"} anterior não vale para o conteúdo novo.`,
              createdBy: user.id
            }
          });
        } else {
          await tx.scheduleHistory.create({
            data: {
              scheduleId: id,
              action: "NEW_VERSION_DRAFTED",
              before: leanBefore,
              after: { status: version.status, newVersion: created.id } as Prisma.InputJsonObject,
              reason: `A versão ${created.version} (rascunho) foi criada para revisar esta escala publicada; esta continua no ar até a nova ser publicada.`,
              createdBy: user.id
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: "UPDATE",
          entity: "ScheduleVersion",
          entityId: targetId,
          operationId: version.operationId,
          companyId: ctx.operation.companyId,
          unitId: ctx.operation.unitId,
          before: leanBefore,
          after: {
            status: inPlace ? version.status : "DRAFT",
            revision,
            contentHash: newHash,
            changes: changeLog.length,
            derivedFrom: previousVersionId
          } as Prisma.InputJsonObject,
          justification,
          origin: "api"
        }
      });
      return { targetId, revision, previousVersionId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    changed: true,
    dryRun: false,
    derived: outcome.previousVersionId !== null,
    versionId: outcome.targetId,
    previousVersionId: outcome.previousVersionId,
    revision: outcome.revision,
    issues: friendly(warnings),
    cells,
    metrics: recomputed.metrics
  };
}
