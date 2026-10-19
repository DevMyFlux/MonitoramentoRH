/**
 * What kind of schedule a shift parameter drives, read from its own configuration
 * (OperationalParameter.configuration), so no shift code is hard-coded anywhere:
 *
 *   - Rotation shifts (Diurno / Noturno, 12x36) list every weekday (0-6): the person
 *     alternates work/rest days following Par/Ímpar (parity-rotation.ts).
 *   - Weekday-only shifts (Comercial / Administrativo, 5x2) list only some weekdays and
 *     never Saturday/Sunday: the person works those weekdays and has no Par/Ímpar.
 */
export type ShiftPatternConfig =
  | { weekdays?: readonly number[] | null; startHour?: number | null; durationHours?: number | null }
  | null
  | undefined;

/** True for a fixed-weekday shift without weekends (5x2 — e.g. Comercial, Administrativo). */
export function isWeekdayOnlyShift(config: ShiftPatternConfig): boolean {
  const weekdays = config?.weekdays;
  return Array.isArray(weekdays) && weekdays.length > 0 && !weekdays.includes(0) && !weekdays.includes(6);
}

const weekdayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "segunda a sexta" for Mon-Fri, otherwise "segunda, quarta e sexta". */
export function describeShiftWeekdays(config: ShiftPatternConfig): string {
  const days = [...(config?.weekdays ?? [])].sort((a, b) => a - b);
  if (!days.length) return "";
  const contiguous = days.every((day, index) => index === 0 || day === days[index - 1]! + 1);
  if (contiguous && days.length > 2) return `${weekdayNames[days[0]!]} a ${weekdayNames[days[days.length - 1]!]}`;
  const names = days.map((day) => weekdayNames[day]!);
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** "08:00–17:00", or "" when the shift has no hours. */
export function shiftHoursText(config: ShiftPatternConfig): string {
  if (config?.startHour == null || config.durationHours == null) return "";
  const pad = (value: number) => String(Math.floor(value)).padStart(2, "0");
  return `${pad(config.startHour)}:00–${pad((config.startHour + config.durationHours) % 24)}:00`;
}
