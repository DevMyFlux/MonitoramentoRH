/**
 * Par/Ímpar (1-on-1-off) rotation with month-turn continuity.
 *
 * The rotation is a continuous "work a day, rest a day" cycle. Looking at a single
 * month it is the calendar-day parity (Ímpar works days 1, 3, 5…; Par works 2, 4,
 * 6…), but the calendar parity alone breaks the cycle at the turn of a month that
 * ends on an odd day: someone who works day 31 would also work day 1. The business
 * rule that keeps the cycle intact is:
 *
 *   - Month with 31 days  → the classification INVERTS at the turn.
 *       Ímpar worked day 31 → rests day 1 → works day 2 (follows Par next month).
 *       Par worked day 30   → rests day 31 → works day 1 (follows Ímpar next month).
 *   - Month with 30 days  → the classification is KEPT at the turn.
 *       Par worked day 30   → rests day 1 → works day 2 (stays Par).
 *       Ímpar worked day 29 → rests day 30 → works day 1 (stays Ímpar).
 *
 * An employee's registered parity (Employee.parity) is therefore only meaningful
 * relative to a REFERENCE MONTH — the month in which that classification is true
 * (Employee.parityReferenceMonth). For any other month the effective parity is the
 * registered one flipped once for every 31-day month crossed between the reference
 * month and the target month (in either direction, so older months can be
 * regenerated consistently too).
 *
 * February is not covered by the business rule, so it keeps the behaviour the system
 * already had: it never inverts. For a 28-day February that is also exactly what the
 * continuous cycle requires. For a 29-day (leap) February it is NOT — Ímpar would
 * work day 29 and day 1 — and that case is an open business decision (see
 * docs/escalas-par-impar.md); `monthInvertsParity` is the single place to change.
 *
 * Pure functions only: no I/O, no clock unless `now` is injected.
 */

export type ParityGroup = "ODD" | "EVEN";

/**
 * Reference month assumed for employees whose parity was registered before the
 * reference month existed (parityReferenceMonth = null): the month of the first
 * schedules generated in production (outubro/2026). September has 30 days, so
 * generating September gives the same result as October did before this rule.
 */
export const DEFAULT_PARITY_REFERENCE_MONTH = "2026-10";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseMonth(value: string): { year: number; month: number } {
  const match = MONTH_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid month "${value}" (expected YYYY-MM)`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isValidMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

/**
 * Whether the Par/Ímpar classification inverts when this month turns into the next
 * one. True only for months with 31 days; 30-day months keep the classification and
 * February keeps the pre-existing behaviour (no inversion).
 */
export function monthInvertsParity(year: number, month: number): boolean {
  return daysInMonth(year, month) === 31;
}

/** Number of months with an inversion in [from, to) — order-insensitive. */
export function parityInversionsBetween(fromMonth: string, toMonth: string): number {
  const a = parseMonth(fromMonth);
  const b = parseMonth(toMonth);
  const start = Math.min(a.year * 12 + a.month - 1, b.year * 12 + b.month - 1);
  const end = Math.max(a.year * 12 + a.month - 1, b.year * 12 + b.month - 1);
  let count = 0;
  for (let index = start; index < end; index++) {
    if (monthInvertsParity(Math.floor(index / 12), (index % 12) + 1)) count += 1;
  }
  return count;
}

/**
 * The parity group an employee follows in `targetMonth`, given the group registered
 * for `referenceMonth` (defaults to DEFAULT_PARITY_REFERENCE_MONTH when unknown).
 */
export function effectiveParity(
  registered: ParityGroup,
  referenceMonth: string | null | undefined,
  targetMonth: string
): ParityGroup {
  const inversions = parityInversionsBetween(referenceMonth || DEFAULT_PARITY_REFERENCE_MONTH, targetMonth);
  if (inversions % 2 === 0) return registered;
  return registered === "ODD" ? "EVEN" : "ODD";
}

/** Whether an employee on the registered parity works on `date` (YYYY-MM-DD). */
export function isParityWorkday(
  registered: ParityGroup,
  date: string,
  referenceMonth?: string | null
): boolean {
  const group = effectiveParity(registered, referenceMonth, date.slice(0, 7));
  const day = Number(date.slice(8, 10));
  return group === "ODD" ? day % 2 === 1 : day % 2 === 0;
}

/** Current month (YYYY-MM) on the São Paulo calendar, which is the one the business uses. */
export function currentMonthInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  return `${year}-${month}`;
}
