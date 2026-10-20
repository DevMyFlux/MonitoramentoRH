/**
 * Holiday calendar used to paint holiday columns on the schedule (grid and XLSX).
 *
 * It is a calendar of LEGAL holidays only; "ponto facultativo" (Carnaval, Corpus Christi,
 * Quarta-feira de Cinzas…) is deliberately left out, because the hospitals do not stop
 * for it and painting it would mislead. Holidays never change who works: the 12x36
 * rotation and the 5x2 weekdays are untouched — a holiday is only marked.
 *
 *   - National: Confraternização Universal, Sexta-feira Santa, Tiradentes, Dia do Trabalho,
 *     Independência, Nossa Senhora Aparecida, Finados, Proclamação da República,
 *     Consciência Negra (national since 2024) and Natal.
 *   - Per unit (Operation.code): HMB is the Hospital Municipal da Brasilândia, in the city
 *     of São Paulo — Aniversário da cidade (25/01) and the state holiday of 9 de Julho.
 *     A unit with no entry here only gets the national holidays; add its state/municipal
 *     dates to `unitHolidays` (HETRIN's municipal/state dates were not provided).
 */

export type ScheduleHoliday = { day: number; name: string };

type FixedHoliday = { month: number; day: number; name: string };

const nationalHolidays: FixedHoliday[] = [
  { month: 1, day: 1, name: "Confraternização Universal" },
  { month: 4, day: 21, name: "Tiradentes" },
  { month: 5, day: 1, name: "Dia do Trabalho" },
  { month: 9, day: 7, name: "Independência do Brasil" },
  { month: 10, day: 12, name: "Nossa Senhora Aparecida" },
  { month: 11, day: 2, name: "Finados" },
  { month: 11, day: 15, name: "Proclamação da República" },
  { month: 11, day: 20, name: "Dia da Consciência Negra" },
  { month: 12, day: 25, name: "Natal" }
];

/** State/municipal holidays by unit code (Operation.code). */
const unitHolidays: Record<string, FixedHoliday[]> = {
  HMB: [
    { month: 1, day: 25, name: "Aniversário da Cidade de São Paulo" },
    { month: 7, day: 9, name: "Revolução Constitucionalista (feriado estadual)" }
  ]
};

/** Easter Sunday of a year (Meeus/Jones/Butcher algorithm), as { month, day }. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Sexta-feira Santa: two days before Easter. */
function goodFriday(year: number): { month: number; day: number } {
  const easter = easterSunday(year);
  const date = new Date(Date.UTC(year, easter.month - 1, easter.day - 2));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Holidays that fall in a month (1-12), sorted by day, for the given unit code. */
export function holidaysOfMonth(year: number, month: number, unitCode?: string | null): ScheduleHoliday[] {
  const fixed = [...nationalHolidays, ...(unitCode ? (unitHolidays[unitCode] ?? []) : [])];
  const found: ScheduleHoliday[] = fixed.filter((h) => h.month === month).map((h) => ({ day: h.day, name: h.name }));
  const friday = goodFriday(year);
  if (friday.month === month) found.push({ day: friday.day, name: "Sexta-feira Santa" });
  return found.sort((a, b) => a.day - b.day);
}
