/**
 * Substituição temporária durante afastamentos (Fase 5): cadastro, plano e reconciliação das escalas.
 *
 * A configuração (`LeaveSubstitution`) é a fonte da verdade; a grade das escalas é consequência dela:
 *
 *  1. Antes de gravar, o plano é calculado com as MESMAS regras da geração (substitution-planner) e mostrado ao
 *     usuário — o que será coberto, o que não será e por quê. Uma configuração que não cobre nenhum plantão é recusada.
 *  2. Gravada a configuração, as escalas dos meses afetados são reconciliadas (`syncSubstitutionSchedules`): só as
 *     células que mudam são alteradas, pelo mesmo caminho da edição de escala (validação, versão, aprovação, histórico).
 *     É idempotente: aplicar de novo a mesma configuração não muda nada.
 *  3. Escala em rascunho/reprovada é atualizada na hora. Em análise, aprovada ou publicada NÃO é alterada em silêncio:
 *     a resposta pede confirmação, e confirmar cria uma nova versão em rascunho (a aprovação anterior deixa de valer).
 *  4. Cancelar a substituição, ou mudar/cancelar o afastamento, desfaz as coberturas do mesmo jeito. Nada é apagado:
 *     a configuração fica com a situação "cancelada" e quem/quando/por quê.
 */
import { randomUUID } from "node:crypto";
import { groupPendencies, type IssueGroup, type SchedulePendencyLike } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { json, operationWhere, scopedOperation } from "../identity/access.js";
import {
  evaluateCell,
  loadScheduleContext,
  prepareById,
  ruleCodeFor,
  type ContextSubstitution
} from "./schedule-context.js";
import { editScheduleCells } from "./schedule-edit-service.js";
import { gridRows, validateCell, type EditChange } from "./schedule-validation.js";
import { isEditableInPlace } from "./schedule-workflow.js";
import { coverageOf, leaveDate, type SubstitutionCellRef } from "./substitution-context.js";
import { eachDate, toPendency } from "./substitution-planner.js";
import type { ScheduleGridData } from "./xlsx-renderer.js";

const rowInclude = {
  leaveEvent: { include: { type: true } },
  titular: { select: { name: true } },
  substitute: { select: { name: true } }
} satisfies Prisma.LeaveSubstitutionInclude;

type Row = Prisma.LeaveSubstitutionGetPayload<{ include: typeof rowInclude }>;

export type SubstitutionInput = {
  leaveEventId: string;
  substituteId: string;
  rotation: "HABITUAL" | "SPECIFIC";
  specificParity?: "ODD" | "EVEN" | null | undefined;
  coveredDates?: string[] | undefined;
  notes?: string | null | undefined;
  dryRun?: boolean | undefined;
  applyToLockedSchedules?: boolean | undefined;
};

export type SubstitutionUpdateInput = {
  substituteId?: string | undefined;
  rotation?: "HABITUAL" | "SPECIFIC" | undefined;
  specificParity?: "ODD" | "EVEN" | null | undefined;
  coveredDates?: string[] | undefined;
  notes?: string | null | undefined;
  dryRun?: boolean | undefined;
  applyToLockedSchedules?: boolean | undefined;
};

/** "Em vigor" = o período do afastamento está acontecendo agora; "Encerrada" = o afastamento já terminou. */
export type EffectiveStatus = "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";

export type SubstitutionView = {
  id: string;
  operationId: string;
  leaveEventId: string;
  titularId: string;
  titularName: string;
  substituteId: string;
  substituteName: string;
  rotation: "HABITUAL" | "SPECIFIC";
  specificParity: "ODD" | "EVEN" | null;
  coveredDates: string[];
  status: "ACTIVE" | "CANCELLED";
  effectiveStatus: EffectiveStatus;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  leave: { typeCode: string; typeName: string; title: string; from: string; to: string };
};

export type PlanMonth = {
  month: string;
  demandDates: string[];
  coveredDates: string[];
  skippedByRotation: string[];
};

export type SubstitutionPlanView = {
  months: PlanMonth[];
  demandCount: number;
  coveredCount: number;
  /** Plantões que ficam para outro substituto por causa do Par/Ímpar escolhido. */
  skippedByRotationCount: number;
  /** Plantões que deveriam ser cobertos por esta substituição e não puderam (veja `issues`). */
  uncoveredCount: number;
  issues: IssueGroup[];
};

