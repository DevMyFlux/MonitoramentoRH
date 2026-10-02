/**
 * Per-unit schedule template configuration (Fase 5, revised by the
 * HMB/HETRIN correction pass).
 *
 * Extracted from a cell-by-cell reading of the two reference spreadsheets
 * (Escala_IMED_HETRIN_Outubro_2026 and Escala_IMED_HMB_Outubro_2026). The two
 * units are NOT structurally identical — see the Fase 0 audit for the full
 * comparison table — so this is data, not a single hard-coded layout: the
 * renderer (apps/api/src/modules/scheduling/xlsx-renderer.ts) reads one of
 * these per generation instead of branching on unit code internally.
 *
 * Revision note: Fase 5 originally gave both units a separate, correctly
 * labeled "Escala" column and left "Conselho" for a real professional
 * council registration. The correction request explicitly reverses that:
 * neither unit has an "Escala" column anymore, and HETRIN's "Conselho"
 * column now holds the schedule/parity label — reproducing the original
 * file's real (if originally mislabeled) structure instead of "fixing" it.
 * HMB's "Conselho" stays blank, matching its original file.
 */

export type ScheduleFooterBox = "leaveLegend" | "restLegend" | "managerSignature" | "supervisorStamp";

export type HeaderImage = {
  /** File name under apps/api/src/modules/scheduling/assets/. */
  file: string;
  /**
   * Anchor as a real, absolute pixel offset: 0-indexed column index plus a
   * pixel offset INTO that column (not a fraction of it). exceljs's own
   * fractional `col` convenience API scales the offset by an internal
   * width≈1.05px-per-unit approximation that has nothing to do with how
   * real Excel renders a column's width (Excel uses the MDW formula,
   * ~7px-per-unit + 5px) — passed straight through, it silently misplaces
   * anything anchored in a wide fixed column. Anchoring by an explicit pixel
   * offset (via ExcelJS's nativeCol/nativeColOff, which are written to the
   * OOXML colOff verbatim) sidesteps that mismatch entirely.
   */
  col: number;
  colOffPx: number;
  row: number;
  rowOffPx: number;
  widthPx: number;
  heightPx: number;
};

export type ScheduleTemplateConfig = {
  /**
   * Looked up by Operation.code (unit = Operation, per the Fase 0/1 decision).
   * When HETRIN/HMB are created as real Operations, give each one this exact
   * code so schedule generation finds its template.
   */
  unitCode: string;
  unitLabel: string;
  /** Used in the exported file name, e.g. "Escala Hetrin - Outubro.xlsx". Cased per the unit's own convention. */
  fileLabel: string;
  /** e.g. "ESCALA DE FOLGA — HETRIN" — the month/year is appended by the renderer. */
  titlePrefix: string;
  /** Extra branding line above the title (HETRIN only in the reference files). Omit when the unit has none. */
  companyHeaderText?: string;
  /** Institutional logos/banners rendered above the title band. Empty array = none. */
  headerImages: HeaderImage[];
  /** Height (px) reserved for the header image row. */
  headerRowHeight: number;
  /** When true, the "Conselho" column shows each row's schedule/parity label instead of a council registration. */
  conselhoHoldsSchedule: boolean;
  /**
   * Per-code color overrides for this unit's day-grid cells, layered over
   * packages/shared/schedule-codes.ts's defaults. HETRIN's F/D/N/C carry
   * their own static cell fill in the original file (confirmed from its
   * own styles.xml: D=#D9EAF7 fill/#1F4E78 font, N=#E4D6F3/#7030A0,
   * F=#F2F2F2/#666666), unlike HMB's font-color-only scheme — so this must
   * be per-template, not a single shared map both units read from.
   */
  dayColorOverrides?: Partial<Record<string, { font: string; bold: boolean; fill?: string }>>;
  /**
   * Fallback fill for a weekend day whose resolved code has no fill of its
   * own. This is a real, confirmed HMB-only convention (its original file's
   * own weekend-column shading, #B4C6E7) — not a generic "weekend style".
   * null suppresses it entirely: HETRIN's original has no such thing, every
   * code already carries its own static fill on every day of the week, so
   * applying HMB's blue tint there was the actual bug being reported.
   */
  weekendTint: string | null;
  /** Footer note above the legend boxes (sector/unit description). */
  footerNote: string;
  /** Which sign-off / legend boxes this unit's sheet ends with, left to right. */
  footerBoxes: ScheduleFooterBox[];
};

