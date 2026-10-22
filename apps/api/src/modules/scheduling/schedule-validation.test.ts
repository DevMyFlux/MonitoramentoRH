/**
 * Regras de validação das edições de escala e consistência com a geração, com o banco simulado (sem Postgres).
 * Outubro/2026: colaborador ÍMPAR trabalha nos dias ímpares (1, 3, 5...) e folga nos pares; o PAR, o contrário.
 */
import { isKnownIssueCode, issueSeverity } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEmployeeScheduleSnapshot } from "./employee-schedule-service.js";
import { loadScheduleContext } from "./schedule-context.js";
import {
  applyChanges,
  blockingEditIssues,
  recomputeResult,
  validateChanges,
  type EditChange
} from "./schedule-validation.js";

const user = {
  id: "u1",
  role: "DEV",
  permissions: [],
  scopes: [{ isGlobal: true }]
} as unknown as AuthenticatedUser;
const SHIFT = {
  startHour: 7,
  durationHours: 12,
  restHours: 36,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  minimumTeam: 0
};

type Fake = {
  id: string;
  name: string;
  shift: string | null;
  parity: "ODD" | "EVEN" | null;
  admissionDate?: Date;
  terminationDate?: Date | null;
  status?: string;
  events?: Array<{ code: string; name: string; from: string; to: string }>;
  functionId?: string | null;
};

function employee(f: Fake) {
  return {
    id: f.id,
    name: f.name,
    initials: f.name.slice(0, 3).toUpperCase(),
    status: f.status ?? "ACTIVE",
    admissionDate: f.admissionDate ?? new Date("2020-01-01T00:00:00Z"),
    terminationDate: f.terminationDate ?? null,
    shift: f.shift,
    parity: f.parity,
    parityReferenceMonth: null,
    functionId: f.functionId ?? null,
    function: null,
    council: null,
    notes: null,
    documents: [],
    competencies: [],
    calendarEvents: (f.events ?? []).map((e, i) => ({
      id: `ev${i}`,
      title: e.name,
      startsAt: new Date(`${e.from}T00:00:00Z`),
      endsAt: new Date(`${e.to}T23:59:59Z`),
      type: { code: e.code, name: e.name, blocksAvailability: true }
    }))
  };
}

function fakeDb(
  people: Fake[],
  extra: {
    overrides?: Array<{ id: string; employeeId: string; date: string; code: string }>;
    docRequirement?: boolean;
  } = {}
): PrismaClient {
  const all = people.map(employee);
  return {
    operation: {
      findUnique: async () => ({
        id: "op",
        status: "ACTIVE",
        companyId: "c",
        unitId: "u",
        code: "T"
      })
    },
    employee: {
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids = args?.where?.id?.in;
        return ids ? all.filter((e) => ids.includes(e.id)) : all;
      }
    },
    operationalParameter: {
      findMany: async () => [
        { code: "DIURNO", operationId: "op", kind: "SHIFT", status: "ACTIVE", configuration: SHIFT }
      ]
    },
    complianceRequirement: {
      findMany: async () =>
        extra.docRequirement
          ? [
              {
                id: "r1",
                code: "NR10",
                name: "NR-10",
                functionId: null,
                warningDays: 30,
                required: true
              }
            ]
          : []
    },
    competencyMatrixItem: { findMany: async () => [] },
    scheduleDayOverride: {
      findMany: async () =>
        (extra.overrides ?? []).map((o) => ({
          ...o,
          operationId: "op",
          date: new Date(`${o.date}T00:00:00Z`),
          status: "ACTIVE"
        }))
    }
  } as unknown as PrismaClient;
}

const ANA: Fake = { id: "ana", name: "Ana", shift: "DIURNO", parity: "ODD" }; // trabalha 1,3,5... ; folga 2,4,6...
const BIA: Fake = { id: "bia", name: "Bia", shift: "DIURNO", parity: "EVEN" }; // trabalha 2,4,6...

async function setup(people: Fake[], extra: Parameters<typeof fakeDb>[1] = {}) {
  const db = fakeDb(people, extra);
  const snapshot = await buildEmployeeScheduleSnapshot(db, user, "op", "2026-10");
  const ctx = await loadScheduleContext(db, user, "op", "2026-10", {
    onlyEmployeeIds: people.map((p) => p.id)
  });
  return { db, snapshot, ctx, grid: snapshot.grid };
}

