/**
 * Substituição temporária na geração da escala (Fase 5): o planejador e a geração reais; só o banco é simulado.
 *
 * Outubro/2026: ÍMPAR trabalha nos dias ímpares e folga nos pares; PAR, o contrário. Outubro tem 31 dias, então a
 * classificação inverte em novembro (Ímpar passa a trabalhar nos dias pares).
 */
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEmployeeScheduleSnapshot } from "./employee-schedule-service.js";
import { loadScheduleContext } from "./schedule-context.js";
import { recomputeResult } from "./schedule-validation.js";

const user = {
  id: "u1",
  role: "DEV",
  permissions: [],
  scopes: [{ isGlobal: true }]
} as unknown as AuthenticatedUser;

const SHIFTS = [
  {
    code: "DIURNO",
    configuration: {
      startHour: 7,
      durationHours: 12,
      restHours: 36,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      minimumTeam: 0
    }
  },
  {
    code: "COMERCIAL",
    configuration: {
      startHour: 8,
      durationHours: 9,
      restHours: 15,
      weekdays: [1, 2, 3, 4, 5],
      minimumTeam: 0
    }
  }
];

type Leave = { id: string; code: string; from: string; to: string };

function person(
  name: string,
  shift: "DIURNO" | "COMERCIAL",
  parity: "ODD" | "EVEN" | null,
  leaves: Leave[] = []
) {
  return {
    id: `id-${name}`,
    name,
    initials: name.slice(0, 3).toUpperCase(),
    status: "ACTIVE",
    admissionDate: new Date("2020-01-01T00:00:00Z"),
    terminationDate: null,
    shift,
    parity,
    parityReferenceMonth: null,
    functionId: null,
    function: null,
    council: null,
    notes: null,
    documents: [],
    competencies: [],
    calendarEvents: leaves.map((l) => ({
      id: l.id,
      title: l.code === "FR" ? "Férias" : "Atestado",
      startsAt: new Date(`${l.from}T00:00:00Z`),
      endsAt: new Date(`${l.to}T00:00:00Z`),
      type: {
        code: l.code,
        name: l.code === "FR" ? "Férias" : "Atestado",
        blocksAvailability: true
      }
    }))
  };
}

type Sub = {
  id: string;
  leaveId: string;
  titular: string;
  substitute: string;
  from: string;
  to: string;
  rotation?: "HABITUAL" | "SPECIFIC";
  parity?: "ODD" | "EVEN";
  covered?: string[];
  reference?: string;
  createdAt?: string;
};

function substitutionRow(s: Sub) {
  return {
    id: s.id,
    operationId: "op",
    leaveEventId: s.leaveId,
    titularId: `id-${s.titular}`,
    substituteId: `id-${s.substitute}`,
    rotation: s.rotation ?? "HABITUAL",
    specificParity: s.parity ?? null,
    parityReferenceMonth: s.reference ?? null,
    coveredDates: s.covered ?? [],
    status: "ACTIVE",
    createdAt: new Date(s.createdAt ?? "2026-09-01T00:00:00Z"),
    leaveEvent: {
      id: s.leaveId,
      status: "ACTIVE",
      startsAt: new Date(`${s.from}T00:00:00Z`),
      endsAt: new Date(`${s.to}T00:00:00Z`)
    },
    titular: { name: s.titular },
    substitute: { name: s.substitute }
  };
}

function fakeDb(
  employees: ReturnType<typeof person>[],
  subs: Sub[] = [],
  overrides: Array<{ employee: string; date: string; code: string }> = []
): PrismaClient {
  return {
    operation: {
      findUnique: async () => ({
        id: "op",
        code: "HMB",
        status: "ACTIVE",
        companyId: "c",
        unitId: "u"
      })
    },
    employee: { findMany: async () => employees },
    operationalParameter: {
      findMany: async () =>
        SHIFTS.map((s) => ({ ...s, operationId: "op", kind: "SHIFT", status: "ACTIVE" }))
    },
    complianceRequirement: { findMany: async () => [] },
    competencyMatrixItem: { findMany: async () => [] },
    scheduleDayOverride: {
      findMany: async () =>
        overrides.map((o, i) => ({
          id: `ov${i}`,
          operationId: "op",
          employeeId: `id-${o.employee}`,
          date: new Date(`${o.date}T00:00:00Z`),
          code: o.code,
          status: "ACTIVE"
        }))
    },
    leaveSubstitution: { findMany: async () => subs.map(substitutionRow) }
  } as unknown as PrismaClient;
}

