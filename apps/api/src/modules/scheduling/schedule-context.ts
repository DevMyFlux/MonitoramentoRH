/**
 * Contexto e regras de uma célula da escala (colaborador × dia), compartilhados pela GERAÇÃO e pela VALIDAÇÃO de
 * edições. Existe para que as duas usem exatamente a mesma lógica: se alguém recalcular as pendências de uma grade
 * já gerada (sem edição), precisa obter o mesmo resultado da geração — há um teste que garante isso.
 */
import { scheduleCodeMap } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { Prisma, PrismaClient, ScheduleDayOverride } from "@prisma/client";
import type { z } from "zod";
import { scopedOperation } from "../identity/access.js";
import {
  employeeAvailability,
  type EmployeeAvailabilityResult,
  type EmployeeScheduleProfile
} from "./employee-availability.js";
import { calendarConfigSchema } from "./monthly-service.js";
import { daysInMonth } from "./xlsx-renderer.js";

export type CalendarConfig = z.infer<typeof calendarConfigSchema>;

export type ContextEmployee = Prisma.EmployeeGetPayload<{
  include: {
    function: true;
    documents: true;
    competencies: true;
    calendarEvents: { include: { type: true } };
  };
}>;

/** Substituição ativa que toca o mês (com o afastamento a que está vinculada e o nome das pessoas). */
export type ContextSubstitution = Prisma.LeaveSubstitutionGetPayload<{
  include: {
    leaveEvent: true;
    titular: { select: { name: true } };
    substitute: { select: { name: true } };
  };
}>;

export type ScheduleContext = {
  operation: Awaited<ReturnType<typeof scopedOperation>>;
  month: string;
  year: number;
  monthNumber: number;
  first: Date;
  last: Date;
  dayCount: number;
  employees: ContextEmployee[];
  shiftByCode: Map<string, CalendarConfig>;
  documentRequirements: Prisma.ComplianceRequirementGetPayload<object>[];
  competencyMatrix: Prisma.CompetencyMatrixItemGetPayload<object>[];
  overrides: ScheduleDayOverride[];
  overrideByKey: Map<string, ScheduleDayOverride>;
  /** Substituições ativas (em ordem de criação) cujo afastamento toca este mês; o plano sai de `coverageOf(ctx)`. */
  substitutionRows: ContextSubstitution[];
};

export function monthRange(month: string): {
  year: number;
  monthNumber: number;
  first: Date;
  last: Date;
} {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return {
    year,
    monthNumber,
    first: new Date(Date.UTC(year, monthNumber - 1, 1)),
    last: new Date(Date.UTC(year, monthNumber - 1, daysInMonth(year, monthNumber), 23, 59, 59))
  };
}

/** Rough day/night letter from the shift's configured start hour (07:00 -> D, 19:00 -> N). */
export function workLetter(startHour: number | undefined): string {
  if (startHour === undefined) return "D";
  return startHour >= 18 || startHour < 5 ? "N" : "D";
}