const codes = (issues: ReturnType<typeof validateChanges>) => issues.flatMap((i) => i.reasonCodes);
const edit = (employeeId: string, date: string, code: string, reason?: string): EditChange => ({
  employeeId,
  date,
  code,
  ...(reason ? { reason } : {})
});

describe("revalidar uma grade gerada dá o MESMO resultado da geração (nada muda sem edição)", () => {
  const cenarios: Array<[string, Fake[], Parameters<typeof fakeDb>[1]?]> = [
    ["equipe simples", [ANA, BIA]],
    [
      "admissão no meio do mês e desligamento programado",
      [
        ANA,
        { ...BIA, admissionDate: new Date("2026-10-10T00:00:00Z") },
        {
          id: "cid",
          name: "Caio",
          shift: "DIURNO",
          parity: "ODD",
          terminationDate: new Date("2026-10-20T00:00:00Z")
        }
      ]
    ],
    [
      "férias no meio do mês",
      [
        ANA,
        { ...BIA, events: [{ code: "FR", name: "Férias", from: "2026-10-05", to: "2026-10-12" }] }
      ]
    ],
    [
      "colaborador sem turno nem rodízio",
      [ANA, { id: "dan", name: "Dani", shift: null, parity: null }]
    ],
    ["pendência de documento obrigatório", [ANA, BIA], { docRequirement: true }],
    [
      "com ajuste manual no mês",
      [ANA, BIA],
      {
        overrides: [
          { id: "o1", employeeId: "ana", date: "2026-10-02", code: "C" },
          { id: "o2", employeeId: "bia", date: "2026-10-04", code: "F" }
        ]
      }
    ]
  ];

  it.each(cenarios)("%s", async (_nome, people, extra) => {
    const { snapshot, ctx, grid } = await setup(people, extra);
    const overrides = new Map(
      ctx.overrides.map((o) => [
        `${o.employeeId}|${o.date.toISOString().slice(0, 10)}`,
        { code: o.code }
      ])
    );
    const recomputed = recomputeResult(ctx, grid, overrides);
    expect(recomputed.metrics).toEqual(snapshot.metrics);
    // ajustes manuais passam a ser validados (avisos); o resto precisa ser idêntico, na mesma ordem
    const automaticas = (list: typeof snapshot.pendencies) =>
      list.filter((p) => !p.reasonCodes.some((c) => c.startsWith("EDIT_")));
    expect(automaticas(recomputed.pendencies)).toEqual(snapshot.pendencies);
  });
});

