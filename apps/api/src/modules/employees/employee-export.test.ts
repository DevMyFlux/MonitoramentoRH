import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  attachmentHeader,
  buildEmployeeExportRows,
  employeeExportFileName,
  renderEmployeesWorkbook,
  type ExportShiftParameter,
  type ExportSourceEmployee
} from "./employee-export.js";

const shiftParameters: ExportShiftParameter[] = [
  {
    operationId: "op-hmb",
    code: "DIURNO",
    name: "Diurno",
    configuration: { startHour: 7, durationHours: 12 }
  }
];

function employee(overrides: Partial<ExportSourceEmployee> = {}): ExportSourceEmployee {
  return {
    id: "e1",
    name: "Colaborador Teste",
    identifier: "HMB-01",
    initials: "CT",
    council: null,
    jobTitle: null,
    employmentType: null,
    workRegime: null,
    admissionDate: new Date("2026-10-02T00:00:00Z"),
    status: "ACTIVE",
    shift: "DIURNO",
    parity: "ODD",
    team: null,
    notes: "Folguista diurno.",
    createdAt: new Date("2026-09-28T12:00:00Z"),
    updatedAt: new Date("2026-09-29T12:00:00Z"),
    operationId: "op-hmb",
    operation: { name: "HMB" },
    function: { name: "Eletricista" },
    history: [],
    calendarEvents: [],
    ...overrides
  };
}