export type ScheduleSyncOutcome = {
  month: string;
  /** Escala (versão) que continha a mudança; `null` quando o mês ainda não tem escala gerada. */
  versionId: string | null;
  version: number | null;
  status: string | null;
  outcome:
    | "UPDATED"
    | "NEW_VERSION"
    | "UNCHANGED"
    | "NO_SCHEDULE"
    | "NEEDS_CONFIRMATION"
    | "CONFLICT"
    | "NOT_SUPPORTED"
    | "FAILED";
  changedCells: number;
  message: string;
  issues?: IssueGroup[];
};

export type SubstitutionResult = {
  dryRun: boolean;
  substitution: SubstitutionView;
  plan: SubstitutionPlanView;
  schedules: ScheduleSyncOutcome[];
};

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  REJECTED: "Reprovada",
  IN_REVIEW: "Em análise",
  APPROVED: "Aprovada",
  PUBLISHED: "Publicada"
};

const monthName = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (;;) {
    const label = `${year}-${String(month).padStart(2, "0")}`;
    if (label > last) break;
    months.push(label);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

// ── visão ─────────────────────────────────────────────────────────────────────

function effectiveStatusOf(row: Row, today: string): EffectiveStatus {
  if (row.status === "CANCELLED") return "CANCELLED";
  if (row.leaveEvent.status !== "ACTIVE") return "CANCELLED";
  if (leaveDate(row.leaveEvent.endsAt) < today) return "ENDED";
  if (leaveDate(row.leaveEvent.startsAt) > today) return "SCHEDULED";
  return "ACTIVE";
}

export function toView(row: Row, today = new Date().toISOString().slice(0, 10)): SubstitutionView {
  return {
    id: row.id,
    operationId: row.operationId,
    leaveEventId: row.leaveEventId,
    titularId: row.titularId,
    titularName: row.titular.name,
    substituteId: row.substituteId,
    substituteName: row.substitute.name,
    rotation: row.rotation,
    specificParity: row.specificParity,
    coveredDates: row.coveredDates,
    status: row.status,
    effectiveStatus: effectiveStatusOf(row, today),
    notes: row.notes,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    leave: {
      typeCode: row.leaveEvent.type.code,
      typeName: row.leaveEvent.type.name,
      title: row.leaveEvent.title,
      from: leaveDate(row.leaveEvent.startsAt),
      to: leaveDate(row.leaveEvent.endsAt)
    }
  };
}

export async function listSubstitutions(
  db: PrismaClient,
  user: AuthenticatedUser,
  filter: {
    operationId?: string | undefined;
    leaveEventId?: string | undefined;
    employeeId?: string | undefined;
  }
): Promise<SubstitutionView[]> {
  const rows = await db.leaveSubstitution.findMany({
    where: {
      operation: operationWhere(user),
      ...(filter.operationId ? { operationId: filter.operationId } : {}),
      ...(filter.leaveEventId ? { leaveEventId: filter.leaveEventId } : {}),
      ...(filter.employeeId
        ? { OR: [{ titularId: filter.employeeId }, { substituteId: filter.employeeId }] }
        : {})
    },
    include: rowInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }]
  });
  return rows.map((row) => toView(row));
}

// ── validação da configuração ─────────────────────────────────────────────────

type Resolved = {
  operationId: string;
  event: Row["leaveEvent"];
  titularName: string;
  substituteName: string;
  titularId: string;
  substituteId: string;
  rotation: "HABITUAL" | "SPECIFIC";
  specificParity: "ODD" | "EVEN" | null;
  parityReferenceMonth: string | null;
  coveredDates: string[];
  notes: string | null;
};