describe("regras de cada edição", () => {
  it("troca para um código que já é o da regra não precisa de justificativa; fugir do rodízio precisa", async () => {
    const { ctx, grid } = await setup([ANA, BIA]);
    // Ana folga no dia 2 (par). Cobertura (C) sem motivo → exige justificativa
    expect(codes(validateChanges(ctx, grid, [edit("ana", "2026-10-02", "C")]))).toContain(
      "EDIT_JUSTIFICATION_REQUIRED"
    );
    // com motivo na mudança ou justificativa geral → ok
    expect(
      blockingEditIssues(
        validateChanges(ctx, grid, [edit("ana", "2026-10-02", "C", "Cobrir falta")])
      )
    ).toEqual([]);
    expect(
      blockingEditIssues(
        validateChanges(ctx, grid, [edit("ana", "2026-10-02", "C")], {
          justification: "Cobrir falta"
        })
      )
    ).toEqual([]);
    // voltar ao que a regra manda (Ana trabalha no dia 3: D) nunca pede justificativa
    expect(codes(validateChanges(ctx, grid, [edit("ana", "2026-10-03", "D")]))).not.toContain(
      "EDIT_JUSTIFICATION_REQUIRED"
    );
  });

  it("turno normal em dia de folga é bloqueado; o dia extra tem que ser Cobertura (C)", async () => {
    const { ctx, grid } = await setup([ANA, BIA]);
    const bloqueio = validateChanges(ctx, grid, [edit("ana", "2026-10-02", "D", "motivo")]);
    expect(codes(bloqueio)).toContain("EDIT_WORK_ON_REST_DAY");
    expect(blockingEditIssues(bloqueio)).toHaveLength(1);
    expect(
      blockingEditIssues(validateChanges(ctx, grid, [edit("ana", "2026-10-02", "C", "motivo")]))
    ).toEqual([]);
  });

  it("Cobertura em dia que a pessoa já trabalha só avisa", async () => {
    const { ctx, grid } = await setup([ANA, BIA]);
    const issues = validateChanges(ctx, grid, [edit("ana", "2026-10-03", "C", "motivo")]);
    expect(codes(issues)).toContain("EDIT_COVERAGE_ON_WORKDAY");
    expect(blockingEditIssues(issues)).toEqual([]);
    expect(issueSeverity("EDIT_COVERAGE_ON_WORKDAY")).toBe("warning");
  });

  it("afastamento: não se lança na mão e não se escala quem está afastado", async () => {
    const { ctx, grid } = await setup([
      ANA,
      { ...BIA, events: [{ code: "FR", name: "Férias", from: "2026-10-05", to: "2026-10-12" }] }
    ]);
    // Bia está de férias do dia 5 ao 12
    expect(grid.sections[0]!.rows.find((r) => r.employeeId === "bia")!.days[5]).toBe("FR");
    const trabalhar = validateChanges(ctx, grid, [edit("bia", "2026-10-06", "D", "cobrir")]);
    expect(codes(trabalhar)).toContain("EDIT_EMPLOYEE_ON_LEAVE");
    expect(
      trabalhar.find((i) => i.reasonCodes.includes("EDIT_EMPLOYEE_ON_LEAVE"))!.details?.[0]?.message
    ).toContain("Férias");
    const folgar = validateChanges(ctx, grid, [edit("bia", "2026-10-06", "F", "motivo")]);
    expect(codes(folgar)).toContain("EDIT_EMPLOYEE_ON_LEAVE"); // o dia segue como afastamento
    // lançar férias para quem NÃO tem afastamento registrado
    expect(
      codes(validateChanges(ctx, grid, [edit("ana", "2026-10-03", "FR", "motivo")]))
    ).toContain("EDIT_LEAVE_CODE_NOT_ALLOWED");
    // manter o código do afastamento que existe é permitido
    expect(
      blockingEditIssues(validateChanges(ctx, grid, [edit("bia", "2026-10-06", "FR")]))
    ).toEqual([]);
  });

  it("antes da admissão e depois do desligamento ninguém é escalado", async () => {
    const { ctx, grid } = await setup([
      ANA,
      {
        id: "novo",
        name: "Novo",
        shift: "DIURNO",
        parity: "ODD",
        admissionDate: new Date("2026-10-10T00:00:00Z")
      },
      {
        id: "saiu",
        name: "Saiu",
        shift: "DIURNO",
        parity: "ODD",
        terminationDate: new Date("2026-10-20T00:00:00Z")
      }
    ]);
    expect(
      codes(validateChanges(ctx, grid, [edit("novo", "2026-10-05", "C", "motivo")]))
    ).toContain("EDIT_EMPLOYEE_NOT_ACTIVE");
    expect(
      codes(validateChanges(ctx, grid, [edit("saiu", "2026-10-25", "C", "motivo")]))
    ).toContain("EDIT_EMPLOYEE_NOT_ACTIVE");
    expect(
      blockingEditIssues(validateChanges(ctx, grid, [edit("novo", "2026-10-12", "C", "motivo")]))
    ).toEqual([]);
  });

  it("descanso menor que o do turno vira aviso (não inventa regra nova), com o número de horas", async () => {
    const { ctx, grid } = await setup([ANA, BIA]);
    // Ana trabalha dia 3; Cobertura no dia 2 deixa dois dias seguidos de trabalho (12 h de descanso, turno prevê 36 h)
    const issues = validateChanges(ctx, grid, [edit("ana", "2026-10-02", "C", "motivo")]);
    const rest = issues.find((i) => i.reasonCodes.includes("EDIT_REST_TIME_SHORT"))!;
    expect(rest.details?.[0]?.message).toBe(
      "Descanso de 12 h entre os dias 2 e 3; o turno prevê 36 h."
    );
    expect(blockingEditIssues(issues)).toEqual([]);
  });

  it("folga num dia de trabalho do rodízio só informa que a cobertura diminui", async () => {
    const { ctx, grid } = await setup([ANA, BIA]);
    const issues = validateChanges(ctx, grid, [edit("ana", "2026-10-03", "F", "motivo")]);
    expect(codes(issues)).toContain("EDIT_COVERAGE_REDUCED");
    expect(blockingEditIssues(issues)).toEqual([]);
    expect(issueSeverity("EDIT_COVERAGE_REDUCED")).toBe("info");
  });

  it("pendência de documento do colaborador aparece como aviso, sem bloquear", async () => {
    const { ctx, grid } = await setup([ANA, BIA], { docRequirement: true });
    const issues = validateChanges(ctx, grid, [edit("bia", "2026-10-03", "C", "motivo")]);
    const apt = issues.find((i) => i.reasonCodes.includes("EDIT_APTITUDE_NOT_OK"))!;
    expect(apt.details?.[0]?.message).toContain("NR-10");
    expect(blockingEditIssues(issues)).toEqual([]);
  });

  it("entradas inválidas: código inexistente, colaborador fora da escala, data fora do mês, alteração repetida", async () => {
    const { ctx, grid } = await setup([ANA, BIA]);
    expect(codes(validateChanges(ctx, grid, [edit("ana", "2026-10-03", "ZZ")]))).toContain(
      "EDIT_UNKNOWN_CODE"
    );
    expect(codes(validateChanges(ctx, grid, [edit("fantasma", "2026-10-03", "D")]))).toContain(
      "EDIT_EMPLOYEE_NOT_IN_SCHEDULE"
    );
    expect(codes(validateChanges(ctx, grid, [edit("ana", "2026-11-03", "D")]))).toContain(
      "EDIT_DATE_OUTSIDE_MONTH"
    );
    expect(codes(validateChanges(ctx, grid, [edit("ana", "2026-10-32", "D")]))).toContain(
      "EDIT_DATE_OUTSIDE_MONTH"
    );
    expect(
      codes(
        validateChanges(ctx, grid, [
          edit("ana", "2026-10-03", "F", "m"),
          edit("ana", "2026-10-03", "D", "m")
        ])
      )
    ).toContain("EDIT_DUPLICATE_CHANGE");
  });

  it("colaborador sem turno configurado não pode ter a célula editada (precisa do cadastro primeiro)", async () => {
    const { ctx, grid } = await setup([
      ANA,
      { id: "dan", name: "Dani", shift: null, parity: null }
    ]);
    expect(codes(validateChanges(ctx, grid, [edit("dan", "2026-10-05", "D", "motivo")]))).toContain(
      "SHIFT_NOT_CONFIGURED"
    );
  });

  it("aplicar mudanças não altera a grade original", async () => {
    const { grid } = await setup([ANA, BIA]);
    const antes = JSON.stringify(grid);
    const depois = applyChanges(grid, [edit("ana", "2026-10-02", "C")]);
    expect(JSON.stringify(grid)).toBe(antes);
    expect(depois.sections[0]!.rows.find((r) => r.employeeId === "ana")!.days[1]).toBe("C");
  });
});

describe("toda regra de edição tem mensagem em linguagem simples e severidade definida", () => {
  const impeditivos = [
    "EDIT_UNKNOWN_CODE",
    "EDIT_EMPLOYEE_NOT_IN_SCHEDULE",
    "EDIT_DATE_OUTSIDE_MONTH",
    "EDIT_DUPLICATE_CHANGE",
    "EDIT_LEAVE_CODE_NOT_ALLOWED",
    "EDIT_EMPLOYEE_ON_LEAVE",
    "EDIT_EMPLOYEE_NOT_ACTIVE",
    "EDIT_WORK_ON_REST_DAY",
    "EDIT_JUSTIFICATION_REQUIRED"
  ];
  const avisos = ["EDIT_APTITUDE_NOT_OK", "EDIT_REST_TIME_SHORT", "EDIT_COVERAGE_ON_WORKDAY"];

  it.each(impeditivos)("%s é impeditivo e traduzido", (code) => {
    expect(isKnownIssueCode(code)).toBe(true);
    expect(issueSeverity(code)).toBe("blocking");
  });
  it.each(avisos)("%s é só aviso e traduzido", (code) => {
    expect(isKnownIssueCode(code)).toBe(true);
    expect(issueSeverity(code)).toBe("warning");
  });
});