describe("buildEmployeeExportRows", () => {
  it("derives shift/escala/hours labels from the unit's shift parameter", () => {
    const [row] = buildEmployeeExportRows([employee()], shiftParameters, new Map());
    expect(row).toMatchObject({
      shiftLabel: "Diurno",
      scheduleLabel: "Diurno ímpar",
      hours: "07:00–19:00",
      parityLabel: "Ímpar",
      statusLabel: "Ativo",
      functionName: "Eletricista"
    });
  });

  it("labels a rotation-less employee instead of inventing a parity", () => {
    const [row] = buildEmployeeExportRows([employee({ parity: null })], shiftParameters, new Map());
    expect(row!.scheduleLabel).toBe("Diurno (sem rodízio)");
    expect(row!.parityLabel).toBe("");
  });

  it("reports every leave with its real start/end and inclusive day count", () => {
    const [row] = buildEmployeeExportRows(
      [
        employee({
          calendarEvents: [
            {
              title: "Férias — Outubro/2026",
              startsAt: new Date("2026-10-01T00:00:00Z"),
              endsAt: new Date("2026-10-16T23:59:59Z"),
              notes: null,
              createdAt: new Date("2026-09-29T12:00:00Z"),
              type: { code: "FR", name: "Férias", category: "VACATION" }
            }
          ]
        })
      ],
      shiftParameters,
      new Map(),
      new Date("2026-10-10T12:00:00Z")
    );
    expect(row!.leaves).toHaveLength(1);
    expect(row!.leaves[0]).toMatchObject({ typeCode: "FR", days: 16, category: "Férias" });
    expect(row!.leaveCount).toBe(1);
    expect(row!.currentLeave).toBe("Férias · 01/10/2026 a 16/10/2026");
    expect(row!.nextLeave).toBe("");
  });

  it("finds the termination in the history, as the São Paulo calendar day", () => {
    const [row] = buildEmployeeExportRows(
      [
        employee({
          status: "TERMINATED",
          history: [
            { action: "CREATE", before: null, after: { status: "ACTIVE" }, createdAt: new Date("2026-09-28T10:00:00Z"), createdBy: null },
            {
              action: "UPDATE",
              before: { status: "ACTIVE" },
              after: { status: "TERMINATED" },
              // 22:30 in São Paulo on the 28th = 01:30 UTC on the 29th.
              createdAt: new Date("2026-09-29T01:30:00Z"),
              createdBy: "u1"
            }
          ]
        })
      ],
      shiftParameters,
      new Map([["u1", "Fulano"]])
    );
    expect(row!.terminationDate!.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(row!.history.at(-1)).toMatchObject({
      action: "Alteração",
      summary: "Situação: Ativo → Desligado",
      by: "Fulano"
    });
  });

  it("does not report a termination for someone who was reactivated", () => {
    const [row] = buildEmployeeExportRows(
      [
        employee({
          status: "ACTIVE",
          history: [{ action: "UPDATE", before: { status: "ACTIVE" }, after: { status: "TERMINATED" }, createdAt: new Date(), createdBy: null }]
        })
      ],
      shiftParameters,
      new Map()
    );
    expect(row!.terminationDate).toBeNull();
  });
});

describe("renderEmployeesWorkbook", () => {
  async function load(rows: ReturnType<typeof buildEmployeeExportRows>) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await renderEmployeesWorkbook(rows)) as unknown as ExcelJS.Buffer);
    return workbook;
  }

  it("writes the three sheets with one row per employee / leave / history entry", async () => {
    const rows = buildEmployeeExportRows(
      [
        employee({
          calendarEvents: [
            {
              title: "Atestado",
              startsAt: new Date("2026-10-01T00:00:00Z"),
              endsAt: new Date("2026-10-03T23:59:59Z"),
              notes: "CID omitido",
              createdAt: new Date("2026-09-30T12:00:00Z"),
              type: { code: "AT", name: "Atestado", category: "LEAVE" }
            }
          ],
          history: [{ action: "CREATE", before: null, after: { status: "ACTIVE" }, createdAt: new Date("2026-09-28T12:00:00Z"), createdBy: null }]
        })
      ],
      shiftParameters,
      new Map()
    );
    const workbook = await load(rows);
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      "Colaboradores",
      "Afastamentos e licenças",
      "Histórico do cadastro"
    ]);

    const main = workbook.getWorksheet("Colaboradores")!;
    expect(main.getRow(1).getCell(1).value).toBe("Unidade");
    expect(main.getRow(2).getCell(3).value).toBe("Colaborador Teste");
    expect(main.getRow(2).getCell(13).value).toEqual(new Date("2026-10-02T00:00:00Z")); // Admissão

    const leaves = workbook.getWorksheet("Afastamentos e licenças")!;
    expect(leaves.rowCount).toBe(2);
    expect(leaves.getRow(2).getCell(5).value).toBe("AT");
    expect(leaves.getRow(2).getCell(7).value).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(leaves.getRow(2).getCell(9).value).toBe(3);
    expect(leaves.getRow(2).getCell(11).value).toBe("CID omitido");

    const history = workbook.getWorksheet("Histórico do cadastro")!;
    expect(history.rowCount).toBe(2);
  });

  it("only adds the legacy Cargo/Vínculo/Regime columns when someone actually has a value", async () => {
    const without = await load(buildEmployeeExportRows([employee()], shiftParameters, new Map()));
    const headersWithout = without.getWorksheet("Colaboradores")!.getRow(1).values as unknown[];
    expect(headersWithout).not.toContain("Cargo");

    const withCargo = await load(
      buildEmployeeExportRows([employee({ jobTitle: "Técnico sênior" })], shiftParameters, new Map())
    );
    const headersWith = withCargo.getWorksheet("Colaboradores")!.getRow(1).values as unknown[];
    expect(headersWith).toContain("Cargo");
    expect(headersWith).not.toContain("Vínculo");
  });
});

describe("file naming", () => {
  it("names the export after the unit", () => {
    expect(employeeExportFileName("HMB")).toBe("Colaboradores - HMB.xlsx");
    expect(employeeExportFileName(null)).toBe("Colaboradores.xlsx");
  });

  it("keeps a de-accented ASCII filename plus the real UTF-8 one", () => {
    const header = attachmentHeader("Colaboradores - Operação Demonstrativa.xlsx");
    expect(header).toContain('filename="Colaboradores - Operacao Demonstrativa.xlsx"');
    expect(header).toContain("filename*=UTF-8''Colaboradores%20-%20Opera%C3%A7%C3%A3o%20Demonstrativa.xlsx");
  });
});
