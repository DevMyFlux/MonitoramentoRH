import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type AuditAction, type PrismaClient, type WorkflowStatus } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";
import { generateSchedule, type ScheduleEngineInput } from "./schedule-engine.js";
import { assertSubmittable, contentHashOf } from "./schedule-content.js";
import { canTransitionSchedule } from "./schedule-workflow.js";

type HistoryEntry = {
  scheduleId: string;
  action: string;
  before: Prisma.InputJsonObject;
  after: Prisma.InputJsonObject;
  reason: string | null;
  createdBy: string;
};

type ScheduleVersionInput = {
  operationId: string;
  month: string;
  engineInput: ScheduleEngineInput;
  overrideJustification?: string | null | undefined;
};

export class ScheduleRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(user: AuthenticatedUser) {
    return this.db.scheduleVersion.findMany({
      // archivedAt is how an "Excluir escala" is recorded (see
      // employee-schedule-routes.ts): the row and its history stay for audit,
      // but a deleted schedule must disappear from every listing.
      where: { archivedAt: null, operation: operationScopeWhere(user) },
      include: { assignments: true },
      orderBy: [{ month: "desc" }, { version: "desc" }]
    });
  }

  async preview(user: AuthenticatedUser, operationId: string, input: ScheduleEngineInput) {
    await this.assertOperationScope(user, operationId);

    return generateSchedule(input);
  }

  async createVersion(user: AuthenticatedUser, data: ScheduleVersionInput) {
    await this.assertOperationScope(user, data.operationId);
    const month = new Date(data.month);
    const result = generateSchedule(data.engineInput);
    const last = await this.db.scheduleVersion.findFirst({
      where: { operationId: data.operationId, month },
      orderBy: { version: "desc" },
      select: { version: true }
    });

    const created = await this.db.scheduleVersion.create({
      data: {
        operationId: data.operationId,
        month,
        version: (last?.version ?? 0) + 1,
        generatedInput: toJson(data.engineInput),
        generatedResult: toJson(result),
        overrideJustification: data.overrideJustification ?? null,
        createdBy: user.id,
        assignments: {
          create: result.assignments.map((assignment) => ({
            positionId: assignment.positionId,
            employeeId: assignment.employeeId,
            createdBy: user.id
          }))
        },
        history: {
          create: {
            action: "CREATE",
            after: toJson(result),
            reason: data.overrideJustification ?? null,
            createdBy: user.id
          }
        }
      },
      include: { assignments: true, history: true }
    });

    await this.audit(user, "CREATE", "ScheduleVersion", created.id, null, created);
    return created;
  }

  /**
   * Muda a situação de uma escala. Tudo acontece numa transação e com concorrência otimista (`expectedRevision` é a
   * revisão que o usuário viu): duas pessoas decidindo ao mesmo tempo não se sobrepõem, e ninguém aprova uma versão
   * diferente da que analisou. A aprovação fica atrelada ao hash do conteúdo, e publicar exige que ele não tenha mudado.
   */
  async transition(
    user: AuthenticatedUser,
    id: string,
    status: WorkflowStatus,
    reason?: string | null,
    expectedRevision?: number
  ) {
    const result = await this.db.$transaction(
      async (tx) => {
        const before = await tx.scheduleVersion.findUnique({
          where: { id },
          include: { operation: true }
        });
        if (!before || before.archivedAt) {
          throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versao de escala nao encontrada.");
        }
        assertScoped(user, {
          companyId: before.operation.companyId,
          operationId: before.operationId,
          unitId: before.operation.unitId
        });
        if (!canTransitionSchedule(before.status, status, user.permissions)) {
          throw new HttpError(
            403,
            "SCHEDULE_WORKFLOW_FORBIDDEN",
            "Transicao de escala nao permitida."
          );
        }
        if (before.supersededAt && status !== "ARCHIVED") {
          throw new HttpError(
            409,
            "SCHEDULE_SUPERSEDED",
            "Esta versão foi substituída por uma mais recente e não pode mais ser decidida."
          );
        }
        if (expectedRevision !== undefined && before.revision !== expectedRevision) {
          throw new HttpError(
            409,
            "SCHEDULE_REVISION_CONFLICT",
            "Esta escala foi alterada por outra pessoa depois que você a abriu."
          );
        }

        const now = new Date();
        const hash = contentHashOf(before.generatedResult);
        const data: Prisma.ScheduleVersionUncheckedUpdateManyInput = {
          status,
          updatedBy: user.id,
          revision: { increment: 1 }
        };
        let historyAction: string = status;
        let auditAction: AuditAction = "UPDATE";

        if (status === "IN_REVIEW") {
          assertSubmittable(before.generatedResult);
          historyAction = "SUBMIT";
          data.contentHash = hash;
          data.submittedAt = now;
          data.submittedBy = user.id;
          data.approvedAt = null;
          data.approvedBy = null;
          data.approvedContentHash = null;
          data.rejectedAt = null;
          data.rejectedBy = null;
          data.rejectionReason = null;
        } else if (status === "APPROVED") {
          // legado: versões enviadas antes desta regra não têm hash gravado e seguem como estavam
          if (before.contentHash && before.contentHash !== hash) {
            throw new HttpError(
              409,
              "APPROVAL_STALE",
              "O conteúdo da escala mudou depois do envio; ela precisa ser reenviada."
            );
          }
          historyAction = "APPROVE";
          auditAction = "APPROVE";
          data.approvedAt = now;
          data.approvedBy = user.id;
          data.approvedContentHash = hash;
        } else if (status === "REJECTED") {
          const motivo = (reason ?? "").trim();
          if (motivo.length < 5) {
            throw new HttpError(
              400,
              "REJECTION_REASON_REQUIRED",
              "Informe o motivo da reprovação (mínimo de 5 caracteres)."
            );
          }
          historyAction = "REJECT";
          auditAction = "REJECT";
          data.rejectedAt = now;
          data.rejectedBy = user.id;
          data.rejectionReason = motivo;
          data.approvedAt = null;
          data.approvedBy = null;
          data.approvedContentHash = null;
        } else if (status === "PUBLISHED") {
          if (before.approvedContentHash && before.approvedContentHash !== hash) {
            throw new HttpError(
              409,
              "APPROVAL_STALE",
              "O conteúdo da escala mudou depois da aprovação; uma aprovação antiga não vale para esta versão."
            );
          }
          historyAction = "PUBLISH";
          auditAction = "PUBLISH";
          data.publishedAt = now;
          data.publishedBy = user.id;
        } else if (status === "ARCHIVED") {
          historyAction = "ARCHIVE";
          auditAction = "ARCHIVE";
          data.archivedAt = now;
        }

        // updateMany com a revisão que lemos: se alguém mudou a escala no meio do caminho, nada é gravado.
        const changed = await tx.scheduleVersion.updateMany({
          where: { id, revision: before.revision },
          data
        });
        if (changed.count !== 1) {
          throw new HttpError(
            409,
            "SCHEDULE_REVISION_CONFLICT",
            "Esta escala foi alterada por outra pessoa enquanto você a decidia."
          );
        }

        const history: HistoryEntry[] = [
          {
            scheduleId: id,
            action: historyAction,
            before: { status: before.status, revision: before.revision },
            after: { status, revision: before.revision + 1, contentHash: hash },
            reason: reason?.trim() || null,
            createdBy: user.id
          }
        ];
        if (status === "PUBLISHED") {
          // A nova publicação substitui a anterior da mesma unidade e mês; a antiga continua registrada como publicada.
          const previous = await tx.scheduleVersion.findMany({
            where: {
              operationId: before.operationId,
              month: before.month,
              status: "PUBLISHED",
              supersededAt: null,
              archivedAt: null,
              id: { not: id }
            },
            select: { id: true }
          });
          if (previous.length) {
            await tx.scheduleVersion.updateMany({
              where: { id: { in: previous.map((p) => p.id) } },
              data: { supersededAt: now, supersededById: id, revision: { increment: 1 } }
            });
            for (const p of previous) {
              history.push({
                scheduleId: p.id,
                action: "SUPERSEDED",
                before: { status: "PUBLISHED" },
                after: { status: "PUBLISHED", supersededBy: id },
                reason: `Substituída pela versão ${before.version}, publicada.`,
                createdBy: user.id
              });
            }
          }
        }
        await tx.scheduleHistory.createMany({ data: history });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            userRole: user.role,
            action: auditAction,
            entity: "ScheduleVersion",
            entityId: id,
            companyId: before.operation.companyId,
            unitId: before.operation.unitId,
            operationId: before.operationId,
            before: { status: before.status, revision: before.revision } as Prisma.InputJsonValue,
            after: {
              status,
              revision: before.revision + 1,
              contentHash: hash
            } as Prisma.InputJsonValue,
            justification: reason?.trim() || null,
            origin: "api"
          }
        });
        return id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return this.db.scheduleVersion.findUniqueOrThrow({
      where: { id: result },
      include: { assignments: true }
    });
  }

  /** Histórico de decisões de uma versão (quem enviou, aprovou, reprovou, publicou — e o motivo), sem o conteúdo pesado. */
  async history(user: AuthenticatedUser, id: string) {
    const version = await this.db.scheduleVersion.findUnique({
      where: { id },
      include: { operation: true }
    });
    if (!version || version.archivedAt) {
      throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versao de escala nao encontrada.");
    }
    assertScoped(user, {
      companyId: version.operation.companyId,
      operationId: version.operationId,
      unitId: version.operation.unitId
    });
    const rows = await this.db.scheduleHistory.findMany({
      where: { scheduleId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, reason: true, createdAt: true, createdBy: true }
    });
    const ids = [
      ...new Set(rows.map((row) => row.createdBy).filter((x): x is string => Boolean(x)))
    ];
    const names = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true }
        })
      ).map((u) => [u.id, u.name])
    );
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      at: row.createdAt,
      byId: row.createdBy,
      byName: row.createdBy ? (names.get(row.createdBy) ?? null) : null
    }));
  }

  private async assertOperationScope(user: AuthenticatedUser, operationId: string) {
    const operation = await this.db.operation.findUnique({ where: { id: operationId } });
    if (!operation) {
      throw new HttpError(404, "OPERATION_NOT_FOUND", "Operacao nao encontrada.");
    }
    assertScoped(user, { companyId: operation.companyId, operationId, unitId: operation.unitId });
  }

  private async audit(
    user: AuthenticatedUser,
    action: AuditAction,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action,
        entity,
        entityId,
        before: before === null ? Prisma.JsonNull : toJson(before),
        after: toJson(after),
        origin: "api"
      }
    });
  }
}

function operationScopeWhere(user: AuthenticatedUser): Record<string, unknown> {
  if (user.scopes.some((scope) => scope.isGlobal)) {
    return {};
  }

  return {
    OR: user.scopes.map((scope) => ({
      companyId: scope.companyId ?? undefined,
      id: scope.operationId ?? undefined,
      unitId: scope.unitId ?? undefined
    }))
  };
}

function assertScoped(
  user: AuthenticatedUser,
  resource: { companyId?: string | null; operationId?: string | null; unitId?: string | null }
): void {
  if (canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Escala fora do escopo permitido.");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
