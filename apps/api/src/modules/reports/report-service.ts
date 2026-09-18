import * as XLSX from "xlsx";

export type ReportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export function buildXlsxBase64(sheets: ReportSheet[]): string {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
}