const rowOf = (snapshot: Awaited<ReturnType<typeof buildEmployeeScheduleSnapshot>>, name: string) =>
  snapshot.grid.sections.flatMap((s) => s.rows).find((r) => r.employeeName === name)!;
/** Só os avisos de descanso (a cobertura em dias seguidos de trabalho) — nenhum impeditivo nem conflito. */
const onlyRestWarnings = (list: Array<{ reasonCodes: string[] }>) =>
  list.every((p) => p.reasonCodes.every((code) => code === "EDIT_REST_TIME_SHORT"));
const daysWith = (days: string[], code: string) =>
  days.flatMap((c, i) => (c === code ? [i + 1] : []));

const ANA = () =>
  person("Ana", "DIURNO", "ODD", [
    { id: "fr-ana", code: "FR", from: "2026-10-10", to: "2026-10-20" }
  ]);
const BIA = () => person("Bia", "DIURNO", "EVEN");
const FERIAS_ANA: Sub = {
  id: "s1",
  leaveId: "fr-ana",
  titular: "Ana",
  substitute: "Bia",
  from: "2026-10-10",
  to: "2026-10-20"
};

describe("geração com substituição", () => {
  it("sem substituição nada muda: Ana de férias, sem cobertura", async () => {
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Ana").days, "FR")).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
    ]);
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([]);
    expect(snapshot.substitutionCells).toEqual([]);
  });

  it("rodízio habitual: Bia cobre os plantões de Ana (dias ímpares) nos seus dias de folga, como C", async () => {
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()], [FERIAS_ANA]),
      user,
      "op",
      "2026-10"
    );
    const bia = rowOf(snapshot, "Bia").days;
    expect(daysWith(bia, "C")).toEqual([11, 13, 15, 17, 19]);
    // a escala habitual da Bia (dias pares) continua intacta, e fora do período nada muda
    expect(daysWith(bia, "D")).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
    expect(bia[0]).toBe("F"); // dia 1: folga normal
    expect(bia[20]).toBe("F"); // dia 21 (depois do período)
    // o titular segue como Férias — a substituição não apaga o afastamento
    expect(daysWith(rowOf(snapshot, "Ana").days, "FR")).toHaveLength(11);
    expect(snapshot.substitutionCells.map((c) => c.date)).toEqual(
      ["11", "13", "15", "17", "19"].map((d) => `2026-10-${d}`)
    );
    // cobrir dias seguidos de trabalho não é erro, mas o descanso menor que o do turno aparece como aviso
    expect(snapshot.pendencies.length).toBeGreaterThan(0);
    expect(onlyRestWarnings(snapshot.pendencies)).toBe(true);
    expect(snapshot.pendencies.every((p) => p.employeeName === "Bia")).toBe(true);
  });

  it("a cobertura soma em 'coberto' sem inflar o 'necessário' (o plantão do titular já estava contado)", async () => {
    const base = await buildEmployeeScheduleSnapshot(fakeDb([ANA(), BIA()]), user, "op", "2026-10");
    const covered = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()], [FERIAS_ANA]),
      user,
      "op",
      "2026-10"
    );
    expect(covered.metrics.required).toBe(base.metrics.required);
    expect(covered.metrics.covered).toBe(base.metrics.covered + 5);
    expect(covered.metrics.coverage).toBeGreaterThan(base.metrics.coverage);
  });

  it("distribuição parcial: só os plantões escolhidos são cobertos", async () => {
    const sub = { ...FERIAS_ANA, covered: ["2026-10-13", "2026-10-15"] };
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()], [sub]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([13, 15]);
  });

  it("rodízio específico: dois substitutos dividem os plantões de um titular comercial (um Par, outro Ímpar)", async () => {
    const comercial = person("Carla", "COMERCIAL", null, [
      { id: "fr-carla", code: "FR", from: "2026-10-12", to: "2026-10-23" }
    ]);
    const subs: Sub[] = [
      {
        id: "sA",
        leaveId: "fr-carla",
        titular: "Carla",
        substitute: "Ana",
        from: "2026-10-12",
        to: "2026-10-23",
        rotation: "SPECIFIC",
        parity: "EVEN",
        reference: "2026-10"
      },
      {
        id: "sB",
        leaveId: "fr-carla",
        titular: "Carla",
        substitute: "Bia",
        from: "2026-10-12",
        to: "2026-10-23",
        rotation: "SPECIFIC",
        parity: "ODD",
        reference: "2026-10"
      }
    ];
    const ana = person("Ana", "DIURNO", "ODD"); // folga nos dias pares
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ana, BIA(), comercial], subs),
      user,
      "op",
      "2026-10"
    );
    // dias úteis da Carla no período: 12-16 e 19-23; Ana (folga nos pares) cobre os pares; Bia (folga nos ímpares), os ímpares
    expect(daysWith(rowOf(snapshot, "Ana").days, "C")).toEqual([12, 14, 16, 20, 22]);
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([13, 15, 19, 21, 23]);
    expect(onlyRestWarnings(snapshot.pendencies)).toBe(true);
  });

  it("não cobre quando o substituto já trabalha no dia (mesmo rodízio do titular): vira ocorrência, não C", async () => {
    const carlos = person("Carlos", "DIURNO", "ODD"); // mesmo rodízio da Ana
    const sub = { ...FERIAS_ANA, substitute: "Carlos" };
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), carlos], [sub]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Carlos").days, "C")).toEqual([]);
    const conflicts = snapshot.pendencies.filter((p) =>
      p.reasonCodes.includes("SUBSTITUTION_SUBSTITUTE_ON_DUTY")
    );
    expect(conflicts.map((c) => c.date)).toEqual(
      ["11", "13", "15", "17", "19"].map((d) => `2026-10-${d}`)
    );
    expect(conflicts[0]).toMatchObject({ employeeName: "Ana", otherName: "Carlos" });
  });

  it("substituto afastado em parte do período: os outros dias são cobertos, o afastado vira ocorrência", async () => {
    const bia = person("Bia", "DIURNO", "EVEN", [
      { id: "at-bia", code: "AT", from: "2026-10-14", to: "2026-10-16" }
    ]);
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), bia], [FERIAS_ANA]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([11, 13, 17, 19]);
    const leave = snapshot.pendencies.find((p) =>
      p.reasonCodes.includes("SUBSTITUTION_SUBSTITUTE_ON_LEAVE")
    );
    expect(leave).toMatchObject({ date: "2026-10-15", employeeName: "Ana", otherName: "Bia" });
  });

  it("duas substituições para o mesmo titular: a primeira cadastrada cobre; a segunda recebe a ocorrência", async () => {
    const dani = person("Dani", "DIURNO", "EVEN");
    const second: Sub = {
      ...FERIAS_ANA,
      id: "s2",
      substitute: "Dani",
      createdAt: "2026-09-02T00:00:00Z"
    };
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA(), dani], [second, FERIAS_ANA]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([11, 13, 15, 17, 19]);
    expect(daysWith(rowOf(snapshot, "Dani").days, "C")).toEqual([]);
    expect(
      snapshot.pendencies.filter((p) => p.reasonCodes.includes("SUBSTITUTION_DAY_ALREADY_COVERED"))
    ).toHaveLength(5);
  });

  it("o mesmo substituto cobrindo dois titulares no mesmo dia: o segundo recebe a ocorrência", async () => {
    const cris = person("Cris", "DIURNO", "ODD", [
      { id: "fr-cris", code: "FR", from: "2026-10-10", to: "2026-10-20" }
    ]);
    const second: Sub = {
      id: "s2",
      leaveId: "fr-cris",
      titular: "Cris",
      substitute: "Bia",
      from: "2026-10-10",
      to: "2026-10-20",
      createdAt: "2026-09-02T00:00:00Z"
    };
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA(), cris], [FERIAS_ANA, second]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([11, 13, 15, 17, 19]);
    expect(
      snapshot.pendencies.filter((p) =>
        p.reasonCodes.includes("SUBSTITUTION_SUBSTITUTE_ALREADY_COVERING")
      )
    ).toHaveLength(5);
  });

  it("ajuste manual no dia do substituto vale sobre a substituição", async () => {
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()], [FERIAS_ANA], [{ employee: "Bia", date: "2026-10-13", code: "F" }]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([11, 15, 17, 19]);
    expect(rowOf(snapshot, "Bia").days[12]).toBe("F");
    expect(
      snapshot.pendencies.find((p) => p.reasonCodes.includes("SUBSTITUTION_MANUAL_ADJUSTMENT"))
    ).toMatchObject({
      date: "2026-10-13"
    });
  });

  it("férias que atravessam dois meses: a classificação Par/Ímpar inverte em novembro e a cobertura acompanha", async () => {
    const ana = person("Ana", "DIURNO", "ODD", [
      { id: "fr-ana", code: "FR", from: "2026-10-28", to: "2026-11-05" }
    ]);
    const sub: Sub = { ...FERIAS_ANA, from: "2026-10-28", to: "2026-11-05" };
    const db = fakeDb([ana, BIA()], [sub]);
    const oct = await buildEmployeeScheduleSnapshot(db, user, "op", "2026-10");
    const nov = await buildEmployeeScheduleSnapshot(db, user, "op", "2026-11");
    // Ana: ímpar em outubro (29 e 31) e, depois do mês de 31 dias, trabalharia nos dias pares de novembro (2 e 4)
    expect(daysWith(rowOf(oct, "Bia").days, "C")).toEqual([29, 31]);
    expect(daysWith(rowOf(nov, "Bia").days, "C")).toEqual([2, 4]);
    expect(daysWith(rowOf(nov, "Ana").days, "FR")).toEqual([1, 2, 3, 4, 5]);
  });

  it("antes do início ou depois do fim do afastamento a substituição não produz nada", async () => {
    const nov = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()], [FERIAS_ANA]),
      user,
      "op",
      "2026-11"
    );
    expect(daysWith(rowOf(nov, "Bia").days, "C")).toEqual([]);
    expect(nov.substitutionCells).toEqual([]);
  });

  it("substituição cuja configuração cobre as datas só no período do afastamento ignora datas fora dele", async () => {
    const sub = { ...FERIAS_ANA, covered: ["2026-10-01", "2026-10-13"] }; // dia 1 está fora das férias
    const snapshot = await buildEmployeeScheduleSnapshot(
      fakeDb([ANA(), BIA()], [sub]),
      user,
      "op",
      "2026-10"
    );
    expect(daysWith(rowOf(snapshot, "Bia").days, "C")).toEqual([13]);
  });
});

describe("revalidação de uma grade com substituição", () => {
  it("sem edição, recalcular pendências e métricas a partir da grade reproduz o resultado da geração", async () => {
    const subs = [FERIAS_ANA, { ...FERIAS_ANA, id: "s2", substitute: "Carlos" }];
    const people = [ANA(), BIA(), person("Carlos", "DIURNO", "ODD")];
    const db = fakeDb(people, subs);
    const generated = await buildEmployeeScheduleSnapshot(db, user, "op", "2026-10");
    const ctx = await loadScheduleContext(db, user, "op", "2026-10", {
      onlyEmployeeIds: people.map((p) => p.id)
    });
    const recomputed = recomputeResult(ctx, generated.grid, new Map());
    expect(recomputed.metrics).toEqual(generated.metrics);
    const sort = (list: typeof generated.pendencies) =>
      [...list].sort((a, b) =>
        `${a.employeeId}${a.date}${a.reasonCodes}`.localeCompare(
          `${b.employeeId}${b.date}${b.reasonCodes}`
        )
      );
    expect(sort(recomputed.pendencies)).toEqual(sort(generated.pendencies));
  });
});
