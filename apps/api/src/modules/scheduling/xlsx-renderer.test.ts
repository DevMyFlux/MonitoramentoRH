import ExcelJS from "exceljs";
import { getScheduleTemplate } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  monthNameTitleCase,
  renderScheduleWorkbook,
  scheduleFileName,
  type ScheduleGridData
} from "./xlsx-renderer.js";

// exceljs's own .d.ts resolves `Buffer` against a different @types/node copy than
// this workspace's root one, so TS sees them as incompatible nominal types even
// though they are the same Buffer at runtime. Narrow cast, contained to this
// test-only helper — the renderer itself never calls .load().
async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  return workbook;
}

function sampleData(): ScheduleGridData {
  const dayCount = daysInMonth(2026, 10);
  const oddDays = (letter: string, off: string) =>
    Array.from({ length: dayCount }, (_, i) => ((i + 1) % 2 === 1 ? letter : off));

  return {
    year: 2026,
    month: 10,
    sections: [
      {
        label: "DIURNO",
        rows: [
          {
            employeeId: "11111111-1111-4111-8111-111111111111",
            employeeName: "Colaborador Teste Um",
            initials: "CTU",
            functionName: "Eletricista",
            scheduleLabel: "Diurno ímpar",
            council: null,
            hours: "07:00–19:00",
            days: oddDays("D", "F"),
            observation: null
          }
        ]
      }
    ]
  };
}

describe("daysInMonth", () => {
  it("returns 31 for October 2026", () => {
    expect(daysInMonth(2026, 10)).toBe(31);
  });

  it("returns 28 for February 2026 (not a leap year)", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

describe("monthNameTitleCase / scheduleFileName", () => {
  it("title-cases the Portuguese month name", () => {
    expect(monthNameTitleCase(9)).toBe("Setembro");
    expect(monthNameTitleCase(10)).toBe("Outubro");
  });

  it("builds the unit-specific file name", () => {
    expect(scheduleFileName(getScheduleTemplate("HETRIN"), 9)).toBe("Escala Hetrin - Setembro.xlsx");
    expect(scheduleFileName(getScheduleTemplate("HMB"), 9)).toBe("Escala HMB - Setembro.xlsx");
  });
});

// Both units now share the same row layout: a header-image band at row 1
// (HETRIN's "Energia Verde Norte" text sits inside that same band, to the
// right of the banner — it no longer gets its own separate row), title at
// row 3, column header at row 5, the first section marker at row 6.
const TITLE_ROW = 3;
const HEADER_ROW = 5;
const SECTION_ROW = 6;
const DATA_ROW = 7;

describe("renderScheduleWorkbook", () => {
  it("renders a HETRIN sheet with its header image, 5 fixed columns and 3 footer boxes", async () => {
    const template = getScheduleTemplate("HETRIN");
    const buffer = await renderScheduleWorkbook(sampleData(), template);

    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.worksheets[0]!;

    // Company header text shares the image band row, not a row of its own.
    expect(sheet.getCell(`D1`).value).toBe("Energia Verde Norte");
    expect(sheet.getCell(`D1`).isMerged).toBe(true);

    const titleCell = sheet.getCell(`A${TITLE_ROW}`);
    expect(titleCell.value).toBe("ESCALA DE FOLGA — HETRIN | OUTUBRO/2026");
    expect((titleCell.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF1F4E78");

    const headerValues = sheet.getRow(HEADER_ROW).values as unknown[];
    // No "Escala" column anymore — Conselho carries the schedule label instead (HETRIN only).
    expect(headerValues.slice(1, 6)).toEqual(["Nome", "Iniciais", "Função", "Conselho", "Horário"]);
    expect(headerValues[6]).toBe("1");
    expect(headerValues[headerValues.length - 1]).toBe("Observações");

    const sectionCell = sheet.getCell(`A${SECTION_ROW}`);
    expect(sectionCell.value).toBe("DIURNO");
    expect(sectionCell.alignment?.horizontal).toBe("center");
    expect(sectionCell.alignment?.vertical).toBe("middle");

    expect(sheet.getCell(`A${DATA_ROW}`).value).toBe("Colaborador Teste Um");
    // Conselho <- scheduleLabel, but upper-cased/de-accented to match the
    // original file's own "DIURNO IMPAR" convention (originalConselhoLabel).
    expect(sheet.getCell(`D${DATA_ROW}`).value).toBe("DIURNO IMPAR");
    const day1Cell = sheet.getCell(`F${DATA_ROW}`);
    expect(day1Cell.value).toBe("D");
    expect((day1Cell.font as ExcelJS.Font).color?.argb).toBe("FF1F4E78");
    expect((day1Cell.font as ExcelJS.Font).bold).toBe(true);

    expect(workbook.model.media?.length).toBe(1);
  });

  it("renders an HMB sheet with 3 header images, a blank Conselho and 4 footer boxes", async () => {
    const template = getScheduleTemplate("HMB");
    const buffer = await renderScheduleWorkbook(sampleData(), template);

    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.worksheets[0]!;

    const titleCell = sheet.getCell(`A${TITLE_ROW}`);
    expect(titleCell.value).toBe("ESCALA DE FOLGA — HMB | OUTUBRO/2026");

    const sectionCell = sheet.getCell(`A${SECTION_ROW}`);
    expect(sectionCell.alignment?.horizontal).toBe("center");

    // HMB's Conselho stays blank (conselhoHoldsSchedule is false) — the sample row has no council value.
    expect(sheet.getCell(`D${DATA_ROW}`).value).toBe("");

    expect(workbook.model.media?.length).toBe(3);
  });

  it("tints weekend day columns that have no explicit schedule-code color", async () => {
    const data = sampleData();
    // Force a rest day ("F", no defined color->fill) onto 2026-10-03, a Saturday.
    data.sections[0]!.rows[0]!.days[2] = "F";
    const buffer = await renderScheduleWorkbook(data, getScheduleTemplate("HMB"));

    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.worksheets[0]!;
    const saturdayCell = sheet.getCell(DATA_ROW, 5 + 3); // fixed columns (5) + day 3.

    expect((saturdayCell.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFB4C6E7");
  });
});
