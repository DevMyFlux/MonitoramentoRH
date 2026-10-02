/**
 * Renders a generated monthly schedule to a styled .xlsx workbook, following
 * the visual identity of the reference spreadsheets (Fase 0 audit, revised by
 * the HMB/HETRIN correction pass): institutional header images, title band,
 * centered shift-group markers, a colored day grid, and the legend/sign-off
 * boxes — parameterized per unit by ScheduleTemplateConfig (Fase 5) instead
 * of branching on unit code here.
 *
 * Uses exceljs, not the `xlsx` package already in this app's dependencies:
 * the free edition of `xlsx` (SheetJS) does not support cell styling (fonts,
 * fills, borders, merges, embedded images), which this sheet needs throughout.
 *
 * This module only renders already-computed data — it does not read from the
 * database and does not decide who works which day (that is
 * employee-availability.ts, consumed by the Fase 6 generation service).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { scheduleCodeMap, type ScheduleFooterBox, type ScheduleTemplateConfig } from "@my-flux/shared";

export type ScheduleGridRow = {
  /** Not rendered on the sheet — carried through so callers (the Escalas UI) can key overrides by employee. */
  employeeId: string;
  employeeName: string;
  initials: string;
  functionName: string;
  /** Parity/shift descriptor, e.g. "Diurno ímpar", "Comercial". Shown in "Conselho" for units where conselhoHoldsSchedule is true. */
  scheduleLabel: string;
  /** Professional council registration. Shown in "Conselho" for units where conselhoHoldsSchedule is false. */
  council?: string | null;
  /** e.g. "07:00–19:00". */
  hours: string;
  /** One schedule-code letter (or "") per day of the month, in order. */
  days: string[];
  observation?: string | null;
};

export type ScheduleGridSection = {
  /** e.g. "DIURNO", "NOTURNO". */
  label: string;
  rows: ScheduleGridRow[];
};

export type ScheduleGridData = {
  year: number;
  /** 1-12. */
  month: number;
  sections: ScheduleGridSection[];
};

/** Matches exceljs's own xl/xform/drawing/ext-xform.js EMU_PER_PIXEL_AT_96_DPI constant. */
const EMU_PER_PIXEL = 9525;
/** Points-per-pixel at 96 DPI, for converting a pixel measurement into a `row.height` (points). */
const PT_PER_PX = 72 / 96;

const TITLE_FILL = "FF1F4E78";
const SECTION_FILL = "FFFFF200";
const HEADER_FILL = "FFF2F2F2";
const BOX_FONT = "Carlito";

const monthNames = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO"
];

