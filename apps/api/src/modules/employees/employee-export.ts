/**
 * "Extrair XLSX" on the Colaboradores screen: a full dump of the registered
 * employees (of one unit) with everything the cadastro stores — including
 * afastamentos/licenças (real start/end dates from the calendar events) and the
 * cadastro change history, which is where admissions and desligamentos are
 * traceable from.
 *
 * Split in two on purpose: `buildEmployeeExportRows` maps raw Prisma rows into a
 * flat, display-ready shape (labels, derived dates), and `renderEmployeesWorkbook`
 * only lays that shape out in ExcelJS. Both are pure (no DB, no I/O), so the
 * route stays thin and the layout is unit-testable.
 */
import ExcelJS from "exceljs";

export type ExportShiftParameter = {
  operationId: string | null;
  code: string;
  name: string;
  configuration: unknown;
};

export type ExportSourceEmployee = {
  id: string;
  name: string;
  identifier: string;
  initials: string;
  council: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  workRegime: string | null;
  admissionDate: Date | null;
  status: string;
  shift: string | null;
  parity: "ODD" | "EVEN" | null;
  team: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  operationId: string;
  operation: { name: string };
  function: { name: string } | null;
  history: { action: string; before: unknown; after: unknown; createdAt: Date; createdBy: string | null }[];
  calendarEvents: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    notes: string | null;
    createdAt: Date;
    type: { code: string; name: string; category: string };
  }[];
};

export type EmployeeExportLeave = {
  typeCode: string;
  typeName: string;
  category: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  days: number;
  notes: string;
  createdAt: Date;
};

export type EmployeeExportHistoryEntry = {
  createdAt: Date;
  action: string;
  summary: string;
  by: string;
};

export type EmployeeExportRow = {
  unit: string;
  identifier: string;
  name: string;
  initials: string;
  functionName: string;
  council: string;
  shiftLabel: string;
  scheduleLabel: string;
  hours: string;
  parityLabel: string;
  team: string;
  statusLabel: string;
  admissionDate: Date | null;
  terminationDate: Date | null;
  notes: string;
  jobTitle: string;
  employmentType: string;
  workRegime: string;
  leaveCount: number;
  currentLeave: string;
  nextLeave: string;
  createdAt: Date;
  updatedAt: Date;
  leaves: EmployeeExportLeave[];
  history: EmployeeExportHistoryEntry[];
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  SCHEDULED_ADMISSION: "Admissão programada",
  ON_LEAVE: "Afastado",
  VACATION: "Férias",
  INACTIVE: "Inativo",
  TERMINATED: "Desligado"
};

const parityLabels: Record<string, string> = { ODD: "Ímpar", EVEN: "Par" };

const categoryLabels: Record<string, string> = {
  VACATION: "Férias",
  LEAVE: "Licença / afastamento",
  TRAINING: "Treinamento",
  ADMISSION: "Admissão",
  TERMINATION: "Desligamento",
  TIME_OFF: "Folga",
  OTHER: "Outros"
};

const fieldLabels: Record<string, string> = {
  name: "Nome",
  identifier: "Matrícula",
  initials: "Iniciais",
  council: "Conselho",
  status: "Situação",
  admissionDate: "Admissão",
  shift: "Turno",
  parity: "Rodízio",
  team: "Equipe",
  notes: "Observações",
  functionId: "Função",
  jobTitle: "Cargo",
  operationId: "Unidade",
  employmentType: "Vínculo",
  workRegime: "Regime"
};

const dayMs = 86_400_000;

function utcDay(date: Date): number {
  return Math.floor(date.getTime() / dayMs);
}

/** dd/MM/yyyy in UTC — dates here are stored as UTC calendar days, so local time would shift them. */
export function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** dd/MM/yyyy HH:mm in America/Sao_Paulo, for "when did it happen" timestamps. */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
    .format(date)
    .replace(",", "");
}

