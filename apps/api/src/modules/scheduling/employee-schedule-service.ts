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
import { effectiveParity, holidaysOfMonth } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";
import { json, scopedOperation } from "../identity/access.js";
import { contentHashOf } from "./schedule-content.js";
import {
  evaluateCell,
  hoursLabel,
  loadScheduleContext,
  prepareEmployee,
  workLetter
} from "./schedule-context.js";
import type { ScheduleGridData, ScheduleGridRow } from "./xlsx-renderer.js";

export type EmployeeSchedulePendency = {
  employeeId: string;
  employeeName: string;
  date: string;
  reasonCodes: string[];
  /** Frases legíveis das regras de origem, por código (opcional: escalas antigas não têm). */
  details?: Array<{ code: string; message: string }>;
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

export async function buildEmployeeScheduleSnapshot(
  db: PrismaClient,
  user: AuthenticatedUser,
  operationId: string,
  month: string
): Promise<EmployeeScheduleSnapshot> {
  const ctx = await loadScheduleContext(db, user, operationId, month);
  const { year, monthNumber, dayCount, overrides } = ctx;

  const pendencies: EmployeeSchedulePendency[] = [];
  let required = 0;
  let covered = 0;

  const diurno: ScheduleGridRow[] = [];
  const noturno: ScheduleGridRow[] = [];

  for (const employee of ctx.employees) {
    const prep = prepareEmployee(ctx, employee);
    const { shiftConfig } = prep;
    if (!prep.configured) {
      pendencies.push({
        employeeId: employee.id,
        employeeName: employee.name,
        date: `${month}-01`,
        reasonCodes: ["SHIFT_NOT_CONFIGURED"]
      });
    }

    const days: string[] = [];
    for (let day = 1; day <= dayCount; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const cell = evaluateCell(prep, date, ctx.overrideByKey.get(`${employee.id}|${date}`));
      if (!cell) {
        days.push("");
        continue;
      }
      if (cell.pendency) {
        pendencies.push({ employeeId: employee.id, employeeName: employee.name, date, ...cell.pendency });
      }
      // A manual override can add coverage on a day the rotation did not require
      // (e.g. calling someone in on a day off) — count that day as "required" too,
      // so coverage% never reads above 100%.
      if (cell.scheduled || cell.isWork) required += 1;
      if (cell.isWork) covered += 1;
      days.push(cell.code);
    }

    const row: ScheduleGridRow = {
      employeeId: employee.id,
      employeeName: employee.name,
      initials: employee.initials,
      functionName: employee.function?.name ?? "—",
      // The label shows the parity the person follows IN THIS MONTH (it inverts after a
      // 31-day month), not the registered one.
      scheduleLabel: employee.parity
        ? `${workLetter(shiftConfig?.startHour) === "N" ? "Noturno" : "Diurno"} ${effectiveParity(employee.parity, employee.parityReferenceMonth, month) === "ODD" ? "ímpar" : "par"}`
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

  // Holiday columns are painted like the unit's sheet paints weekends (see xlsx-renderer).
  const holidays = holidaysOfMonth(year, monthNumber, ctx.operation.code);
  const grid: ScheduleGridData = { year, month: monthNumber, sections, holidays };
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
      const generatedResult = {
        grid: snapshot.grid,
        pendencies: snapshot.pendencies,
        metrics: snapshot.metrics
      };
      const row = await tx.scheduleVersion.create({
        data: {
          operationId,
          month: monthDate,
          version: (previous?.version ?? 0) + 1,
          generatedInput: json({ engine: "employee-schedule", hash: snapshot.hash, month }),
          generatedResult: json(generatedResult),
          contentHash: contentHashOf(json(generatedResult)),
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
