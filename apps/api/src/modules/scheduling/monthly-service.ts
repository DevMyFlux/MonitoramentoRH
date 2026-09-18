import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { json, scopedOperation } from "../identity/access.js";
import { engineVersion, generateMonthly, type Duty, type Worker } from "./operational-engine.js";

export const calendarConfigSchema = z
  .object({
    timezone: z
      .string()
      .default("America/Sao_Paulo")
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value }).format();
          return true;
        } catch {
          return false;
        }
      }),
    startHour: z.number().int().min(0).max(23),
    durationHours: z.number().positive().max(24),
    restHours: z.number().min(0).max(168),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    minimumTeam: z.number().int().min(0).max(100),
    cycleDays: z.number().int().min(1).max(60).default(1),
    workingDays: z.number().int().min(1).max(60).default(1),
    anchorDate: z.string().date().default("2026-01-01")
  })
  .refine((c) => c.workingDays <= c.cycleDays, "Dias de trabalho excedem o ciclo.");
export function zonedHour(date: string, hour: number, timezone: string) {
  const target = Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(instant));
    const part = (name: string) => parts.find((p) => p.type === name)?.value;
    const represented = Date.parse(
      `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}Z`
    );
    instant += target - represented;
  }
  return new Date(instant).toISOString();
}
export async function monthlySnapshot(
  db: PrismaClient,
  user: AuthenticatedUser,
  operationId: string,
  month: string
) {
  await scopedOperation(db, user, operationId);
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 23, 59, 59));
  const qlp = await db.qLPVersion.findFirst({
    where: {
      operationId,
      kind: "OPERATIONAL",
      status: "APPROVED",
      validFrom: { lte: first },
      OR: [{ validTo: null }, { validTo: { gte: last } }]
    },
    orderBy: { version: "desc" },
    include: { positions: { where: { status: "ACTIVE" } } }
  });
  if (!qlp)
    throw new HttpError(
      409,
      "APPROVED_QLP_REQUIRED",
      "É necessário QLP operacional aprovado com vigência para todo o mês."
    );
  const params = await db.operationalParameter.findMany({
    where: { operationId, kind: "SHIFT", status: "ACTIVE" }
  });
  if (!params.length)
    throw new HttpError(
      409,
      "SCHEDULE_RULES_REQUIRED",
      "Cadastre turnos e jornadas homologadas em Parâmetros."
    );
  const duties: Duty[] = [];
  for (const position of qlp.positions) {
    const parameter = params.find((p) => p.code === position.shift);
    if (!parameter)
      throw new HttpError(
        409,
        "SHIFT_NOT_CONFIGURED",
        `Turno ${position.shift ?? "sem código"} não configurado.`
      );
    const c = calendarConfigSchema.parse(parameter.configuration);
    for (let day = 1; day <= last.getUTCDate(); day++) {
      const current = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day));
      const date = current.toISOString().slice(0, 10);
      const cycle = Math.floor(
        (current.getTime() - Date.parse(`${c.anchorDate}T00:00:00Z`)) / 86400000
      );
      if (
        !c.weekdays.includes(current.getUTCDay()) ||
        ((cycle % c.cycleDays) + c.cycleDays) % c.cycleDays >= c.workingDays
      )
        continue;
      const startsAt = zonedHour(date, c.startHour, c.timezone);
      const endsAt = new Date(Date.parse(startsAt) + c.durationHours * 3600000).toISOString();
      if (
        position.validFrom.toISOString() > startsAt ||
        (position.validTo && position.validTo.toISOString() < endsAt)
      )
        continue;
      duties.push({
        positionId: position.id,
        functionId: position.functionId,
        date,
        startsAt,
        endsAt,
        team: position.team,
        shift: position.shift
      });
    }
  }
  const employees = await db.employee.findMany({
    where: { operationId, recordStatus: "ACTIVE" },
    include: {
      documents: { where: { status: "ACTIVE" } },
      competencies: { where: { status: "ACTIVE" } },
      assignments: { where: { status: "ACTIVE" } },
      calendarEvents: { where: { status: "ACTIVE" }, include: { type: true } }
    },
    orderBy: { id: "asc" }
  });
  const requirements = await db.complianceRequirement.findMany({
    where: { status: "ACTIVE", kind: "DOCUMENT", OR: [{ operationId }, { operationId: null }] }
  });
  const matrix = await db.competencyMatrixItem.findMany({
    where: { status: "ACTIVE", OR: [{ operationId }, { operationId: null }] }
  });
  const workers: Worker[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    functionId: e.functionId,
    shift: e.shift,
    status: e.status,
    admissionDate: e.admissionDate?.toISOString() ?? null,
    assignments: e.assignments.map((a) => ({
      positionId: a.positionId,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt?.toISOString() ?? null
    })),
    events: e.calendarEvents.map((a) => ({
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      code: a.type.category,
      blocks: a.type.blocksAvailability
    })),
    aptitude: {
      documentRequirements: requirements
        .filter((r) => !r.functionId || r.functionId === e.functionId)
        .map((r) => ({
          code: r.code,
          name: r.name,
          warningDays: r.warningDays,
          required: r.required,
          documents: e.documents
            .filter((d) => d.requirementId === r.id)
            .map((d) => ({ expiresAt: d.expiresAt, status: d.status }))
        })),
      competencyRequirements: matrix
        .filter((r) => r.functionId === e.functionId)
        .map((r) => ({
          competencyCode: r.competencyCode,
          competencyName: r.competencyName,
          requiredLevel: r.requiredLevel,
          warningDays: r.warningDays,
          required: r.required,
          competencies: e.competencies
            .filter((c) => c.competencyCode === r.competencyCode)
            .map((c) => ({ level: c.level, expiresAt: c.expiresAt, status: c.status }))
        }))
    }
  }));
  const configs = params.map((p) => calendarConfigSchema.parse(p.configuration));
  // Conservative combination across shifts; exact per-shift rules remain in the persisted snapshot.
  const rest = Math.max(...configs.map((c) => c.restHours));
  const team = Math.max(...configs.map((c) => c.minimumTeam));
  const snapshot = { qlpVersionId: qlp.id, engineVersion, params, duties, workers, rest, team };
  const hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return { snapshot, hash, result: generateMonthly(duties, workers, rest, team) };
}
export async function createMonthly(
  db: PrismaClient,
  user: AuthenticatedUser,
  operationId: string,
  month: string
) {
  const computed = await monthlySnapshot(db, user, operationId, month);
  if (!computed.snapshot.duties.length)
    throw new HttpError(409, "NO_DUTIES", "Nenhuma posição com jornada no período.");
  const op = await scopedOperation(db, user, operationId);
  const date = new Date(`${month}-01T00:00:00Z`);
  return db.$transaction(
    async (tx) => {
      const previous = await tx.scheduleVersion.findFirst({
        where: { operationId, month: date },
        orderBy: { version: "desc" }
      });
      const row = await tx.scheduleVersion.create({
        data: {
          operationId,
          month: date,
          version: (previous?.version ?? 0) + 1,
          generatedInput: json({ ...computed.snapshot, inputSnapshotHash: computed.hash }),
          generatedResult: json(computed.result),
          createdBy: user.id,
          history: {
            create: {
              action: "SCHEDULE_GENERATE",
              after: json({ hash: computed.hash, engineVersion }),
              createdBy: user.id
            }
          }
        }
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: "CREATE",
          entity: "ScheduleVersion",
          entityId: row.id,
          companyId: op.companyId,
          unitId: op.unitId,
          operationId,
          after: json({
            version: row.version,
            hash: computed.hash,
            metrics: computed.result.metrics
          }),
          origin: "api"
        }
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
