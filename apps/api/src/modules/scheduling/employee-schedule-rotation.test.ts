/**
 * End-to-end check of the Par/Ímpar month-turn rule through the real schedule
 * generation (buildEmployeeScheduleSnapshot) and the real XLSX renderer, with only
 * the database faked. Complements packages/shared/src/parity-rotation.test.ts, which
 * covers the pure calculation.
 */
import ExcelJS from "exceljs";
import { getScheduleTemplate } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEmployeeScheduleSnapshot } from "./employee-schedule-service.js";
import { renderScheduleWorkbook, type ScheduleGridRow } from "./xlsx-renderer.js";

const user = { id: "u1", role: "DEV", scopes: [] } as unknown as AuthenticatedUser;

const shifts = [
  { code: "DIURNO", configuration: { startHour: 7, durationHours: 12, restHours: 36, weekdays: [0, 1, 2, 3, 4, 5, 6], minimumTeam: 0 } },
  { code: "NOTURNO", configuration: { startHour: 19, durationHours: 12, restHours: 36, weekdays: [0, 1, 2, 3, 4, 5, 6], minimumTeam: 0 } },
  { code: "COMERCIAL", configuration: { startHour: 8, durationHours: 9, restHours: 15, weekdays: [1, 2, 3, 4, 5], minimumTeam: 0 } },
  { code: "ADMINISTRATIVO", configuration: { startHour: 7, durationHours: 10, restHours: 14, weekdays: [1, 2, 3, 4, 5], minimumTeam: 0 } }
];

function employee(
  name: string,
  shift: string,
  parity: "ODD" | "EVEN" | null,
  parityReferenceMonth: string | null = null
) {
  return {
    id: `id-${name}`,
    name,
    initials: name.slice(0, 3).toUpperCase(),
    status: "ACTIVE",
    admissionDate: new Date("2020-01-01T00:00:00Z"),
    shift,
    parity,
    parityReferenceMonth,
    functionId: null,
    function: null,
    council: null,
    notes: null,
    documents: [],
    competencies: [],
    calendarEvents: []
  };
}

function fakeDb(employees: ReturnType<typeof employee>[]): PrismaClient {
  return {
    operation: { findUnique: async () => ({ id: "op", status: "ACTIVE", companyId: "c", unitId: "u" }) },
    employee: { findMany: async () => employees },
    operationalParameter: { findMany: async () => shifts.map((s) => ({ ...s, operationId: "op", kind: "SHIFT", status: "ACTIVE" })) },
    complianceRequirement: { findMany: async () => [] },
    competencyMatrixItem: { findMany: async () => [] },
    scheduleDayOverride: { findMany: async () => [] }
  } as unknown as PrismaClient;
}

const staff = [
  employee("Impar Dia", "DIURNO", "ODD"),
  employee("Par Dia", "DIURNO", "EVEN"),
  employee("Impar Noite", "NOTURNO", "ODD"),
  employee("Comercial Um", "COMERCIAL", null)
];

async function generate(months: string[], employees = staff) {
  const db = fakeDb(employees);
  const rows = new Map<string, ScheduleGridRow[]>();
  for (const month of months) {
    const snapshot = await buildEmployeeScheduleSnapshot(db, user, "op", month);
    rows.set(month, snapshot.grid.sections.flatMap((section) => section.rows));
  }
  return rows;
}
const rowOf = (rows: Map<string, ScheduleGridRow[]>, month: string, name: string) =>
  rows.get(month)!.find((row) => row.employeeName === name)!;
const isWork = (code: string) => code === "D" || code === "N";

