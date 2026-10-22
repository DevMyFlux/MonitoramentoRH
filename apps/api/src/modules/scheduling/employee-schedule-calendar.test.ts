/**
 * Holidays (painted like the reference sheet) and desligamento programado, through the real
 * schedule generation and XLSX renderer; only the database is faked.
 */
import ExcelJS from "exceljs";
import { getScheduleTemplate } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { employeeAvailability } from "./employee-availability.js";
import { buildEmployeeScheduleSnapshot } from "./employee-schedule-service.js";
import { renderScheduleWorkbook } from "./xlsx-renderer.js";

// Acesso a todas as unidades vem do escopo global, não do nome do perfil.
const user = { id: "u1", role: "DEV", permissions: [], scopes: [{ isGlobal: true }] } as unknown as AuthenticatedUser;

const shifts = [
  { code: "DIURNO", configuration: { startHour: 7, durationHours: 12, restHours: 36, weekdays: [0, 1, 2, 3, 4, 5, 6], minimumTeam: 0 } },
  { code: "COMERCIAL", configuration: { startHour: 8, durationHours: 9, restHours: 15, weekdays: [1, 2, 3, 4, 5], minimumTeam: 0 } }
];

function employee(
  name: string,
  shift: string,
  parity: "ODD" | "EVEN" | null,
  extra: { status?: string; terminationDate?: Date | null; admissionDate?: Date } = {}
) {
  return {
    id: `id-${name}`,
    name,
    initials: name.slice(0, 3).toUpperCase(),
    status: extra.status ?? "ACTIVE",
    admissionDate: extra.admissionDate ?? new Date("2020-01-01T00:00:00Z"),
    terminationDate: extra.terminationDate ?? null,
    shift,
    parity,
    parityReferenceMonth: null,
    functionId: null,
    function: null,
    council: null,
    notes: null,
    documents: [],
    competencies: [],
    calendarEvents: []
  };
}

function fakeDb(employees: ReturnType<typeof employee>[], unitCode = "HMB"): PrismaClient {
  return {
    operation: { findUnique: async () => ({ id: "op", code: unitCode, status: "ACTIVE", companyId: "c", unitId: "u" }) },
    employee: { findMany: async () => employees },
    operationalParameter: { findMany: async () => shifts.map((s) => ({ ...s, operationId: "op", kind: "SHIFT", status: "ACTIVE" })) },
    complianceRequirement: { findMany: async () => [] },
    competencyMatrixItem: { findMany: async () => [] },
    scheduleDayOverride: { findMany: async () => [] },
    leaveSubstitution: { findMany: async () => [] }
  } as unknown as PrismaClient;
}

const staff = [employee("Par Dia", "DIURNO", "EVEN"), employee("Impar Dia", "DIURNO", "ODD")];

describe("holidays in the generated schedule", () => {
  it("records the legal holidays of the month, with the unit's own dates for HMB", async () => {
    const oct = await buildEmployeeScheduleSnapshot(fakeDb(staff), user, "op", "2026-10");
    expect(oct.grid.holidays).toEqual([{ day: 12, name: "Nossa Senhora Aparecida" }]);
    const nov = await buildEmployeeScheduleSnapshot(fakeDb(staff), user, "op", "2026-11");
    expect(nov.grid.holidays!.map((h) => h.day)).toEqual([2, 15, 20]);
    const janHmb = await buildEmployeeScheduleSnapshot(fakeDb(staff, "HMB"), user, "op", "2027-01");
    const janHetrin = await buildEmployeeScheduleSnapshot(fakeDb(staff, "HETRIN"), user, "op", "2027-01");
    expect(janHmb.grid.holidays!.map((h) => h.day)).toEqual([1, 25]);
    expect(janHetrin.grid.holidays!.map((h) => h.day)).toEqual([1]);
  });

  it("only marks the day: the rotation and 5x2 weekdays are not changed by a holiday", async () => {
    const people = [...staff, employee("Comercial Um", "COMERCIAL", null)];
    const snapshot = await buildEmployeeScheduleSnapshot(fakeDb(people), user, "op", "2026-10");
    const rows = snapshot.grid.sections.flatMap((s) => s.rows);
    // Oct 12 (Mon): Par works, Ímpar rests, the commercial person works — same as any Monday/even day.
    expect(rows.find((r) => r.employeeName === "Par Dia")!.days[11]).toBe("D");
    expect(rows.find((r) => r.employeeName === "Impar Dia")!.days[11]).toBe("F");
    expect(rows.find((r) => r.employeeName === "Comercial Um")!.days[11]).toBe("D");
  });
});