async function resolveConfig(
  db: PrismaClient,
  user: AuthenticatedUser,
  input: Omit<SubstitutionInput, "dryRun" | "applyToLockedSchedules">,
  selfId?: string
): Promise<Resolved> {
  const event = await db.calendarEvent.findUnique({
    where: { id: input.leaveEventId },
    include: { type: true, employee: true }
  });
  if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Afastamento não encontrado.");
  if (event.status !== "ACTIVE") {
    throw new HttpError(409, "SUBSTITUTION_LEAVE_INACTIVE", "O afastamento foi cancelado.");
  }
  if (!event.employee || !event.type.blocksAvailability) {
    throw new HttpError(
      409,
      "SUBSTITUTION_LEAVE_INVALID",
      "Só é possível configurar substituição para um afastamento de um colaborador."
    );
  }
  const operationId = event.employee.operationId;
  await scopedOperation(db, user, operationId);

  if (input.substituteId === event.employee.id) {
    throw new HttpError(
      409,
      "SUBSTITUTION_SAME_PERSON",
      "O substituto precisa ser uma pessoa diferente do colaborador afastado."
    );
  }
  const substitute = await db.employee.findUnique({ where: { id: input.substituteId } });
  if (!substitute || substitute.recordStatus !== "ACTIVE") {
    throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Colaborador substituto não encontrado.");
  }
  if (substitute.operationId !== operationId) {
    throw new HttpError(
      409,
      "SUBSTITUTE_OUT_OF_UNIT",
      "O substituto precisa trabalhar na mesma unidade do colaborador afastado."
    );
  }
  const duplicate = await db.leaveSubstitution.findFirst({
    where: {
      leaveEventId: event.id,
      substituteId: substitute.id,
      status: "ACTIVE",
      ...(selfId ? { id: { not: selfId } } : {})
    },
    select: { id: true }
  });
  if (duplicate) {
    throw new HttpError(
      409,
      "SUBSTITUTION_DUPLICATE",
      "Esse substituto já está configurado para este afastamento."
    );
  }

  if (input.rotation === "SPECIFIC" && !input.specificParity) {
    throw new HttpError(
      400,
      "SUBSTITUTION_PARITY_REQUIRED",
      "No rodízio específico é preciso escolher Par ou Ímpar."
    );
  }

  const from = leaveDate(event.startsAt);
  const to = leaveDate(event.endsAt);
  const coveredDates = [...new Set(input.coveredDates ?? [])].sort();
  const outside = coveredDates.filter((date) => date < from || date > to);
  if (outside.length) {
    throw new HttpError(
      400,
      "SUBSTITUTION_DATES_OUTSIDE_LEAVE",
      `Estas datas estão fora do período do afastamento (${brDate(from)} a ${brDate(to)}): ${outside
        .map(brDate)
        .join(", ")}.`
    );
  }

  return {
    operationId,
    event,
    titularId: event.employee.id,
    titularName: event.employee.name,
    substituteId: substitute.id,
    substituteName: substitute.name,
    rotation: input.rotation,
    specificParity: input.rotation === "SPECIFIC" ? (input.specificParity ?? null) : null,
    // A classificação Par/Ímpar é "verdadeira em um mês": a do mês em que o afastamento começa.
    parityReferenceMonth: input.rotation === "SPECIFIC" ? from.slice(0, 7) : null,
    coveredDates,
    notes: input.notes?.trim() || null
  };
}

// ── plano ─────────────────────────────────────────────────────────────────────

function candidateRow(id: string, resolved: Resolved, createdAt: Date): ContextSubstitution {
  return {
    id,
    operationId: resolved.operationId,
    leaveEventId: resolved.event.id,
    titularId: resolved.titularId,
    substituteId: resolved.substituteId,
    rotation: resolved.rotation,
    specificParity: resolved.specificParity,
    parityReferenceMonth: resolved.parityReferenceMonth,
    coveredDates: resolved.coveredDates,
    status: "ACTIVE",
    notes: resolved.notes,
    cancelReason: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt,
    updatedAt: createdAt,
    createdBy: null,
    updatedBy: null,
    leaveEvent: resolved.event,
    titular: { name: resolved.titularName },
    substitute: { name: resolved.substituteName }
  };
}