export const scheduleTemplates: Record<string, ScheduleTemplateConfig> = {
  HETRIN: {
    unitCode: "HETRIN",
    unitLabel: "HETRIN",
    fileLabel: "Hetrin",
    titlePrefix: "ESCALA DE FOLGA — HETRIN",
    companyHeaderText: "Energia Verde Norte",
    // Anchor and size read directly from the original file's own
    // xl/drawings/drawing1.xml (EMU offsets/extents converted to px) so the
    // banner keeps the source's real size and margin, not an estimate.
    headerImages: [
      { file: "hetrin-header.png", col: 0, colOffPx: 54, row: 0, rowOffPx: 17, widthPx: 491, heightPx: 70 }
    ],
    headerRowHeight: 70,
    conselhoHoldsSchedule: true,
    dayColorOverrides: {
      F: { font: "666666", bold: false, fill: "F2F2F2" },
      D: { font: "1F4E78", bold: true, fill: "D9EAF7" },
      N: { font: "7030A0", bold: true, fill: "E4D6F3" },
      C: { font: "9C6500", bold: true, fill: "FFF2CC" }
    },
    weekendTint: null,
    footerNote:
      "UNIDADE ATENDIDA — HOSPITAL ESTADUAL DE TRINDADE (HETRIN) | SERVIÇOS DE MANUTENÇÃO E FACILITIES",
    footerBoxes: ["leaveLegend", "restLegend", "managerSignature"]
  },
  HMB: {
    unitCode: "HMB",
    unitLabel: "HMB",
    fileLabel: "HMB",
    titlePrefix: "ESCALA DE FOLGA — HMB",
    // Same derivation as HETRIN's comment above: the original's 3 images sit
    // at col 0 (left margin), then far right at day-13 and day-24 of its
    // October day grid — not clustered near the fixed columns. Re-based onto
    // this sheet's 5 fixed columns + day-column width so the same real
    // pixel positions/proportions carry over regardless of month length.
    headerImages: [
      { file: "hmb-imed.png", col: 0, colOffPx: 29, row: 0, rowOffPx: 17, widthPx: 430, heightPx: 125 },
      {
        file: "hmb-sus-prefeitura.png",
        col: 15,
        colOffPx: 6,
        row: 0,
        rowOffPx: 19,
        widthPx: 304,
        heightPx: 120
      },
      { file: "hmb-logo.png", col: 26, colOffPx: 29, row: 0, rowOffPx: 9, widthPx: 236, heightPx: 134 }
    ],
    headerRowHeight: 75,
    conselhoHoldsSchedule: false,
    // No dayColorOverrides: HMB's own original file has no static per-code
    // fill (confirmed from its styles.xml) — only the conditional-formatting
    // font colors already in packages/shared/schedule-codes.ts, plus the
    // weekend tint below.
    weekendTint: "FFB4C6E7",
    footerNote:
      "SETORES ATENDIDOS — PSA / PSR / PSI / UTI ADULTO / UTI PEDIÁTRICA / ENFERMARIA PEDIÁTRICA / ENFERMARIA CLÍNICA MÉDICA / ENFERMARIA CLÍNICA CIRÚRGICA",
    footerBoxes: ["leaveLegend", "restLegend", "managerSignature", "supervisorStamp"]
  }
};

export function getScheduleTemplate(unitCode: string): ScheduleTemplateConfig {
  const template = scheduleTemplates[unitCode];
  if (!template) {
    throw new Error(`Nenhum template de escala configurado para a unidade "${unitCode}".`);
  }
  return template;
}
