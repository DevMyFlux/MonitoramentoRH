/**
 * Fase 6 — geração da escala for the Colaboradores/Escalas flow.
 *
 * Flow (matches the brief): unidade → período → colaboradores ativos da
 * unidade → disponibilidade (employee-availability.ts, Fase 4) → afastamentos
 * → calendário do mês → overrides manuais → métricas/pendências. The result
 * is persisted as a ScheduleVersion, reusing the exact same table and
 * DRAFT→IN_REVIEW→APPROVED→PUBLISHED workflow the QLP-based flow already
 * uses (schedule-repository.ts's transition()) — only generatedResult's shape
 * is new (a ScheduleGridData instead of Duty/Assignment records). Rendering
 * to .xlsx (xlsx-renderer.ts, Fase 5) happens separately, on export, from
 * whatever generatedResult a version currently holds.
 */
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { scheduleCodeMap } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";
import { json, scopedOperation } from "../identity/access.js";
import {
  employeeAvailability,
  type EmployeeScheduleProfile
} from "./employee-availability.js";
import { calendarConfigSchema } from "./monthly-service.js";
import { daysInMonth, type ScheduleGridData, type ScheduleGridRow } from "./xlsx-renderer.js";

export type EmployeeSchedulePendency = {
  employeeId: string;
  employeeName: string;
  date: string;
  reasonCodes: string[];
};

export type EmployeeScheduleMetrics = {
  required: number;
  covered: number;
  coverage: number;
};

export type EmployeeScheduleSnapshot = {
  grid: ScheduleGridData;
  pendencies: EmployeeSchedulePendency[];
  metrics: EmployeeScheduleMetrics;
  hash: string;
};

function monthRange(month: string): { year: number; monthNumber: number; first: Date; last: Date } {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return {
    year,
    monthNumber,
    first: new Date(Date.UTC(year, monthNumber - 1, 1)),
    last: new Date(Date.UTC(year, monthNumber - 1, daysInMonth(year, monthNumber), 23, 59, 59))
  };
}

/** Rough day/night letter from the shift's configured start hour (07:00 -> D, 19:00 -> N). */
function workLetter(startHour: number | undefined): string {
  if (startHour === undefined) return "D";
  return startHour >= 18 || startHour < 5 ? "N" : "D";
}