/** Plano da configuração (como ela ficaria), mês a mês, contando as outras substituições ativas da unidade. */
async function planConfig(
  db: PrismaClient,
  user: AuthenticatedUser,
  candidate: ContextSubstitution
): Promise<SubstitutionPlanView> {
  const from = leaveDate(candidate.leaveEvent.startsAt);
  const to = leaveDate(candidate.leaveEvent.endsAt);
  const months: PlanMonth[] = [];
  const issues: SchedulePendencyLike[] = [];
  for (const month of monthsBetween(from, to)) {
    const ctx = await loadScheduleContext(db, user, candidate.operationId, month);
    // a configuração candidata entra no lugar da gravada (se houver), mantendo a ordem de prioridade por criação
    ctx.substitutionRows = [
      ...ctx.substitutionRows.filter((row) => row.id !== candidate.id),
      candidate
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const planned = coverageOf(ctx).plans.find((p) => p.row.id === candidate.id)?.plan;
    if (!planned) continue;
    months.push({
      month,
      demandDates: planned.demandDates,
      coveredDates: planned.coveredDates,
      skippedByRotation: planned.skippedByRotation
    });
    issues.push(...planned.issues.map(toPendency));
    issues.push(...restWarnings(ctx, candidate.substituteId, planned.coveredDates));
  }
  const sum = (pick: (m: PlanMonth) => number) => months.reduce((total, m) => total + pick(m), 0);
  const demandCount = sum((m) => m.demandDates.length);
  const coveredCount = sum((m) => m.coveredDates.length);
  const skippedByRotationCount = sum((m) => m.skippedByRotation.length);
  return {
    months,
    demandCount,
    coveredCount,
    skippedByRotationCount,
    uncoveredCount: demandCount - coveredCount - skippedByRotationCount,
    issues: groupPendencies(issues)
  };
}

/**
 * Avisos das regras de edição para os dias que o substituto vai cobrir (ex.: descanso menor que o do turno quando o
 * dia cobre ao lado do próprio plantão). São os mesmos que a escala guarda depois de gravar; aqui aparecem ANTES.
 */
function restWarnings(
  ctx: Awaited<ReturnType<typeof loadScheduleContext>>,
  substituteId: string,
  coveredDates: string[]
): SchedulePendencyLike[] {
  const prep = prepareById(ctx, substituteId);
  if (!prep || !coveredDates.length) return [];
  const coverage = coverageOf(ctx);
  const days = Array.from({ length: ctx.dayCount }, (_, i) => {
    const date = `${ctx.month}-${String(i + 1).padStart(2, "0")}`;
    const key = cellKey(substituteId, date);
    return (
      evaluateCell(prep, date, ctx.overrideByKey.get(key), undefined, coverage.cells.has(key))
        ?.code ?? ""
    );
  });
  return coveredDates.flatMap((date) =>
    validateCell(prep, date, "C", days, { editTime: false, hasReason: true })
  );
}

/** Recusa a configuração que não cobriria nenhum plantão — e diz por quê, em vez de gravar algo inútil. */
function assertCoverable(plan: SubstitutionPlanView, resolved: Resolved): void {
  if (plan.coveredCount > 0) return;
  const message =
    plan.demandCount === 0
      ? `${resolved.titularName} não tem plantão a cobrir no período e nas datas escolhidos.`
      : plan.skippedByRotationCount === plan.demandCount
        ? `Nenhum plantão de ${resolved.titularName} cai em dias do rodízio escolhido para ${resolved.substituteName}.`
        : `Nenhum plantão de ${resolved.titularName} pôde ser coberto por ${resolved.substituteName}.`;
  throw new HttpError(409, "SUBSTITUTION_NOTHING_TO_COVER", message, { issues: plan.issues, plan });
}

// ── gravação ──────────────────────────────────────────────────────────────────

async function audit(
  db: PrismaClient | Prisma.TransactionClient,
  user: AuthenticatedUser,
  operation: { companyId: string; unitId: string },
  action: "CREATE" | "UPDATE",
  row: { id: string; operationId: string },
  before: unknown,
  after: unknown,
  justification?: string | null
) {
  await db.auditLog.create({
    data: {
      userId: user.id,
      userRole: user.role,
      action,
      entity: "LeaveSubstitution",
      entityId: row.id,
      companyId: operation.companyId,
      unitId: operation.unitId,
      operationId: row.operationId,
      ...(before === null ? {} : { before: json(before) }),
      after: json(after),
      ...(justification ? { justification } : {}),
      origin: "api"
    }
  });
}

const snapshotOf = (row: Row) => ({
  titularId: row.titularId,
  substituteId: row.substituteId,
  leaveEventId: row.leaveEventId,
  rotation: row.rotation,
  specificParity: row.specificParity,
  coveredDates: row.coveredDates,
  status: row.status,
  notes: row.notes
});

function describe(resolved: {
  titularName: string;
  substituteName: string;
  event: Row["leaveEvent"];
}) {
  return `${resolved.substituteName} cobre ${resolved.titularName} (${resolved.event.type.name}, ${brDate(
    leaveDate(resolved.event.startsAt)
  )} a ${brDate(leaveDate(resolved.event.endsAt))})`;
}

type SyncOptions = {
  applyToLockedSchedules?: boolean | undefined;
  onError?: ((error: unknown) => void) | undefined;
};

export async function createSubstitution(
  db: PrismaClient,
  user: AuthenticatedUser,
  input: SubstitutionInput,
  options: Pick<SyncOptions, "onError"> = {}
): Promise<SubstitutionResult> {
  const resolved = await resolveConfig(db, user, input);
  const id = randomUUID();
  const candidate = candidateRow(id, resolved, new Date());
  const plan = await planConfig(db, user, candidate);
  assertCoverable(plan, resolved);

  if (input.dryRun) {
    return {
      dryRun: true,
      substitution: toView({ ...candidate, leaveEvent: resolved.event }),
      plan,
      schedules: []
    };
  }

  const operation = await scopedOperation(db, user, resolved.operationId);
  const created = await db.$transaction(async (tx) => {
    const row = await tx.leaveSubstitution.create({
      data: {
        id,
        operationId: resolved.operationId,
        leaveEventId: resolved.event.id,
        titularId: resolved.titularId,
        substituteId: resolved.substituteId,
        rotation: resolved.rotation,
        specificParity: resolved.specificParity,
        parityReferenceMonth: resolved.parityReferenceMonth,
        coveredDates: resolved.coveredDates,
        notes: resolved.notes,
        createdBy: user.id
      },
      include: rowInclude
    });
    await audit(tx, user, operation, "CREATE", row, null, snapshotOf(row));
    return row;
  });

  const schedules = await syncSubstitutionSchedules(db, user, {
    operationId: resolved.operationId,
    months: monthsBetween(leaveDate(resolved.event.startsAt), leaveDate(resolved.event.endsAt)),
    reason: `Substituição cadastrada: ${describe(resolved)}.`,
    // o afastamento pode ter sido cadastrado depois de a escala ser gerada: a linha do titular precisa mostrá-lo
    refreshTitular: [
      {
        employeeId: resolved.titularId,
        from: leaveDate(resolved.event.startsAt),
        to: leaveDate(resolved.event.endsAt)
      }
    ],
    ...options,
    applyToLocked: input.applyToLockedSchedules
  });
  return { dryRun: false, substitution: toView(created), plan, schedules };
}

async function loadRow(db: PrismaClient, user: AuthenticatedUser, id: string): Promise<Row> {
  const row = await db.leaveSubstitution.findUnique({ where: { id }, include: rowInclude });
  if (!row) throw new HttpError(404, "SUBSTITUTION_NOT_FOUND", "Substituição não encontrada.");
  await scopedOperation(db, user, row.operationId);
  return row;
}

export async function updateSubstitution(
  db: PrismaClient,
  user: AuthenticatedUser,
  id: string,
  input: SubstitutionUpdateInput,
  options: Pick<SyncOptions, "onError"> = {}
): Promise<SubstitutionResult> {
  const existing = await loadRow(db, user, id);
  if (existing.status === "CANCELLED") {
    throw new HttpError(
      409,
      "SUBSTITUTION_ALREADY_CANCELLED",
      "Esta substituição já foi cancelada e não pode mais ser alterada."
    );
  }
  const rotation = input.rotation ?? existing.rotation;
  const resolved = await resolveConfig(
    db,
    user,
    {
      leaveEventId: existing.leaveEventId,
      substituteId: input.substituteId ?? existing.substituteId,
      rotation,
      specificParity:
        rotation === "SPECIFIC" ? (input.specificParity ?? existing.specificParity) : null,
      coveredDates: input.coveredDates ?? existing.coveredDates,
      notes: input.notes === undefined ? existing.notes : input.notes
    },
    id
  );
  // trocar de Par/Ímpar (ou de modo) reinicia a referência; sem trocar, mantém a original
  const keepsParity =
    rotation === "SPECIFIC" && existing.specificParity === resolved.specificParity;
  if (keepsParity && existing.parityReferenceMonth) {
    resolved.parityReferenceMonth = existing.parityReferenceMonth;
  }

  const candidate = candidateRow(id, resolved, existing.createdAt);
  const plan = await planConfig(db, user, candidate);
  assertCoverable(plan, resolved);

  if (input.dryRun) {
    return {
      dryRun: true,
      substitution: toView({ ...existing, ...candidate, leaveEvent: resolved.event }),
      plan,
      schedules: []
    };
  }

  const operation = await scopedOperation(db, user, resolved.operationId);
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.leaveSubstitution.update({
      where: { id },
      data: {
        substituteId: resolved.substituteId,
        rotation: resolved.rotation,
        specificParity: resolved.specificParity,
        parityReferenceMonth: resolved.parityReferenceMonth,
        coveredDates: resolved.coveredDates,
        notes: resolved.notes,
        updatedBy: user.id
      },
      include: rowInclude
    });
    await audit(tx, user, operation, "UPDATE", row, snapshotOf(existing), snapshotOf(row));
    return row;
  });

  const schedules = await syncSubstitutionSchedules(db, user, {
    operationId: resolved.operationId,
    months: monthsBetween(leaveDate(resolved.event.startsAt), leaveDate(resolved.event.endsAt)),
    reason: `Substituição alterada: ${describe(resolved)}.`,
    refreshTitular: [
      {
        employeeId: resolved.titularId,
        from: leaveDate(resolved.event.startsAt),
        to: leaveDate(resolved.event.endsAt)
      }
    ],
    ...options,
    applyToLocked: input.applyToLockedSchedules
  });
  return { dryRun: false, substitution: toView(updated), plan, schedules };
}