/** Title-case month name for file names, e.g. "Setembro". */
export function monthNameTitleCase(month: number): string {
  const name = monthNames[month - 1] ?? "";
  return name.charAt(0) + name.slice(1).toLowerCase();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "Escala Hetrin - Setembro.xlsx" / "Escala HMB - Setembro.xlsx". */
export function scheduleFileName(template: ScheduleTemplateConfig, month: number): string {
  return `Escala ${template.fileLabel} - ${monthNameTitleCase(month)}.xlsx`;
}

const assetsDir = fileURLToPath(new URL("./assets/", import.meta.url));

const thinBorder = { style: "thin" as const, color: { argb: "FF000000" } };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const footerBoxText: Record<ScheduleFooterBox, string> = {
  leaveLegend:
    "FR - Férias | LN - Licença Nojo | LG - Licença Gala | LM - Licença Maternidade | LP - Licença Paternidade | AT - Atestado | LMA - Licença Médica",
  restLegend: "F - Folga | FE - Folga Saúde | FA - Day Off | BH - Folga Banco de Horas | C - Cobertura | M - Manhã | T - Tarde | D - Diurno | N - Noturno",
  managerSignature: "Gerente do Setor:",
  supervisorStamp: "Carimbo do Supervisor do Setor:"
};

export async function renderScheduleWorkbook(
  data: ScheduleGridData,
  template: ScheduleTemplateConfig
): Promise<Buffer> {
  const dayCount = daysInMonth(data.year, data.month);
  // No unit has an "Escala" column anymore: HETRIN's "Conselho" holds that
  // data instead (conselhoHoldsSchedule), HMB's stays blank — see the
  // revision note in schedule-templates.ts.
  const fixedColumns = ["Nome", "Iniciais", "Função", "Conselho", "Horário"];
  const dayColumns = Array.from({ length: dayCount }, (_, i) => String(i + 1));
  const columns = [...fixedColumns, ...dayColumns, "Observações"];
  const lastCol = columns.length;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${monthNames[data.month - 1]} ${template.unitLabel}`, {
    views: [{ showGridLines: false }]
  });

  sheet.columns = columns.map((_, i) => ({
    width: i === 0 ? 28 : i === 2 ? 24 : i < fixedColumns.length ? 13 : i === lastCol - 1 ? 30 : 4
  }));

  let row = 1;

  if (template.headerImages.length) {
    const bandRow = row;
    // ExcelJS's `row.height` is in POINTS (written straight to the OOXML `ht`
    // attribute — see row-xform.js), not pixels. headerRowHeight/rowOffPx/
    // heightPx are all pixel values (derived from the original files' own
    // EMU anchors), so the row must reserve px-converted-to-pt space for
    // whichever image actually reaches lowest — not just headerRowHeight,
    // which by itself under-reserved space for HMB's tallest logo and let it
    // bleed into the title band below.
    const tallestImageBottomPx = Math.max(
      template.headerRowHeight,
      ...template.headerImages.map((image) => image.rowOffPx + image.heightPx)
    );
    const bandRowHeightPx = tallestImageBottomPx + 6; // small safety margin
    sheet.getRow(bandRow).height = bandRowHeightPx * PT_PER_PX;
    for (const image of template.headerImages) {
      const imageId = workbook.addImage({
        buffer: readFileSync(`${assetsDir}${image.file}`) as unknown as ExcelJS.Buffer,
        extension: "png"
      });
      sheet.addImage(imageId, {
        // Native (pixel-exact) anchor, not the fractional col/row API — see
        // the HeaderImage doc comment in schedule-templates.ts for why.
        tl: {
          nativeCol: image.col,
          nativeColOff: Math.round(image.colOffPx * EMU_PER_PIXEL),
          nativeRow: bandRow - 1 + image.row,
          nativeRowOff: Math.round(image.rowOffPx * EMU_PER_PIXEL)
        },
        ext: { width: image.widthPx, height: image.heightPx }
        // exceljs's own .d.ts only declares the fractional {col,row} shape
        // for `tl`, not the native/pixel-exact one its runtime actually
        // accepts (see anchor.js) — narrow cast, not a real type mismatch.
      } as unknown as ExcelJS.ImagePosition);
    }
    if (template.companyHeaderText) {
      const textStartCol = Math.min(4, lastCol);
      sheet.mergeCells(bandRow, textStartCol, bandRow, lastCol);
      const cell = sheet.getCell(bandRow, textStartCol);
      cell.value = template.companyHeaderText;
      cell.font = { name: "Arial", size: 12, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
    row = bandRow + 2;
  }

  const titleRow = row;
  sheet.mergeCells(`A${titleRow}:${colLetter(lastCol)}${titleRow}`);
  const titleCell = sheet.getCell(`A${titleRow}`);
  titleCell.value = `${template.titlePrefix} | ${monthNames[data.month - 1]}/${data.year}`;
  titleCell.font = { name: BOX_FONT, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(titleRow).height = 30;
  row = titleRow + 2;

  const headerRow = row;
  columns.forEach((label, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = label;
    cell.font = { name: BOX_FONT, size: 11, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = allBorders;
  });
  sheet.getRow(headerRow).height = 26;
  row = headerRow + 1;

  for (const section of data.sections) {
    const sectionRow = row;
    sheet.mergeCells(`A${sectionRow}:${colLetter(lastCol)}${sectionRow}`);
    const sectionCell = sheet.getCell(`A${sectionRow}`);
    sectionCell.value = section.label;
    sectionCell.font = { name: BOX_FONT, size: 11, bold: true };
    sectionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
    sectionCell.alignment = { horizontal: "center", vertical: "middle" };
    row += 1;

    for (const person of section.rows) {
      const councilValue = template.conselhoHoldsSchedule
        ? originalConselhoLabel(person.scheduleLabel, section.label)
        : (person.council ?? "");
      const values = [
        person.employeeName,
        person.initials,
        person.functionName,
        councilValue,
        person.hours,
        ...person.days,
        person.observation ?? ""
      ];
      values.forEach((value, i) => {
        const cell = sheet.getCell(row, i + 1);
        cell.value = value;
        cell.font = { name: BOX_FONT, size: 9 };
        cell.border = allBorders;
        cell.alignment = { vertical: "middle", wrapText: true };
        const dayIndex = i - fixedColumns.length;
        if (dayIndex >= 0 && dayIndex < dayCount) {
          applyDayCellStyle(cell, String(value), data.year, data.month, dayIndex + 1, template);
        }
      });
      row += 1;
    }
  }

  row += 1;
  const footerNoteRow = row;
  sheet.mergeCells(`A${footerNoteRow}:${colLetter(lastCol)}${footerNoteRow}`);
  const footerNoteCell = sheet.getCell(`A${footerNoteRow}`);
  footerNoteCell.value = `Observação: ${template.footerNote}`;
  footerNoteCell.font = { name: BOX_FONT, size: 9, italic: true };
  row = footerNoteRow + 2;

  const legendRow = row;
  const boxWidth = Math.max(1, Math.floor(lastCol / template.footerBoxes.length));
  let cursor = 1;
  template.footerBoxes.forEach((box, i) => {
    const isLast = i === template.footerBoxes.length - 1;
    const end = isLast ? lastCol : Math.min(lastCol, cursor + boxWidth - 1);
    sheet.mergeCells(legendRow, cursor, legendRow + 2, end);
    const cell = sheet.getCell(legendRow, cursor);
    cell.value = footerBoxText[box];
    cell.font = { name: BOX_FONT, size: 8 };
    cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    cell.border = allBorders;
    cursor = end + 1;
  });
  for (let r = legendRow; r < legendRow + 3; r++) sheet.getRow(r).height = 20;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function applyDayCellStyle(
  cell: ExcelJS.Cell,
  code: string,
  year: number,
  month: number,
  day: number,
  template: ScheduleTemplateConfig
): void {
  cell.alignment = { horizontal: "center", vertical: "middle" };
  // A unit's own override (its original file's real per-code fill, e.g.
  // HETRIN's static D/N/F colors) takes precedence over the shared catalog,
  // which only carries the font-color rules common to both files.
  const color = template.dayColorOverrides?.[code] ?? scheduleCodeMap[code]?.color;
  if (color) {
    cell.font = { name: BOX_FONT, size: 9, bold: color.bold, color: { argb: `FF${color.font}` } };
    if (color.fill) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color.fill}` } };
      return;
    }
  }
  // weekendTint is a real but HMB-only convention (its own weekend-column
  // shading) — null for a unit whose every code already carries its own
  // static fill, so no fallback should paint over it.
  if (!template.weekendTint) return;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 0 || weekday === 6) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: template.weekendTint } };
  }
}

/**
 * HETRIN's original file writes this column as "DIURNO PAR" / "NOTURNO
 * IMPAR" (upper case, no accent) for a parity employee, and just "DIURNO" /
 * "NOTURNO" (matching the row's own section) for a fixed-shift ("Comercial")
 * one — not the nicer-cased "Diurno ímpar" / "Comercial" the Escalas page
 * shows. Convert only at this export boundary; ScheduleGridRow.scheduleLabel
 * itself stays as-is so the web UI's table is unaffected.
 */
function originalConselhoLabel(scheduleLabel: string, sectionLabel: string): string {
  if (scheduleLabel === "Comercial") return sectionLabel;
  return scheduleLabel
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function colLetter(index: number): string {
  let n = index;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