function hoursLabel(config: { startHour: number; durationHours: number } | undefined): string {
  if (!config) return "";
  const end = (config.startHour + config.durationHours) % 24;
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${pad(config.startHour)}:00–${pad(end)}:00`;
}

export async function buildEmployeeScheduleSnapshot(
  db: PrismaClient,
  user: AuthenticatedUser,
  operationId: string,
  month: string
): Promise<EmployeeScheduleSnapshot> {
  await scopedOperation(db, user, operationId);
  const { year, monthNumber, first, last } = monthRange(month);
  const dayCount = daysInMonth(year, monthNumber);

  const employees = await db.employee.findMany({
    // SCHEDULED_ADMISSION must stay in the query even though these people are not
    // working yet: employeeAvailability() is what actually gates them day-by-day
    // via admissionDate. Filtering to status:"ACTIVE" alone silently dropped them
    // from the whole sheet, before or after their real admission date.
    where: { operationId, recordStatus: "ACTIVE", status: { in: ["ACTIVE", "SCHEDULED_ADMISSION"] } },
    include: {
      function: true,
      documents: { where: { status: "ACTIVE" } },
      competencies: { where: { status: "ACTIVE" } },
      calendarEvents: { where: { status: "ACTIVE" }, include: { type: true } }
    },
    orderBy: { name: "asc" }
  });

  const shiftParams = await db.operationalParameter.findMany({
    where: { operationId, kind: "SHIFT", status: "ACTIVE" }
  });
  const shiftByCode = new Map(
    shiftParams.map((p) => [p.code, calendarConfigSchema.parse(p.configuration)])
  );

  const documentRequirements = await db.complianceRequirement.findMany({
    where: { status: "ACTIVE", kind: "DOCUMENT", OR: [{ operationId }, { operationId: null }] }
  });
  const competencyMatrix = await db.competencyMatrixItem.findMany({
    where: { status: "ACTIVE", OR: [{ operationId }, { operationId: null }] }
  });

  const overrides = await db.scheduleDayOverride.findMany({
    where: { operationId, status: "ACTIVE", date: { gte: first, lte: last } }
  });
  const overrideByKey = new Map(
    overrides.map((o) => [`${o.employeeId}|${o.date.toISOString().slice(0, 10)}`, o])
  );

  const pendencies: EmployeeSchedulePendency[] = [];
  let required = 0;
  let covered = 0;

  const diurno: ScheduleGridRow[] = [];
  const noturno: ScheduleGridRow[] = [];

  for (const employee of employees) {
    const shiftConfig = employee.shift ? shiftByCode.get(employee.shift) : undefined;
    if (!employee.parity && !shiftConfig) {
      pendencies.push({
        employeeId: employee.id,
        employeeName: employee.name,
        date: `${month}-01`,
        reasonCodes: ["SHIFT_NOT_CONFIGURED"]
      });
    }

    const profile: EmployeeScheduleProfile = {
      id: employee.id,
      status: employee.status,
      admissionDate: employee.admissionDate?.toISOString() ?? null,
      parity: employee.parity
    };
    const events = employee.calendarEvents.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      type: { code: event.type.code, name: event.type.name, blocksAvailability: event.type.blocksAvailability }
    }));
    const aptitude = {
      documentRequirements: documentRequirements
        .filter((r) => !r.functionId || r.functionId === employee.functionId)
        .map((r) => ({
          code: r.code,
          name: r.name,
          warningDays: r.warningDays,
          required: r.required,
          documents: employee.documents
            .filter((d) => d.requirementId === r.id)
            .map((d) => ({ expiresAt: d.expiresAt, status: d.status }))
        })),
      competencyRequirements: competencyMatrix
        .filter((r) => r.functionId === employee.functionId)
        .map((r) => ({
          competencyCode: r.competencyCode,
          competencyName: r.competencyName,
          requiredLevel: r.requiredLevel,
          warningDays: r.warningDays,
          required: r.required,
          competencies: employee.competencies
            .filter((c) => c.competencyCode === r.competencyCode)
            .map((c) => ({ level: c.level, expiresAt: c.expiresAt, status: c.status }))
        }))
    };

    const days: string[] = [];
    for (let day = 1; day <= dayCount; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if (!shiftConfig && !employee.parity) {
        days.push("");
        continue;
      }
      const result = employeeAvailability({
        employee: profile,
        date,
        shift: { weekdays: shiftConfig?.weekdays ?? [] },
        events,
        aptitude
      });

      const notYetAdmitted = profile.admissionDate && profile.admissionDate.slice(0, 10) > date;
      const override = overrideByKey.get(`${employee.id}|${date}`);
      let code: string;
      if (override) {
        code = override.code;
      } else if (notYetAdmitted) {
        // Blank (not a work letter) either way — but only surface a pendency
        // when the rotation would actually have put them on duty; an
        // off-rotation day before admission needed no coverage.
        code = "";
        if (result.scheduled) {
          pendencies.push({
            employeeId: employee.id,
            employeeName: employee.name,
            date,
            reasonCodes: ["FUTURE_ADMISSION"]
          });
        }
      } else if (result.blockingEventTypeCodes.length) {
        // An absence (férias/atestado/...) blocks every day of its own date
        // range, regardless of whether the day-of-month rotation would have
        // scheduled a shift or a rest day that day — checked before
        // `!result.scheduled` so a leave doesn't alternate with plain "F" on
        // the person's normal off-days within the same leave period.
        code = result.blockingEventTypeCodes[0]!;
      } else if (!result.scheduled) {
        code = "F";
      } else {
        code = workLetter(shiftConfig?.startHour);
        if (!result.available) {
          pendencies.push({
            employeeId: employee.id,
            employeeName: employee.name,
            date,
            reasonCodes: result.reasonCodes
          });
        }
      }

      const isWorkDay = scheduleCodeMap[code]?.category === "WORK";
      // A manual override can add coverage on a day the rotation did not require
      // (e.g. calling someone in on a day off) — count that day as "required" too,
      // so coverage% never reads above 100%.
      if (result.scheduled || isWorkDay) required += 1;
      if (isWorkDay) covered += 1;
      days.push(code);
    }

    const row: ScheduleGridRow = {
      employeeId: employee.id,
      employeeName: employee.name,
      initials: employee.initials,
      functionName: employee.function?.name ?? "—",
      scheduleLabel: employee.parity
        ? `${workLetter(shiftConfig?.startHour) === "N" ? "Noturno" : "Diurno"} ${employee.parity === "ODD" ? "ímpar" : "par"}`
        : "Comercial",
      council: employee.council,
      hours: hoursLabel(shiftConfig),
      days,
      observation: employee.notes
    };
    (workLetter(shiftConfig?.startHour) === "N" ? noturno : diurno).push(row);
  }

  const sections = [
    ...(diurno.length ? [{ label: "DIURNO", rows: diurno }] : []),
    ...(noturno.length ? [{ label: "NOTURNO", rows: noturno }] : [])
  ];

  const grid: ScheduleGridData = { year, month: monthNumber, sections };
  const metrics: EmployeeScheduleMetrics = {
    required,
    covered,
    coverage: required ? Math.round((covered / required) * 100) : 0
  };
  const hash = createHash("sha256")
    .update(JSON.stringify({ grid, overrideIds: overrides.map((o) => o.id).sort() }))
    .digest("hex");

  return { grid, pendencies, metrics, hash };
}

export async function generateEmployeeSchedule(
  db: PrismaClient,
  user: AuthenticatedUser,
  operationId: string,
  month: string
) {
  const snapshot = await buildEmployeeScheduleSnapshot(db, user, operationId, month);
  if (!snapshot.grid.sections.length) {
    throw new HttpError(409, "NO_EMPLOYEES", "Nenhum colaborador ativo nesta unidade.");
  }
  const op = await scopedOperation(db, user, operationId);
  const monthDate = new Date(`${month}-01T00:00:00Z`);

  return db.$transaction(
    async (tx) => {
      const previous = await tx.scheduleVersion.findFirst({
        where: { operationId, month: monthDate },
        orderBy: { version: "desc" }
      });
      const row = await tx.scheduleVersion.create({
        data: {
          operationId,
          month: monthDate,
          version: (previous?.version ?? 0) + 1,
          generatedInput: json({ engine: "employee-schedule", hash: snapshot.hash, month }),
          generatedResult: json({
            grid: snapshot.grid,
            pendencies: snapshot.pendencies,
            metrics: snapshot.metrics
          }),
          createdBy: user.id,
          history: {
            create: {
              action: "SCHEDULE_GENERATE",
              after: json({ hash: snapshot.hash, metrics: snapshot.metrics }),
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
          after: json({ version: row.version, hash: snapshot.hash, metrics: snapshot.metrics }),
          origin: "api"
        }
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