export async function cancelSubstitution(
  db: PrismaClient,
  user: AuthenticatedUser,
  id: string,
  input: { reason: string; applyToLockedSchedules?: boolean | undefined },
  options: Pick<SyncOptions, "onError"> = {}
): Promise<{ substitution: SubstitutionView; schedules: ScheduleSyncOutcome[] }> {
  const existing = await loadRow(db, user, id);
  if (existing.status === "CANCELLED") {
    throw new HttpError(
      409,
      "SUBSTITUTION_ALREADY_CANCELLED",
      "Esta substituição já foi cancelada e não pode mais ser alterada."
    );
  }
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new HttpError(
      400,
      "SUBSTITUTION_CANCEL_REASON_REQUIRED",
      "Para cancelar uma substituição é preciso informar o motivo."
    );
  }
  const operation = await scopedOperation(db, user, existing.operationId);
  const cancelled = await db.$transaction(async (tx) => {
    const row = await tx.leaveSubstitution.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: reason,
        cancelledAt: new Date(),
        cancelledBy: user.id,
        updatedBy: user.id
      },
      include: rowInclude
    });
    await audit(tx, user, operation, "UPDATE", row, snapshotOf(existing), snapshotOf(row), reason);
    return row;
  });

  const schedules = await syncSubstitutionSchedules(db, user, {
    operationId: existing.operationId,
    months: monthsBetween(
      leaveDate(existing.leaveEvent.startsAt),
      leaveDate(existing.leaveEvent.endsAt)
    ),
    reason: `Substituição cancelada (${describe({
      titularName: existing.titular.name,
      substituteName: existing.substitute.name,
      event: existing.leaveEvent
    })}): ${reason}`,
    ...options,
    applyToLocked: input.applyToLockedSchedules
  });
  return { substitution: toView(cancelled), schedules };
}

