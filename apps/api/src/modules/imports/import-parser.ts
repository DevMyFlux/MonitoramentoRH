import * as XLSX from "xlsx";
import { createHash } from "node:crypto";

export type ImportType = "EMPLOYEES" | "QLP" | "SCHEDULE";

export type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
};

export type ImportIssue = {
  rowNumber?: number | undefined;
  field?: string | undefined;
  value?: string | undefined;
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
};

export type ParsedImport = {
  checksum: string;
  fileSize: number;
  rows: ParsedImportRow[];
  issues: ImportIssue[];
};

export function parseImportFile(
  type: ImportType,
  fileName: string,
  contentBase64: string,
  mapping: Record<string, string>
): ParsedImport {
  const buffer = Buffer.from(contentBase64, "base64");
  const rawRows = fileName.toLowerCase().endsWith(".csv")
    ? parseCsv(buffer)
    : parseWorkbook(buffer);
  const rows = rawRows.map((raw, index) => ({
    rowNumber: index + 2,
    raw,
    mapped: applyMapping(raw, mapping)
  }));

  return {
    checksum: createHash("sha256").update(buffer).digest("hex"),
    fileSize: buffer.byteLength,
    rows,
    issues: validateRows(type, rows)
  };
}

function parseWorkbook(buffer: Buffer): Array<Record<string, string>> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false
  });
}

function parseCsv(buffer: Buffer): Array<Record<string, string>> {
  const lines = buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
  const [headerLine, ...dataLines] = lines;

  if (!headerLine) {
    return [];
  }

  const headers = splitCsvLine(headerLine);

  return dataLines.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function applyMapping(
  raw: Record<string, string>,
  mapping: Record<string, string>
): Record<string, string> {
  if (Object.keys(mapping).length === 0) {
    return raw;
  }

  return Object.fromEntries(
    Object.entries(mapping).map(([sourceField, targetField]) => [
      targetField,
      raw[sourceField] ?? ""
    ])
  );
}

function validateRows(type: ImportType, rows: ParsedImportRow[]): ImportIssue[] {
  const issues: ImportIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      code: "EMPTY_FILE",
      severity: "ERROR",
      message: "Arquivo sem linhas para importacao."
    });
    return issues;
  }

  for (const row of rows) {
    if (type === "EMPLOYEES") {
      validateRequired(row, "name", "MISSING_REQUIRED_FIELD", issues);
      validateRequired(row, "identifier", "MISSING_REQUIRED_FIELD", issues);
    }

    if (type === "QLP") {
      validateRequired(row, "operation", "UNKNOWN_OPERATION", issues);
      validateRequired(row, "function", "UNKNOWN_FUNCTION", issues);
      validateRequired(row, "requiredQuantity", "MISSING_REQUIRED_FIELD", issues);
      validateNumber(row, "requiredQuantity", "INVALID_QUANTITY", issues);
    }

    if (type === "SCHEDULE") {
      validateRequired(row, "position", "POSITION_NOT_FOUND", issues);
      validateRequired(row, "shift", "INVALID_SHIFT", issues);
      validateRequired(row, "employee", "UNKNOWN_EMPLOYEE", issues);
    }
  }

  return issues;
}

function validateRequired(
  row: ParsedImportRow,
  field: string,
  code: string,
  issues: ImportIssue[]
): void {
  const value = row.mapped[field];

  if (!value) {
    issues.push({
      rowNumber: row.rowNumber,
      field,
      value: value ?? "",
      code,
      severity: "ERROR",
      message: `Campo obrigatorio ausente: ${field}.`
    });
  }
}

function validateNumber(
  row: ParsedImportRow,
  field: string,
  code: string,
  issues: ImportIssue[]
): void {
  const value = row.mapped[field];

  if (value && Number.isNaN(Number(value))) {
    issues.push({
      rowNumber: row.rowNumber,
      field,
      value,
      code,
      severity: "ERROR",
      message: `Valor numerico invalido para ${field}.`
    });
  }
}