export function hoursLabel(
  config: { startHour: number; durationHours: number } | undefined
): string {
  if (!config) return "";
  const end = (config.startHour + config.durationHours) % 24;
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${pad(config.startHour)}:00–${pad(end)}:00`;
}

export const isWorkCode = (code: string): boolean => scheduleCodeMap[code]?.category === "WORK";
export const isLeaveCode = (code: string): boolean => scheduleCodeMap[code]?.category === "LEAVE";

/**
 * Carrega tudo o que a escala de uma unidade/mês precisa. Sem `onlyEmployeeIds`, vale a regra da geração (quem entra
 * na escala do mês); com ele, carrega exatamente essas pessoas — usado para revalidar uma grade que já existe.
 */
export async function loadScheduleContext(
  db: PrismaClient,
  user: AuthenticatedUser,
  operationId: string,
  month: string,
  options: { onlyEmployeeIds?: string[] } = {}
): Promise<ScheduleContext> {
  const operation = await scopedOperation(db, user, operationId);
  const { year, monthNumber, first, last } = monthRange(month);
  const dayCount = daysInMonth(year, monthNumber);

  const employees = await db.employee.findMany({
    // SCHEDULED_ADMISSION must stay in the query even though these people are not
    // working yet: employeeAvailability() is what actually gates them day-by-day
    // via admissionDate. Filtering to status:"ACTIVE" alone silently dropped them
    // from the whole sheet, before or after their real admission date.
    // Desligamento: until its last day of work a person is on the schedule — also when
    // already marked Desligado (it still belongs to the month it left in). A person whose
    // termination date is before this month has nothing left to show, so is left out.
    where: options.onlyEmployeeIds
      ? { operationId, id: { in: options.onlyEmployeeIds } }
      : {
          operationId,
          recordStatus: "ACTIVE",
          AND: [
            { OR: [{ terminationDate: null }, { terminationDate: { gte: first } }] },
            {
              OR: [
                { status: { in: ["ACTIVE", "SCHEDULED_ADMISSION"] } },
                { status: "TERMINATED", terminationDate: { not: null } }
              ]
            }
          ]
        },
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

  // Substituições ativas: só valem enquanto o afastamento a que estão ligadas continuar ativo.
  const substitutionRows = await db.leaveSubstitution.findMany({
    where: {
      operationId,
      status: "ACTIVE",
      leaveEvent: { status: "ACTIVE", startsAt: { lte: last }, endsAt: { gte: first } }
    },
    include: {
      leaveEvent: true,
      titular: { select: { name: true } },
      substitute: { select: { name: true } }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  return {
    operation,
    month,
    year,
    monthNumber,
    first,
    last,
    dayCount,
    employees,
    shiftByCode,
    documentRequirements,
    competencyMatrix,
    overrides,
    overrideByKey,
    substitutionRows
  };
}

export type PreparedEmployee = {
  employee: ContextEmployee;
  shiftConfig: CalendarConfig | undefined;
  /** Tem turno configurado ou rodízio: sem isso não há como montar a escala dele. */
  configured: boolean;
  profile: EmployeeScheduleProfile;
  events: Parameters<typeof employeeAvailability>[0]["events"];
  aptitude: Parameters<typeof employeeAvailability>[0]["aptitude"];
};

export function prepareEmployee(ctx: ScheduleContext, employee: ContextEmployee): PreparedEmployee {
  const shiftConfig = employee.shift ? ctx.shiftByCode.get(employee.shift) : undefined;
  const profile: EmployeeScheduleProfile = {
    id: employee.id,
    status: employee.status,
    admissionDate: employee.admissionDate?.toISOString() ?? null,
    terminationDate: employee.terminationDate?.toISOString().slice(0, 10) ?? null,
    parity: employee.parity,
    parityReferenceMonth: employee.parityReferenceMonth
  };
  const events = employee.calendarEvents.map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    type: {
      code: event.type.code,
      name: event.type.name,
      blocksAvailability: event.type.blocksAvailability
    }
  }));
  const aptitude = {
    documentRequirements: ctx.documentRequirements
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
    competencyRequirements: ctx.competencyMatrix
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
  return {
    employee,
    shiftConfig,
    configured: Boolean(employee.parity || shiftConfig),
    profile,
    events,
    aptitude
  };
}

const preparedCache = new WeakMap<ScheduleContext, Map<string, PreparedEmployee>>();

/** Colaborador preparado (turno, afastamentos, aptidão), calculado uma vez por contexto; `undefined` se não está nele. */
export function prepareById(
  ctx: ScheduleContext,
  employeeId: string
): PreparedEmployee | undefined {
  let cache = preparedCache.get(ctx);
  if (!cache) preparedCache.set(ctx, (cache = new Map()));
  const hit = cache.get(employeeId);
  if (hit) return hit;
  const employee = ctx.employees.find((e) => e.id === employeeId);
  if (!employee) return undefined;
  const prep = prepareEmployee(ctx, employee);
  cache.set(employeeId, prep);
  return prep;
}

export function availabilityOn(prep: PreparedEmployee, date: string): EmployeeAvailabilityResult {
  return employeeAvailability({
    employee: prep.profile,
    date,
    shift: { weekdays: prep.shiftConfig?.weekdays ?? [] },
    events: prep.events,
    aptitude: prep.aptitude
  });
}

export type CellPendency = {
  reasonCodes: string[];
  details?: Array<{ code: string; message: string }>;
};

export type CellEvaluation = {
  code: string;
  /** A regra (rodízio/dias da semana) coloca a pessoa de plantão neste dia. */
  scheduled: boolean;
  isWork: boolean;
  pendency: CellPendency | null;
  availability: EmployeeAvailabilityResult;
  /** O `C` desta célula vem de uma substituição (e não de um ajuste manual): o dia do titular já foi contado como necessário. */
  substitution: boolean;
};

/**
 * Avalia UMA célula. Sem `storedCode`, deriva o código pelas regras (é o que a geração faz); com `storedCode`, aceita o
 * código que já está na grade e só refaz a contabilidade (pendência, necessário/coberto) — é o que a revalidação faz.
 * Ajustes manuais (override) valem sobre tudo e não geram pendência automática. `null` = célula em branco que não conta.
 * `coverage` = uma substituição planejou a Cobertura (`C`) neste dia para esta pessoa: o planejador já conferiu a
 * disponibilidade, então o dia de folga do rodízio não vira pendência. O ajuste manual continua valendo sobre ela.
 */
export function evaluateCell(
  prep: PreparedEmployee,
  date: string,
  override: Pick<ScheduleDayOverride, "code"> | undefined,
  storedCode?: string,
  coverage = false
): CellEvaluation | null {
  if (!prep.configured) return null;
  const availability = availabilityOn(prep, date);
  const { profile } = prep;
  const notYetAdmitted = Boolean(
    profile.admissionDate && profile.admissionDate.slice(0, 10) > date
  );
  const afterTermination = Boolean(profile.terminationDate && date > profile.terminationDate);

  let code: string;
  let pendency: CellPendency | null = null;

  if (override) {
    code = override.code;
  } else if (storedCode !== undefined) {
    code = storedCode;
    if (afterTermination && code === "") return null;
    if (coverage && code === "C") {
      // Cobertura de substituição: válida por construção (ver o planejador).
    } else if (code === "" && notYetAdmitted && availability.scheduled) {
      pendency = { reasonCodes: ["FUTURE_ADMISSION"] };
    } else if (isWorkCode(code) && !availability.available) {
      pendency = pendencyOf(availability);
    }
  } else if (coverage) {
    code = "C";
  } else if (afterTermination) {
    // Desligamento (programado ou efetivo): after the last day of work the person is no
    // longer on the team — blank day, no pendency, and not counted as required coverage.
    return null;
  } else if (notYetAdmitted) {
    // Blank (not a work letter) either way — but only surface a pendency
    // when the rotation would actually have put them on duty; an
    // off-rotation day before admission needed no coverage.
    code = "";
    if (availability.scheduled) pendency = { reasonCodes: ["FUTURE_ADMISSION"] };
  } else if (availability.blockingEventTypeCodes.length) {
    // An absence (férias/atestado/...) blocks every day of its own date
    // range, regardless of whether the day-of-month rotation would have
    // scheduled a shift or a rest day that day — checked before
    // `!result.scheduled` so a leave doesn't alternate with plain "F" on
    // the person's normal off-days within the same leave period.
    code = availability.blockingEventTypeCodes[0]!;
  } else if (!availability.scheduled) {
    code = "F";
  } else {
    code = workLetter(prep.shiftConfig?.startHour);
    if (!availability.available) pendency = pendencyOf(availability);
  }

  return {
    code,
    scheduled: availability.scheduled,
    isWork: isWorkCode(code),
    pendency,
    availability,
    substitution: coverage && !override && code === "C"
  };
}

function pendencyOf(availability: EmployeeAvailabilityResult): CellPendency {
  return {
    reasonCodes: availability.reasonCodes,
    ...(availability.reasonDetails.length ? { details: availability.reasonDetails } : {})
  };
}

/** O que a regra (sem ajuste manual) colocaria nesta célula — referência para saber se uma edição foge do rodízio. */
export function ruleCodeFor(prep: PreparedEmployee, date: string): string {
  return evaluateCell(prep, date, undefined)?.code ?? "";
}