describe("holidays painted like the unit's sheet", () => {
  async function sheetFor(unit: "HMB" | "HETRIN", month = "2026-10") {
    const snapshot = await buildEmployeeScheduleSnapshot(fakeDb(staff, unit), user, "op", month);
    const buffer = await renderScheduleWorkbook(snapshot.grid, getScheduleTemplate(unit));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const sheet = workbook.worksheets[0]!;
    let headerRow = 0;
    sheet.eachRow((row, rowNumber) => {
      if (!headerRow && row.getCell(1).value === "Nome") headerRow = rowNumber;
    });
    const fillOf = (rowNumber: number, day: number) => {
      const fill = sheet.getCell(rowNumber, 5 + day).fill as ExcelJS.FillPattern | undefined;
      return fill?.type === "pattern" ? fill.fgColor?.argb : undefined;
    };
    return { fillOf, headerRow, bodyRows: [headerRow + 2, headerRow + 3] };
  }

  it("HMB: the holiday column is shaded like a weekend column, header included (Oct 12, 2026)", async () => {
    const { fillOf, headerRow, bodyRows } = await sheetFor("HMB");
    expect(fillOf(headerRow, 12)).toBe("FFB4C6E7");
    for (const row of bodyRows) expect(fillOf(row, 12)).toBe("FFB4C6E7");
    // A weekend column (Sat Oct 3) is shaded the same way, and an ordinary Tuesday is not.
    expect(fillOf(headerRow, 3)).toBe("FFB4C6E7");
    for (const row of bodyRows) expect(fillOf(row, 3)).toBe("FFB4C6E7");
    expect(fillOf(headerRow, 13)).toBe("FFF2F2F2");
    for (const row of bodyRows) expect(fillOf(row, 13)).not.toBe("FFB4C6E7");
  });

  it("HETRIN: its reference sheet shades neither weekends nor holidays, so nothing extra is painted", async () => {
    const { fillOf, headerRow, bodyRows } = await sheetFor("HETRIN");
    expect(fillOf(headerRow, 12)).toBe("FFF2F2F2");
    for (const row of bodyRows) expect(fillOf(row, 12)).not.toBe("FFB4C6E7");
  });

  it("older schedules saved without a holidays list get their holidays painted from the calendar", async () => {
    const snapshot = await buildEmployeeScheduleSnapshot(fakeDb(staff), user, "op", "2026-10");
    const { holidays: _omitted, ...legacy } = snapshot.grid;
    void _omitted;
    const buffer = await renderScheduleWorkbook(legacy, getScheduleTemplate("HMB"));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const sheet = workbook.worksheets[0]!;
    let headerRow = 0;
    sheet.eachRow((row, rowNumber) => {
      if (!headerRow && row.getCell(1).value === "Nome") headerRow = rowNumber;
    });
    const header12 = sheet.getCell(headerRow, 5 + 12).fill as ExcelJS.FillPattern;
    expect(header12.fgColor?.argb).toBe("FFB4C6E7");
  });
});

describe("desligamento programado", () => {
  it("shows the person normally up to the last day of work and leaves the days after it blank", async () => {
    const leaving = employee("Saindo Par", "DIURNO", "EVEN", { terminationDate: new Date("2026-11-10T00:00:00Z") });
    const snapshot = await buildEmployeeScheduleSnapshot(fakeDb([leaving]), user, "op", "2026-11");
    const row = snapshot.grid.sections.flatMap((s) => s.rows)[0]!;
    // Registered Par in Oct -> Ímpar in Nov (Oct has 31 days): works odd days up to the 10th.
    expect(row.days.slice(0, 10)).toEqual(["D", "F", "D", "F", "D", "F", "D", "F", "D", "F"]);
    expect(row.days.slice(10).every((code) => code === "")).toBe(true);
    // The blank days are not pendencies and not part of the required coverage.
    expect(snapshot.pendencies).toEqual([]);
    expect(snapshot.metrics.required).toBe(5);
    expect(snapshot.metrics.covered).toBe(5);
  });

  it("the last day of work itself is still worked (inclusive)", async () => {
    const leaving = employee("Saindo Comercial", "COMERCIAL", null, { terminationDate: new Date("2026-11-10T00:00:00Z") });
    const snapshot = await buildEmployeeScheduleSnapshot(fakeDb([leaving]), user, "op", "2026-11");
    const row = snapshot.grid.sections.flatMap((s) => s.rows)[0]!;
    expect(row.days[9]).toBe("D"); // Tuesday Nov 10
    expect(row.days[10]).toBe("");
    // Nov 2-6 and Nov 9-10 = 7 weekdays.
    expect(snapshot.metrics.required).toBe(7);
  });

  it("an already-desligado person with a date still shows up to that date, without 'inactive' pendencies", async () => {
    const gone = employee("Ja Saiu", "COMERCIAL", null, { status: "TERMINATED", terminationDate: new Date("2026-11-10T00:00:00Z") });
    const snapshot = await buildEmployeeScheduleSnapshot(fakeDb([gone]), user, "op", "2026-11");
    const row = snapshot.grid.sections.flatMap((s) => s.rows)[0]!;
    expect(row.days.slice(0, 10)).toEqual(["F", "D", "D", "D", "D", "D", "F", "F", "D", "D"]);
    expect(row.days.slice(10).every((code) => code === "")).toBe(true);
    expect(snapshot.pendencies).toEqual([]);
  });

  it("availability: works through the last day, then AFTER_TERMINATION", () => {
    const base = {
      id: "e",
      status: "ACTIVE",
      admissionDate: "2020-01-01T00:00:00.000Z",
      terminationDate: "2026-11-10",
      parity: "ODD" as const
    };
    const input = { events: [], aptitude: { documentRequirements: [], competencyRequirements: [] }, shift: { weekdays: [0, 1, 2, 3, 4, 5, 6] } };
    expect(employeeAvailability({ ...input, employee: base, date: "2026-11-10" }).reasonCodes).not.toContain("AFTER_TERMINATION");
    expect(employeeAvailability({ ...input, employee: base, date: "2026-11-11" }).reasonCodes).toContain("AFTER_TERMINATION");
    // A desligado keeps counting as active up to its date, not after.
    const gone = { ...base, status: "TERMINATED" };
    expect(employeeAvailability({ ...input, employee: gone, date: "2026-11-10" }).reasonCodes).not.toContain("EMPLOYEE_INACTIVE");
    expect(employeeAvailability({ ...input, employee: gone, date: "2026-11-11" }).reasonCodes).toContain("EMPLOYEE_INACTIVE");
  });
});
