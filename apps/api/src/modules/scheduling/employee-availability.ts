/**
 * Availability engine for the Colaboradores/Escalas flow (Fase 4).
 *
 * This is intentionally a separate, decoupled engine from operational-engine.ts,
 * which stays as-is for the hidden QLP → Posição pipeline. Per the Fase 0/1
 * decision, this module's schedule generation (Fase 6) reads directly from
 * Employee attributes instead of requiring an approved QLP position — see the
 * chat history for the reasoning. It reuses the existing pure engines instead
 * of duplicating their rules:
 *   - calculateAvailability() (afastamentos / CalendarEvent overlap)
 *   - calculateAptitude() (documents / competencies)
 * and adds the one genuinely new rule this flow needs: the Par/Ímpar rotation
 * (parity-rotation.ts in @my-flux/shared — calendar-day parity plus the 30/31-day
 * month-turn continuity).
 *
 * Everything here is a pure function — no Prisma, no I/O. The caller (the
 * Fase 6 generation service) fetches employees, shift parameters, events and
 * requirements once per month and calls employeeAvailability() per employee
 * per day.
 */
import { isParityWorkday, type ParityGroup } from "@my-flux/shared";
import {
  calculateAptitude,
  type AptitudeInput
} from "../aptitude/aptitude-service.js";
import { calculateAvailability, type AvailabilityEvent } from "../calendar/availability-service.js";

export type EmployeeParityGroup = ParityGroup;

// The Par/Ímpar rule (with the month-turn continuity) lives in @my-flux/shared so the
// API and the web read the exact same calculation. Re-exported for existing callers.
export { isParityWorkday };

export type EmployeeScheduleProfile = {
  id: string;
  status: string;
  /** ISO datetime, or null when the employee has no recorded admission yet. */
  admissionDate: string | null;
  /** Last day of work (YYYY-MM-DD or ISO datetime) when a desligamento is planned or done; null = none. */
  terminationDate?: string | null;
  /** Day-of-month rotation group; null for fixed-weekday staff (e.g. commercial/admin). */
  parity: EmployeeParityGroup | null;
  /**
   * Month (YYYY-MM) in which `parity` is true. The effective parity of any other
   * month follows the 30/31-day turn rule (see @my-flux/shared parity-rotation).
   * Null/absent = DEFAULT_PARITY_REFERENCE_MONTH.
   */
  parityReferenceMonth?: string | null;
};

export type ShiftDayRule = {
  /** 0 = Sunday .. 6 = Saturday. Only consulted for employees without a parity group. */
  weekdays: number[];
};

export type EmployeeAvailabilityInput = {
  employee: EmployeeScheduleProfile;
  /** Calendar day being evaluated, as YYYY-MM-DD. */
  date: string;
  shift: ShiftDayRule;
  events: AvailabilityEvent[];
  aptitude: AptitudeInput;
};

export type EmployeeAvailabilityResult = {
  /** Whether the rotation/weekday rule puts this employee on duty this day at all. */
  scheduled: boolean;
  /** scheduled AND not blocked by status, admission, an absence or aptitude. */
  available: boolean;
  reasonCodes: string[];
  /**
   * Frases já legíveis das regras de origem (ex.: "NR-10 ausente ou vencido.", "Férias: Férias"), cada uma com o
   * código a que pertence. Só apoiam a mensagem amigável; o contrato continua sendo `reasonCodes`.
   */
  reasonDetails: Array<{ code: string; message: string }>;
  /**
   * EventType.code of whichever absence(s) block this day (e.g. "AT", "FR").
   * Lets the caller (Fase 6 generation) show the specific leave letter instead
   * of a generic rest/work code, without re-deriving the overlap itself.
   */
  blockingEventTypeCodes: string[];
};

/** True when the shift's fixed weekday pattern (e.g. Mon-Fri) covers this date. */
export function isWeekdayWorkday(weekdays: number[], date: string): boolean {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekdays.includes(weekday);
}

/**
 * Whether the rotation places this employee on duty on this calendar day, before
 * considering status, admission or absences.
 */
export function isScheduledDay(
  employee: Pick<EmployeeScheduleProfile, "parity" | "parityReferenceMonth">,
  date: string,
  shift: ShiftDayRule
): boolean {
  return employee.parity
    ? isParityWorkday(employee.parity, date, employee.parityReferenceMonth)
    : isWeekdayWorkday(shift.weekdays, date);
}

export function employeeAvailability(input: EmployeeAvailabilityInput): EmployeeAvailabilityResult {
  const { employee, date, shift, events, aptitude } = input;
  const reasons: string[] = [];
  const details: Array<{ code: string; message: string }> = [];

  // SCHEDULED_ADMISSION is not a block by itself — it means "not started yet",
  // which admissionDate already expresses precisely below. Nothing flips this
  // status to ACTIVE automatically once the date arrives, so treating it the
  // same as ACTIVE here (and only here) is what makes a future hire become
  // schedulable on their real admission date without manual intervention.
  // A desligado (or a planned desligamento) still counts up to its last day of work.
  const terminationDay = employee.terminationDate ? employee.terminationDate.slice(0, 10) : null;
  const activeOnDate =
    employee.status === "ACTIVE" ||
    employee.status === "SCHEDULED_ADMISSION" ||
    (employee.status === "TERMINATED" && terminationDay !== null && date <= terminationDay);
  if (!activeOnDate) {
    reasons.push("EMPLOYEE_INACTIVE");
  }
  if (terminationDay !== null && date > terminationDay) {
    reasons.push("AFTER_TERMINATION");
  }
  if (!employee.admissionDate || employee.admissionDate.slice(0, 10) > date) {
    reasons.push("FUTURE_ADMISSION");
  }

  const scheduled = isScheduledDay(employee, date, shift);
  if (!scheduled) {
    reasons.push("OFF_ROTATION_DAY");
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const availability = calculateAvailability(events, { startsAt: dayStart, endsAt: dayEnd });
  if (!availability.available) {
    reasons.push(...availability.reasonCodes);
    details.push(...availability.reasons.map((reason) => ({ code: reason.code, message: reason.message })));
  }
  const blockingEventTypeCodes = availability.reasons
    .map((reason) => events.find((event) => event.id === reason.eventId)?.type.code)
    .filter((code): code is string => Boolean(code));

  // Same policy as operational-engine.ts#eligibility: any non-GREEN aptitude
  // (including YELLOW, an expiring-soon warning) blocks the assignment, not
  // only RED. Kept consistent rather than reinterpreted here.
  const aptitudeResult = calculateAptitude({ ...aptitude, today: dayEnd });
  if (aptitudeResult.status !== "GREEN") {
    reasons.push(...aptitudeResult.reasonCodes);
    details.push(...aptitudeResult.reasons.map((reason) => ({ code: reason.code, message: reason.message })));
  }

  return {
    scheduled,
    available: reasons.length === 0,
    reasonCodes: reasons,
    reasonDetails: details,
    blockingEventTypeCodes
  };
}