describe("schedule generation across consecutive months", () => {
  const months = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];

  it("alternates work and rest without gaps or double days over every month turn (including Dec -> Jan)", async () => {
    const rows = await generate(months);
    for (const name of ["Impar Dia", "Par Dia", "Impar Noite"]) {
      const codes = months.flatMap((month) => rowOf(rows, month, name).days);
      for (let i = 1; i < codes.length; i++) {
        expect(isWork(codes[i]!) !== isWork(codes[i - 1]!), `${name}: position ${i} (${codes[i - 1]} -> ${codes[i]})`).toBe(true);
      }
    }
  });

  it("puts exactly one of the two day-shift groups on duty each day (no duplicated or uncovered day)", async () => {
    const rows = await generate(months);
    for (const month of months) {
      const odd = rowOf(rows, month, "Impar Dia").days;
      const even = rowOf(rows, month, "Par Dia").days;
      odd.forEach((code, index) => expect(isWork(code) !== isWork(even[index]!), `${month}-${index + 1}`).toBe(true));
    }
  });

  it("applies the 31-day and 30-day examples of the rule on real generated grids", async () => {
    const rows = await generate(months);
    // 31-day month (Oct): Ímpar works 31 -> rests Nov 1 -> works Nov 2.
    expect(rowOf(rows, "2026-10", "Impar Dia").days[30]).toBe("D");
    expect(rowOf(rows, "2026-11", "Impar Dia").days.slice(0, 2)).toEqual(["F", "D"]);
    // 31-day month (Oct): Par works 30 -> rests 31 -> works Nov 1.
    expect(rowOf(rows, "2026-10", "Par Dia").days.slice(29, 31)).toEqual(["D", "F"]);
    expect(rowOf(rows, "2026-11", "Par Dia").days[0]).toBe("D");
    // 30-day month (Nov): the Par-in-November person (registered Ímpar in Oct) works 30 -> rests Dec 1 -> works Dec 2.
    expect(rowOf(rows, "2026-11", "Impar Dia").days[29]).toBe("D");
    expect(rowOf(rows, "2026-12", "Impar Dia").days.slice(0, 2)).toEqual(["F", "D"]);
    // 30-day month (Nov): the Ímpar-in-November person (registered Par in Oct) works 29 -> rests 30 -> works Dec 1.
    expect(rowOf(rows, "2026-11", "Par Dia").days.slice(28, 30)).toEqual(["D", "F"]);
    expect(rowOf(rows, "2026-12", "Par Dia").days[0]).toBe("D");
    // Dec -> Jan: Par-in-December works 30 -> rests 31 -> works Jan 1; Ímpar-in-December works 31 -> rests Jan 1 -> works Jan 2.
    expect(rowOf(rows, "2026-12", "Impar Dia").days[29]).toBe("D");
    expect(rowOf(rows, "2026-12", "Impar Dia").days[30]).toBe("F");
    expect(rowOf(rows, "2027-01", "Impar Dia").days[0]).toBe("D");
    expect(rowOf(rows, "2026-12", "Par Dia").days[30]).toBe("D");
    expect(rowOf(rows, "2027-01", "Par Dia").days.slice(0, 2)).toEqual(["F", "D"]);
  });

  it("labels each month with the parity the person follows in that month", async () => {
    const rows = await generate(months);
    const labels = months.map((month) => rowOf(rows, month, "Impar Dia").scheduleLabel);
    // Oct (31) inverts -> Nov par; Nov (30) keeps -> Dec par; Dec (31) inverts -> Jan impar;
    // Jan (31) inverts -> Feb par; Feb (28) keeps -> Mar par.
    expect(labels).toEqual(["Diurno ímpar", "Diurno par", "Diurno par", "Diurno ímpar", "Diurno par", "Diurno par"]);
    expect(rowOf(rows, "2026-11", "Impar Noite").scheduleLabel).toBe("Noturno par");
  });

  it("does not touch fixed-weekday (comercial) employees", async () => {
    const rows = await generate(months);
    for (const month of months) {
      const [year, monthNumber] = month.split("-").map(Number) as [number, number];
      const row = rowOf(rows, month, "Comercial Um");
      expect(row.scheduleLabel).toBe("Comercial");
      row.days.forEach((code, index) => {
        const weekday = new Date(Date.UTC(year, monthNumber - 1, index + 1)).getUTCDay();
        expect(code, `${month}-${index + 1}`).toBe(weekday >= 1 && weekday <= 5 ? "D" : "F");
      });
    }
  });

  it("keeps regenerated historical months (Sep/Oct 2026) identical to the old calendar-parity result", async () => {
    const rows = await generate(["2026-09", "2026-10"]);
    for (const month of ["2026-09", "2026-10"]) {
      rowOf(rows, month, "Impar Dia").days.forEach((code, index) => expect(code, `${month}-${index + 1}`).toBe((index + 1) % 2 === 1 ? "D" : "F"));
      rowOf(rows, month, "Par Dia").days.forEach((code, index) => expect(code, `${month}-${index + 1}`).toBe((index + 1) % 2 === 0 ? "D" : "F"));
    }
  });

  it("honours an explicit reference month recorded on the employee", async () => {
    // Registered as Ímpar for NOVEMBER: works odd days in Nov, and (Nov has 30 days) odd days in Dec too.
    const rows = await generate(["2026-11", "2026-12"], [employee("Ref Novembro", "DIURNO", "ODD", "2026-11")]);
    const nov = rowOf(rows, "2026-11", "Ref Novembro").days;
    const dec = rowOf(rows, "2026-12", "Ref Novembro").days;
    expect(nov[0]).toBe("D");
    expect(nov[28]).toBe("D");
    expect(nov[29]).toBe("F");
    expect(dec[0]).toBe("D");
    expect(dec[1]).toBe("F");
    expect(rowOf(rows, "2026-12", "Ref Novembro").scheduleLabel).toBe("Diurno ímpar");
  });
});