function titleCase(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

function hoursLabel(configuration: unknown): string {
  const config = configuration as { startHour?: number; durationHours?: number } | null;
  if (!config || typeof config.startHour !== "number" || typeof config.durationHours !== "number") {
    return "";
  }
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${pad(config.startHour)}:00–${pad((config.startHour + config.durationHours) % 24)}:00`;
}

function describeLeave(leave: EmployeeExportLeave): string {
  return `${leave.typeName} · ${formatDate(leave.startsAt)} a ${formatDate(leave.endsAt)}`;
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "status") return statusLabels[String(value)] ?? String(value);
  if (field === "parity") return parityLabels[String(value)] ?? String(value);
  if (field === "admissionDate") {
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? String(value) : formatDate(parsed);
  }
  return String(value);
}

function sameValue(field: string, a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === null || v === undefined || v === "" ? "" : formatValue(field, v));
  return norm(a) === norm(b);
}

function summarizeHistory(entry: ExportSourceEmployee["history"][number]): string {
  const before = (entry.before ?? {}) as Record<string, unknown>;
  const after = (entry.after ?? {}) as Record<string, unknown>;

  if (entry.action === "CREATE") {
    const status = formatValue("status", after.status);
    const admission = after.admissionDate ? ` · admissão ${formatValue("admissionDate", after.admissionDate)}` : "";
    return `Cadastro criado (situação: ${status}${admission})`;
  }
  if (entry.action === "ARCHIVE") return "Cadastro arquivado";

  const changes = Object.keys(after)
    .filter((field) => field in fieldLabels && !sameValue(field, before[field], after[field]))
    .map((field) => {
      const label = fieldLabels[field]!;
      // Foreign keys: the id means nothing in a spreadsheet — just say it changed.
      if (field === "functionId" || field === "operationId") return `${label} alterada`;
      if (field === "notes") return `${label} atualizadas`;
      return `${label}: ${formatValue(field, before[field])} → ${formatValue(field, after[field])}`;
    });
  return changes.length ? changes.join("; ") : "Cadastro salvo sem alterações de dados";
}

function terminationDateOf(employee: ExportSourceEmployee): Date | null {
  if (employee.status !== "TERMINATED") return null;
  // Latest history entry that moved the employee to TERMINATED. No entry (e.g. a
  // row inserted directly) means we genuinely do not know — leave it blank
  // rather than invent a date.
  const hit = [...employee.history]
    .reverse()
    .find((entry) => (entry.after as { status?: unknown } | null)?.status === "TERMINATED");
  return hit ? toBrazilCalendarDay(hit.createdAt) : null;
}

/**
 * The cadastro has no "effective termination date" field, so what we can
 * report is the day the status was set to Desligado in the system. That is a
 * moment in time, and for a UTC-written date cell the Brazilian evening would
 * land on the next day — shift it so the cell shows the São Paulo calendar day.
 */
function toBrazilCalendarDay(moment: Date): Date {
  return new Date(moment.getTime() - 3 * 3_600_000);
}

export function buildEmployeeExportRows(
  employees: ExportSourceEmployee[],
  shiftParameters: ExportShiftParameter[],
  userNames: Map<string, string>,
  today: Date = new Date()
): EmployeeExportRow[] {
  const todayDay = utcDay(today);

  return employees.map((employee) => {
    const parameter = employee.shift
      ? shiftParameters.find((p) => p.operationId === employee.operationId && p.code === employee.shift)
      : undefined;
    const shiftLabel = employee.shift ? (parameter?.name ?? titleCase(employee.shift)) : "";
    const parityLabel = employee.parity ? (parityLabels[employee.parity] ?? employee.parity) : "";
    const scheduleLabel = !employee.shift
      ? ""
      : employee.parity
        ? `${shiftLabel} ${parityLabel.toLowerCase()}`
        : `${shiftLabel} (sem rodízio)`;

    const leaves: EmployeeExportLeave[] = employee.calendarEvents.map((event) => ({
      typeCode: event.type.code,
      typeName: event.type.name,
      category: categoryLabels[event.type.category] ?? event.type.category,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      days: utcDay(event.endsAt) - utcDay(event.startsAt) + 1,
      notes: event.notes ?? "",
      createdAt: event.createdAt
    }));

    const current = leaves.find((l) => utcDay(l.startsAt) <= todayDay && utcDay(l.endsAt) >= todayDay);
    const next = leaves.find((l) => utcDay(l.startsAt) > todayDay);

    return {
      unit: employee.operation.name,
      identifier: employee.identifier,
      name: employee.name,
      initials: employee.initials,
      functionName: employee.function?.name ?? "",
      council: employee.council ?? "",
      shiftLabel,
      scheduleLabel,
      hours: parameter ? hoursLabel(parameter.configuration) : "",
      parityLabel,
      team: employee.team ?? "",
      statusLabel: statusLabels[employee.status] ?? employee.status,
      admissionDate: employee.admissionDate,
      terminationDate: terminationDateOf(employee),
      notes: employee.notes ?? "",
      jobTitle: employee.jobTitle ?? "",
      employmentType: employee.employmentType ?? "",
      workRegime: employee.workRegime ?? "",
      leaveCount: leaves.length,
      currentLeave: current ? describeLeave(current) : "",
      nextLeave: next ? describeLeave(next) : "",
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      leaves,
      history: employee.history.map((entry) => ({
        createdAt: entry.createdAt,
        action: entry.action === "CREATE" ? "Cadastro" : entry.action === "ARCHIVE" ? "Arquivamento" : "Alteração",
        summary: summarizeHistory(entry),
        by: entry.createdBy ? (userNames.get(entry.createdBy) ?? "") : ""
      }))
    };
  });
}

const HEADER_FILL = "FF123F36";

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.height = 28;
  for (let c = 1; c <= columnCount; c++) {
    const cell = header.getCell(c);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
}

export function employeeExportFileName(unitLabel: string | null): string {
  return unitLabel ? `Colaboradores - ${unitLabel}.xlsx` : "Colaboradores.xlsx";
}

/**
 * Content-Disposition value that survives non-ASCII unit names ("Operação
 * Demonstrativa"): a de-accented ASCII `filename` for old clients plus the
 * RFC 5987 `filename*` with the real name.
 */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function renderEmployeesWorkbook(rows: EmployeeExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Optional legacy columns only appear when at least one employee actually
  // has a value — so nothing stored is dropped, but the sheet isn't padded
  // with columns that are empty for everyone.
  const optional = [
    { key: "jobTitle", header: "Cargo", width: 24 },
    { key: "employmentType", header: "Vínculo", width: 18 },
    { key: "workRegime", header: "Regime", width: 18 }
  ] as const;
  const optionalInUse = optional.filter((col) => rows.some((row) => row[col.key]));

  const main = workbook.addWorksheet("Colaboradores");
  const columns: { header: string; key: string; width: number }[] = [
    { header: "Unidade", key: "unit", width: 18 },
    { header: "Matrícula", key: "identifier", width: 14 },
    { header: "Nome", key: "name", width: 34 },
    { header: "Iniciais", key: "initials", width: 10 },
    { header: "Função", key: "functionName", width: 30 },
    { header: "Conselho", key: "council", width: 14 },
    { header: "Turno", key: "shiftLabel", width: 14 },
    { header: "Escala", key: "scheduleLabel", width: 22 },
    { header: "Horário", key: "hours", width: 14 },
    { header: "Rodízio", key: "parityLabel", width: 10 },
    { header: "Equipe", key: "team", width: 16 },
    { header: "Situação", key: "statusLabel", width: 20 },
    { header: "Admissão", key: "admissionDate", width: 13 },
    { header: "Desligado em (registro)", key: "terminationDate", width: 24 },
    { header: "Afastamentos (qtd.)", key: "leaveCount", width: 13 },
    { header: "Afastamento vigente", key: "currentLeave", width: 40 },
    { header: "Próximo afastamento", key: "nextLeave", width: 40 },
    ...optionalInUse.map((col) => ({ header: col.header, key: col.key, width: col.width })),
    { header: "Observações", key: "notes", width: 44 },
    { header: "Cadastrado em", key: "createdAt", width: 18 },
    { header: "Atualizado em", key: "updatedAt", width: 18 }
  ];
  main.columns = columns;
  for (const row of rows) {
    main.addRow({
      ...row,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt)
    });
  }
  styleHeader(main, columns.length);
  for (const key of ["admissionDate", "terminationDate"]) {
    main.getColumn(key).numFmt = "dd/mm/yyyy";
    main.getColumn(key).alignment = { horizontal: "center" };
  }

  const leaves = workbook.addWorksheet("Afastamentos e licenças");
  const leaveColumns = [
    { header: "Unidade", key: "unit", width: 18 },
    { header: "Matrícula", key: "identifier", width: 14 },
    { header: "Colaborador", key: "name", width: 34 },
    { header: "Tipo", key: "typeName", width: 22 },
    { header: "Código", key: "typeCode", width: 9 },
    { header: "Categoria", key: "category", width: 22 },
    { header: "Início", key: "startsAt", width: 13 },
    { header: "Término", key: "endsAt", width: 13 },
    { header: "Dias", key: "days", width: 8 },
    { header: "Descrição", key: "title", width: 32 },
    { header: "Observação", key: "notes", width: 44 },
    { header: "Registrado em", key: "createdAt", width: 18 }
  ];
  leaves.columns = leaveColumns;
  for (const row of rows) {
    for (const leave of row.leaves) {
      leaves.addRow({
        unit: row.unit,
        identifier: row.identifier,
        name: row.name,
        ...leave,
        createdAt: formatDateTime(leave.createdAt)
      });
    }
  }
  styleHeader(leaves, leaveColumns.length);
  for (const key of ["startsAt", "endsAt"]) {
    leaves.getColumn(key).numFmt = "dd/mm/yyyy";
    leaves.getColumn(key).alignment = { horizontal: "center" };
  }

  const history = workbook.addWorksheet("Histórico do cadastro");
  const historyColumns = [
    { header: "Unidade", key: "unit", width: 18 },
    { header: "Matrícula", key: "identifier", width: 14 },
    { header: "Colaborador", key: "name", width: 34 },
    { header: "Data", key: "when", width: 18 },
    { header: "Evento", key: "action", width: 14 },
    { header: "O que mudou", key: "summary", width: 80 },
    { header: "Registrado por", key: "by", width: 24 }
  ];
  history.columns = historyColumns;
  for (const row of rows) {
    for (const entry of row.history) {
      history.addRow({
        unit: row.unit,
        identifier: row.identifier,
        name: row.name,
        when: formatDateTime(entry.createdAt),
        action: entry.action,
        summary: entry.summary,
        by: entry.by
      });
    }
  }
  styleHeader(history, historyColumns.length);
  history.getColumn("summary").alignment = { wrapText: true, vertical: "top" };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