/** Reaplica a configuração às escalas (idempotente); é também como se confirma a criação de nova versão. */
export async function applySubstitution(
  db: PrismaClient,
  user: AuthenticatedUser,
  id: string,
  input: {
    applyToLockedSchedules?: boolean | undefined;
    refreshFrom?: string | undefined;
    refreshTo?: string | undefined;
  },
  options: Pick<SyncOptions, "onError"> = {}
): Promise<{ substitution: SubstitutionView; schedules: ScheduleSyncOutcome[] }> {
  const row = await loadRow(db, user, id);
  const leaveFrom = leaveDate(row.leaveEvent.startsAt);
  const leaveTo = leaveDate(row.leaveEvent.endsAt);
  // Período do titular a reconferir: o pedido (afastamento que mudou) ou, por padrão, o do afastamento atual.
  const refresh = {
    from: input.refreshFrom ?? leaveFrom,
    to: input.refreshTo ?? leaveTo
  };
  const schedules = await syncSubstitutionSchedules(db, user, {
    operationId: row.operationId,
    months: monthsBetween(
      refresh.from < leaveFrom ? refresh.from : leaveFrom,
      refresh.to > leaveTo ? refresh.to : leaveTo
    ),
    refreshTitular: [{ employeeId: row.titularId, ...refresh }],
    reason: `Substituição aplicada às escalas: ${describe({
      titularName: row.titular.name,
      substituteName: row.substitute.name,
      event: row.leaveEvent
    })}.`,
    ...options,
    applyToLocked: input.applyToLockedSchedules
  });
  return { substitution: toView(row), schedules };
}

// ── mudanças no afastamento (datas / cancelamento) ────────────────────────────

export type LeaveChange = {
  leaveEventId: string;
  operationId: string;
  titularId: string;
  /** Período antes e depois (o depois é `null` quando o afastamento foi cancelado). */
  before: { from: string; to: string };
  after: { from: string; to: string } | null;
};

/**
 * O afastamento mudou de datas ou foi cancelado: recalcula as coberturas e atualiza as linhas do titular que o
 * afastamento afetava. Só atua em afastamentos que têm substituição (os demais seguem como sempre foram).
 */
