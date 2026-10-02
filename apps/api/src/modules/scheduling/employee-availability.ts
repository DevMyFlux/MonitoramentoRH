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
 * and adds the one genuinely new rule this flow needs: day-of-month parity.
 *
 * Everything here is a pure function — no Prisma, no I/O. The caller (the
 * Fase 6 generation service) fetches employees, shift parameters, events and
 * requirements once per month and calls employeeAvailability() per employee
 * per day.
 */
import {
  calculateAptitude,
  type AptitudeInput
} from "../aptitude/aptitude-service.js";
import { calculateAvailability, type AvailabilityEvent } from "../calendar/availability-service.js";

export type EmployeeParityGroup = "ODD" | "EVEN";

export type EmployeeScheduleProfile = {
  id: string;
  status: string;
  /** ISO datetime, or null when the employee has no recorded admission yet. */
  admissionDate: string | null;
  /** Day-of-month rotation group; null for fixed-weekday staff (e.g. commercial/admin). */
  parity: EmployeeParityGroup | null;
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
   * EventType.code of whichever absence(s) block this day (e.g. "AT", "FR").
   * Lets the caller (Fase 6 generation) show the specific leave letter instead
   * of a generic rest/work code, without re-deriving the overlap itself.
   */
  blockingEventTypeCodes: string[];
};

/**
 * Day-of-month parity check for the 1-on-1-off rotations used by both reference
 * schedules (HETRIN and HMB): day 1 is "odd", and the rotation runs through
 * weekends with no gap — it does not follow the calendar week at all.
 */
export function isParityWorkday(parity: EmployeeParityGroup, date: string): boolean {
  const day = Number(date.slice(8, 10));
  return parity === "ODD" ? day % 2 === 1 : day % 2 === 0;
}

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
  employee: Pick<EmployeeScheduleProfile, "parity">,
  date: string,
  shift: ShiftDayRule
): boolean {
  return employee.parity
    ? isParityWorkday(employee.parity, date)
    : isWeekdayWorkday(shift.weekdays, date);
}

export function employeeAvailability(input: EmployeeAvailabilityInput): EmployeeAvailabilityResult {
  const { employee, date, shift, events, aptitude } = input;
  const reasons: string[] = [];

  // SCHEDULED_ADMISSION is not a block by itself — it means "not started yet",
  // which admissionDate already expresses precisely below. Nothing flips this
  // status to ACTIVE automatically once the date arrives, so treating it the
  // same as ACTIVE here (and only here) is what makes a future hire become
  // schedulable on their real admission date without manual intervention.
  if (employee.status !== "ACTIVE" && employee.status !== "SCHEDULED_ADMISSION") {
    reasons.push("EMPLOYEE_INACTIVE");
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
  }

  return {
    scheduled,
    available: reasons.length === 0,
    reasonCodes: reasons,
    blockingEventTypeCodes
  };
}
