/**
 * Centralized catalog of schedule-grid letter codes.
 *
 * These codes come from the two reference spreadsheets (HETRIN and HMB) and are
 * shared by both units — the legend text is identical in both files. Treat this
 * as the single source of truth: the day-override API, the schedule engine and
 * the xlsx renderer must all read from here instead of hard-coding letters.
 *
 * `category`:
 * - "LEAVE": an absence that should also exist as a CalendarEvent (blocks the
 *   employee from being scheduled automatically for the whole event period).
 * - "REST": a day off that is a normal part of the rotation, not an absence.
 * - "WORK": the employee is on duty; which shift/period they are working.
 *
 * `color` mirrors the conditional-formatting rules found in both reference
 * files (identical font color/weight and, for "C", a light fill) — kept here so
 * the xlsx renderer and the web UI never have to re-derive it.
 */

export type ScheduleCodeCategory = "LEAVE" | "REST" | "WORK";

export type ScheduleCode = {
  code: string;
  label: string;
  category: ScheduleCodeCategory;
  /** True when this code means the employee is not available to be scheduled that day. */
  blocksAvailability: boolean;
  color?: {
    font: string;
    bold: boolean;
    fill?: string;
  };
};

export const scheduleCodes: ScheduleCode[] = [
  { code: "FR", label: "Férias", category: "LEAVE", blocksAvailability: true },
  { code: "LN", label: "Licença Nojo", category: "LEAVE", blocksAvailability: true },
  { code: "LG", label: "Licença Gala", category: "LEAVE", blocksAvailability: true },
  { code: "LM", label: "Licença Maternidade", category: "LEAVE", blocksAvailability: true },
  { code: "LP", label: "Licença Paternidade", category: "LEAVE", blocksAvailability: true },
  { code: "AT", label: "Atestado", category: "LEAVE", blocksAvailability: true },
  { code: "LMA", label: "Licença Médica", category: "LEAVE", blocksAvailability: true },
  { code: "F", label: "Folga", category: "REST", blocksAvailability: false, color: { font: "7F7F7F", bold: false } },
  { code: "FE", label: "Folga Saúde", category: "REST", blocksAvailability: false },
  { code: "FA", label: "Day Off", category: "REST", blocksAvailability: false },
  { code: "BH", label: "Folga Banco de Horas", category: "REST", blocksAvailability: false },
  {
    code: "C",
    label: "Cobertura",
    category: "WORK",
    blocksAvailability: false,
    color: { font: "9C6500", bold: true, fill: "FFF2CC" }
  },
  { code: "M", label: "Manhã", category: "WORK", blocksAvailability: false },
  { code: "T", label: "Tarde", category: "WORK", blocksAvailability: false },
  { code: "D", label: "Diurno", category: "WORK", blocksAvailability: false, color: { font: "1F4E78", bold: true } },
  { code: "N", label: "Noturno", category: "WORK", blocksAvailability: false, color: { font: "7030A0", bold: true } }
];

export const scheduleCodeMap: Record<string, ScheduleCode> = Object.fromEntries(
  scheduleCodes.map((entry) => [entry.code, entry])
);

export function isScheduleCode(value: string): boolean {
  return value in scheduleCodeMap;
}