export async function reconcileLeaveChange(
  db: PrismaClient,
  user: AuthenticatedUser,
  change: LeaveChange,
  options: SyncOptions = {}
): Promise<{ substitutions: SubstitutionView[]; schedules: ScheduleSyncOutcome[] }> {
  const rows = await db.leaveSubstitution.findMany({
    where: { leaveEventId: change.leaveEventId, status: "ACTIVE" },
    include: rowInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  if (!rows.length) return { substitutions: [], schedules: [] };

  const from =
    change.after && change.after.from < change.before.from ? change.after.from : change.before.from;
  const to =
    change.after && change.after.to > change.before.to ? change.after.to : change.before.to;

  if (!change.after) {
    const operation = await scopedOperation(db, user, change.operationId);
    await db.$transaction(async (tx) => {
      for (const row of rows) {
        const reason = "Afastamento cancelado.";
        const cancelled = await tx.leaveSubstitution.update({
          where: { id: row.id },
          data: {
            status: "CANCELLED",
            cancelReason: reason,
            cancelledAt: new Date(),
            cancelledBy: user.id,
            updatedBy: user.id
          },
          include: rowInclude
        });
        await audit(
          tx,
          user,
          operation,
          "UPDATE",
          cancelled,
          snapshotOf(row),
          snapshotOf(cancelled),
          reason
        );
      }
    });
  }

  const first = rows[0]!;
  const reason = change.after
    ? `Afastamento de ${first.titular.name} alterado para ${brDate(change.after.from)} a ${brDate(change.after.to)}: coberturas recalculadas.`
    : `Afastamento de ${first.titular.name} cancelado: coberturas desfeitas.`;
  const schedules = await syncSubstitutionSchedules(db, user, {
    operationId: change.operationId,
    months: monthsBetween(from, to),
    reason,
    refreshTitular: [{ employeeId: change.titularId, from, to }],
    ...options,
    applyToLocked: options.applyToLockedSchedules
  });
  const fresh = await db.leaveSubstitution.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: rowInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  return { substitutions: fresh.map((row) => toView(row)), schedules };
}

// ── reconciliação das escalas ─────────────────────────────────────────────────

type StoredResult = { grid?: ScheduleGridData; substitutionCells?: SubstitutionCellRef[] };

export async function syncSubstitutionSchedules(
  db: PrismaClient,
  user: AuthenticatedUser,
  args: {
    operationId: string;
    months: string[];
    reason: string;
    applyToLocked?: boolean | undefined;
    onError?: ((error: unknown) => void) | undefined;
    /** Linhas do titular a conferir contra as regras (usado quando o afastamento muda de datas ou é cancelado). */
    refreshTitular?: Array<{ employeeId: string; from: string; to: string }> | undefined;
  }
): Promise<ScheduleSyncOutcome[]> {
  const outcomes: ScheduleSyncOutcome[] = [];
  for (const month of args.months) {
    try {
      outcomes.push(await syncMonth(db, user, { ...args, month }));
    } catch (error) {
      if (error instanceof HttpError && error.code === "SCHEDULE_EDIT_INVALID") {
        outcomes.push({
          month,
          versionId: null,
          version: null,
          status: null,
          outcome: "CONFLICT",
          changedCells: 0,
          message: `A escala de ${monthName(month)} tem uma situação que impede a atualização automática. Corrija os itens indicados e aplique a substituição de novo.`,
          issues: (error.details.issues as IssueGroup[] | undefined) ?? []
        });
      } else if (error instanceof HttpError && error.code === "SCHEDULE_REVISION_CONFLICT") {
        outcomes.push({
          month,
          versionId: null,
          version: null,
          status: null,
          outcome: "CONFLICT",
          changedCells: 0,
          message: `A escala de ${monthName(month)} foi alterada por outra pessoa durante a atualização. Aplique a substituição de novo.`
        });
      } else {
        args.onError?.(error);
        outcomes.push({
          month,
          versionId: null,
          version: null,
          status: null,
          outcome: "FAILED",
          changedCells: 0,
          message: `Não foi possível atualizar a escala de ${monthName(month)}. A substituição foi salva; aplique-a às escalas de novo.`
        });
      }
    }
  }
  return outcomes;
}

async function syncMonth(
  db: PrismaClient,
  user: AuthenticatedUser,
  args: {
    operationId: string;
    month: string;
    reason: string;
    applyToLocked?: boolean | undefined;
    refreshTitular?: Array<{ employeeId: string; from: string; to: string }> | undefined;
  }
): Promise<ScheduleSyncOutcome> {
  const { month, operationId } = args;
  const version = await db.scheduleVersion.findFirst({
    where: {
      operationId,
      month: new Date(`${month}-01T00:00:00Z`),
      archivedAt: null,
      supersededAt: null
    },
    orderBy: { version: "desc" }
  });
  const base = { month, changedCells: 0 };
  if (!version) {
    return {
      ...base,
      versionId: null,
      version: null,
      status: null,
      outcome: "NO_SCHEDULE",
      message: `A escala de ${monthName(month)} ainda não foi gerada; a substituição será considerada quando ela for gerada.`
    };
  }
  const here = { versionId: version.id, version: version.version, status: version.status };
  const stored = version.generatedResult as StoredResult | null;
  if (!stored?.grid) {
    return {
      ...base,
      ...here,
      outcome: "NOT_SUPPORTED",
      message: `A escala de ${monthName(month)} foi gerada por um fluxo anterior e não pode ser atualizada automaticamente. Gere-a de novo.`
    };
  }

  const rows = gridRows(stored.grid);
  const ctx = await loadScheduleContext(db, user, operationId, month, {
    onlyEmployeeIds: rows.map((row) => row.employeeId)
  });
  const coverage = coverageOf(ctx);
  const current = new Map(
    rows.flatMap((row) =>
      row.days.map(
        (code, i) =>
          [cellKey(row.employeeId, `${month}-${String(i + 1).padStart(2, "0")}`), code] as const
      )
    )
  );
  const previous = new Set(
    (stored.substitutionCells ?? []).map((cell) => cellKey(cell.employeeId, cell.date))
  );

  const changes = new Map<string, EditChange>();
  const want = (employeeId: string, date: string, code: string) => {
    const key = cellKey(employeeId, date);
    if (current.has(key) && current.get(key) !== code) changes.set(key, { employeeId, date, code });
  };

  // 1) coberturas que a grade deve ter e ainda não tem
  for (const key of coverage.cells.keys()) {
    const [employeeId, date] = key.split("|") as [string, string];
    want(employeeId, date, "C");
  }
  // 2) coberturas que a grade tem por causa de uma substituição que não vale mais: volta ao que a regra prevê
  //    (o dia que alguém ajustou à mão depois não é tocado)
  for (const key of previous) {
    if (coverage.cells.has(key) || ctx.overrideByKey.has(key) || current.get(key) !== "C") continue;
    const [employeeId, date] = key.split("|") as [string, string];
    const prep = prepareById(ctx, employeeId);
    if (prep) want(employeeId, date, ruleCodeFor(prep, date));
  }
  // 3) linhas do titular do afastamento que mudou: o que a regra (e as coberturas dele) prevê hoje
  for (const refresh of args.refreshTitular ?? []) {
    const prep = prepareById(ctx, refresh.employeeId);
    if (!prep) continue;
    for (const date of eachDate(refresh.from, refresh.to)) {
      if (!date.startsWith(`${month}-`)) continue;
      const key = cellKey(refresh.employeeId, date);
      if (ctx.overrideByKey.has(key)) continue;
      want(refresh.employeeId, date, coverage.cells.has(key) ? "C" : ruleCodeFor(prep, date));
    }
  }

  if (!changes.size) {
    return {
      ...base,
      ...here,
      outcome: "UNCHANGED",
      message: `A escala de ${monthName(month)} já está de acordo com a substituição.`
    };
  }

  if (!isEditableInPlace(version.status) && !args.applyToLocked) {
    return {
      ...base,
      ...here,
      changedCells: changes.size,
      outcome: "NEEDS_CONFIRMATION",
      message: `A escala de ${monthName(month)} (versão ${version.version}) está "${statusLabel[version.status] ?? version.status}". Atualizá-la cria uma nova versão em rascunho e a ${version.status === "PUBLISHED" ? "publicação atual continua no ar até a nova ser publicada" : "análise/aprovação atual deixa de valer"}. Confirme para aplicar.`
    };
  }

  const result = await editScheduleCells(db, user, version.id, {
    expectedRevision: version.revision,
    changes: [...changes.values()],
    justification: args.reason,
    system: { origin: "SUBSTITUTION" }
  });
  return {
    ...base,
    versionId: result.versionId,
    version: result.derived ? version.version + 1 : version.version,
    status: result.derived ? "DRAFT" : version.status,
    changedCells: changes.size,
    outcome: result.derived ? "NEW_VERSION" : "UPDATED",
    message: result.derived
      ? `Criada uma nova versão em rascunho da escala de ${monthName(month)} com a substituição.`
      : `Escala de ${monthName(month)} atualizada (${changes.size} ${changes.size === 1 ? "dia" : "dias"}).`,
    ...(result.issues.length ? { issues: result.issues } : {})
  };
}