describe("employees added on the comercial (5x2) scale reach the schedule", () => {
  const people = [
    employee("Comercial Novo", "COMERCIAL", null),
    employee("Administrativo Novo", "ADMINISTRATIVO", null),
    employee("Escala 12x36", "DIURNO", "ODD")
  ];

  it("works Monday to Friday with the shift hours, weekends as rest, in every month", async () => {
    const months = ["2026-11", "2026-12", "2027-01"];
    const rows = await generate(months, people);
    for (const month of months) {
      const [year, monthNumber] = month.split("-").map(Number) as [number, number];
      for (const [name, hours] of [["Comercial Novo", "08:00–17:00"], ["Administrativo Novo", "07:00–17:00"]] as const) {
        const row = rowOf(rows, month, name);
        expect(row.hours).toBe(hours);
        expect(row.scheduleLabel).toBe("Comercial");
        row.days.forEach((code, index) => {
          const weekday = new Date(Date.UTC(year, monthNumber - 1, index + 1)).getUTCDay();
          expect(code, `${name} ${month}-${index + 1}`).toBe(weekday >= 1 && weekday <= 5 ? "D" : "F");
        });
      }
    }
  });

  it("is not affected by the Par/Ímpar turn of the month and does not disturb 12x36 people", async () => {
    const rows = await generate(["2026-10", "2026-11"], people);
    // Oct 30 (Fri) and Nov 2 (Mon) are workdays; Oct 31 (Sat) and Nov 1 (Sun) are rest — for 5x2 only the weekday matters.
    expect(rowOf(rows, "2026-10", "Comercial Novo").days.slice(29, 31)).toEqual(["D", "F"]);
    expect(rowOf(rows, "2026-11", "Comercial Novo").days.slice(0, 2)).toEqual(["F", "D"]);
    // The 12x36 person still follows the month-turn rule.
    expect(rowOf(rows, "2026-10", "Escala 12x36").days[30]).toBe("D");
    expect(rowOf(rows, "2026-11", "Escala 12x36").days.slice(0, 2)).toEqual(["F", "D"]);
  });

  it("lands in the DIURNO group and counts only weekdays as required coverage", async () => {
    const db = fakeDb([employee("Comercial Novo", "COMERCIAL", null)]);
    const snapshot = await buildEmployeeScheduleSnapshot(db, user, "op", "2026-11");
    expect(snapshot.grid.sections.map((section) => section.label)).toEqual(["DIURNO"]);
    // November 2026 has 21 weekdays (Mon-Fri).
    expect(snapshot.metrics).toMatchObject({ required: 21, covered: 21, coverage: 100 });
  });
});

describe("export (XLSX) uses the same calculation", () => {
  async function exportedRow(unit: "HMB" | "HETRIN", month: string, name: string) {
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    const db = fakeDb(staff);
    const snapshot = await buildEmployeeScheduleSnapshot(db, user, "op", month);
    const buffer = await renderScheduleWorkbook(snapshot.grid, getScheduleTemplate(unit));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const sheet = workbook.worksheets[0]!;
    let found: ExcelJS.Row | undefined;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === name) found = row;
    });
    const gridRow = snapshot.grid.sections.flatMap((s) => s.rows).find((r) => r.employeeName === name)!;
    expect(year).toBe(snapshot.grid.year);
    expect(monthNumber).toBe(snapshot.grid.month);
    return { row: found!, gridRow };
  }

  it("writes the inverted days and the current-month label on HETRIN's sheet (November)", async () => {
    const { row, gridRow } = await exportedRow("HETRIN", "2026-11", "Impar Dia");
    // Conselho column carries the schedule label for HETRIN: registered Ímpar in Oct -> Par in Nov.
    expect(row.getCell(4).value).toBe("DIURNO PAR");
    gridRow.days.forEach((code, index) => expect(row.getCell(6 + index).value, `day ${index + 1}`).toBe(code));
    expect(row.getCell(6).value).toBe("F");
    expect(row.getCell(7).value).toBe("D");
  });

  it("writes the same days on HMB's sheet, keeping its blank Conselho column", async () => {
    const { row, gridRow } = await exportedRow("HMB", "2026-11", "Par Dia");
    expect(row.getCell(4).value ?? "").toBe("");
    gridRow.days.forEach((code, index) => expect(row.getCell(6 + index).value, `day ${index + 1}`).toBe(code));
    expect(row.getCell(6).value).toBe("D"); // Par registered in Oct works Nov 1
  });
});
