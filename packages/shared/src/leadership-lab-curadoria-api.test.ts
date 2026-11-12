import { describe, expect, it } from "vitest";
import { labCodigosDeErro } from "./leadership-lab-api.js";
import { labCodigosDeErroDoCadastro } from "./leadership-lab-cadastro-api.js";
import {
  labAlertaDoCuradorSchema,
  labCodigosDeErroDaCuradoria,
  labContestacaoDoCuradorSchema,
  labContestacaoPropriaSchema,
  labCriarContestacaoEntradaSchema,
  labDecidirContestacaoEntradaSchema,
  labDecidirContribuicaoEntradaSchema,
  labFichaDeRevisaoSchema,
  labFiltroDaRevisaoSchema,
  labFiltroDeAlertasSchema,
  labFiltroDeContestacoesSchema,
  labFiltroDeContribuicoesSchema,
  labLimitesDeTexto,
  labTratarAlertaEntradaSchema,
  labValidarResultadoEntradaSchema
} from "./leadership-lab-curadoria-api.js";

const ID = "6f1d5a9e-2f5b-4d1e-9b0a-3c2d1e0f9a8b";
const AGORA = "2026-03-02T13:00:00.000Z";
const participante = {
  id: ID,
  nome: "Ana Souza",
  identificador: "MAT-1",
  cargo: "Supervisor de campo",
  operacao: "Operação A"
};

describe("filtros da curadoria", () => {
  it("cada lista tem o seu padrão e recusa o que não conhece", () => {
    expect(labFiltroDaRevisaoSchema.parse({})).toEqual({ status: "aguardando_validacao" });
    expect(labFiltroDeAlertasSchema.parse({})).toEqual({ status: "aberto" });
    expect(labFiltroDeContribuicoesSchema.parse({})).toEqual({ status: "pendente" });
    expect(labFiltroDeContestacoesSchema.parse({})).toEqual({ status: "pendente" });

    expect(labFiltroDaRevisaoSchema.parse({ status: "todos" }).status).toBe("todos");
    expect(labFiltroDeContribuicoesSchema.parse({ status: "todas" }).status).toBe("todas");
    expect(labFiltroDeContestacoesSchema.parse({ status: "aceita" }).status).toBe("aceita");

    for (const [schema, ruim] of [
      [labFiltroDaRevisaoSchema, { status: "aceita" }],
      [labFiltroDeAlertasSchema, { status: "pendente" }],
      [labFiltroDeContribuicoesSchema, { status: "aceita" }],
      [labFiltroDeContestacoesSchema, { status: "aprovada" }],
      [labFiltroDaRevisaoSchema, { status: "todos", limite: 1 }]
    ] as const) {
      expect(schema.safeParse(ruim).success, JSON.stringify(ruim)).toBe(false);
    }
  });
});

describe("validar o resultado", () => {
  it("sem nada vale como 'validar como está'; com ajustes, cada um tem skill e nível de 1 a 5", () => {
    expect(labValidarResultadoEntradaSchema.parse({})).toEqual({ ajustes: [] });
    expect(
      labValidarResultadoEntradaSchema.parse({
        ajustes: [{ skillId: "gestao-os", nivel: 3 }],
        justificativa: "  Porque sim.  "
      })
    ).toEqual({ ajustes: [{ skillId: "gestao-os", nivel: 3 }], justificativa: "Porque sim." });
  });

  it("recusa nível fora da faixa, não inteiro, campo a mais e justificativa vazia ou longa", () => {
    const ajuste = (nivel: unknown) => ({ ajustes: [{ skillId: "gestao-os", nivel }] });
    for (const ruim of [
      ajuste(0),
      ajuste(6),
      ajuste(2.5),
      ajuste("3"),
      { ajustes: [{ skillId: "gestao-os" }] },
      { ajustes: [{ skillId: "", nivel: 3 }] },
      { status: "validado" },
      { justificativa: "" },
      { justificativa: "   " },
      { justificativa: "x".repeat(labLimitesDeTexto.nota + 1) },
      { ajustes: Array.from({ length: 21 }, () => ({ skillId: "gestao-os", nivel: 3 })) }
    ]) {
      expect(
        labValidarResultadoEntradaSchema.safeParse(ruim).success,
        JSON.stringify(ruim).slice(0, 60)
      ).toBe(false);
    }
  });
});

describe("decisões e notas", () => {
  it("encerrar o alerta e decidir a contestação exigem a nota; a contribuição, só a decisão", () => {
    expect(labTratarAlertaEntradaSchema.safeParse({ nota: "Conversamos." }).success).toBe(true);
    for (const ruim of [
      {},
      { nota: "" },
      { nota: "  " },
      { nota: "x".repeat(1001) },
      { nota: "x", extra: 1 }
    ]) {
      expect(labTratarAlertaEntradaSchema.safeParse(ruim).success).toBe(false);
    }

    expect(
      labDecidirContestacaoEntradaSchema.safeParse({ decisao: "aceita", nota: "ok" }).success
    ).toBe(true);
    expect(
      labDecidirContestacaoEntradaSchema.safeParse({ decisao: "rejeitada", nota: "ok" }).success
    ).toBe(true);
    for (const ruim of [
      { decisao: "aceita" },
      { nota: "ok" },
      { decisao: "pendente", nota: "ok" },
      { decisao: "aprovada", nota: "ok" },
      { decisao: "aceita", nota: "" }
    ]) {
      expect(labDecidirContestacaoEntradaSchema.safeParse(ruim).success).toBe(false);
    }

    expect(labDecidirContribuicaoEntradaSchema.safeParse({ decisao: "aprovada" }).success).toBe(
      true
    );
    for (const ruim of [
      {},
      { decisao: "aceita" },
      { decisao: "pendente" },
      { decisao: "aprovada", nota: "x" }
    ]) {
      expect(labDecidirContribuicaoEntradaSchema.safeParse(ruim).success).toBe(false);
    }
  });

  it("a contestação do participante tem ponto e motivo, com os tetos do contrato", () => {
    expect(
      labCriarContestacaoEntradaSchema.parse({ ponto: " Situação 2 ", motivo: " Porque. " })
    ).toEqual({
      ponto: "Situação 2",
      motivo: "Porque."
    });
    for (const ruim of [
      {},
      { ponto: "x" },
      { ponto: "", motivo: "y" },
      { ponto: "x", motivo: "  " },
      { ponto: "x".repeat(labLimitesDeTexto.ponto + 1), motivo: "y" },
      { ponto: "x", motivo: "y".repeat(labLimitesDeTexto.motivo + 1) },
      { ponto: "x", motivo: "y", status: "aceita" }
    ]) {
      expect(
        labCriarContestacaoEntradaSchema.safeParse(ruim).success,
        JSON.stringify(ruim).slice(0, 60)
      ).toBe(false);
    }
  });
});

describe("saídas da curadoria", () => {
  const alerta = {
    id: ID,
    cor: "vermelho",
    status: "aberto",
    criadoEm: AGORA,
    skillNome: null,
    situacao: 2,
    participante,
    sessaoId: ID,
    resultadoId: null,
    testeConcluido: false,
    tratadoEm: null,
    tratadoPor: null,
    nota: null
  };

  it("o alerta aceita teste em andamento (sem resultado) e recusa cor desconhecida", () => {
    expect(labAlertaDoCuradorSchema.parse(alerta)).toEqual(alerta);
    expect(labAlertaDoCuradorSchema.safeParse({ ...alerta, cor: "azul" }).success).toBe(false);
  });

  it("a contestação do participante NUNCA carrega quem decidiu", () => {
    const propria = labContestacaoPropriaSchema.parse({
      id: ID,
      ponto: "Situação 2",
      motivo: "Porque.",
      status: "aceita",
      criadoEm: AGORA,
      decididoEm: AGORA,
      nota: "Faz sentido.",
      decididoPor: "Fulana"
    });
    expect(Object.keys(propria)).not.toContain("decididoPor");
    expect(JSON.stringify(propria)).not.toContain("Fulana");
  });

  it("a contestação do curador diz quem decidiu e em que estado está o resultado", () => {
    const c = {
      id: ID,
      ponto: "x",
      motivo: "y",
      status: "pendente",
      criadoEm: AGORA,
      participante,
      resultadoId: ID,
      sessaoId: ID,
      statusValidacao: "aguardando_validacao",
      decididoEm: null,
      decididoPor: null,
      nota: null
    };
    expect(labContestacaoDoCuradorSchema.parse(c)).toEqual(c);
    expect(
      labContestacaoDoCuradorSchema.safeParse({ ...c, statusValidacao: "talvez" }).success
    ).toBe(false);
  });

  it("a ficha exige todos os blocos e descarta o que não é do contrato", () => {
    const ficha = {
      resultadoId: ID,
      sessaoId: ID,
      concluidaEm: AGORA,
      statusValidacao: "aguardando_validacao",
      experimental: true,
      participante,
      moldeNome: "Supervisor",
      aderenciaGeral: 76,
      agilidade: 88.33,
      estiloPredominante: "orientacao",
      flexibilidade: "media",
      flexibilidadePct: 50,
      resumo: "Bom.",
      pontoForte: null,
      pontoDesenvolvimento: null,
      sugestoes: [],
      skills: [
        {
          skillId: "gestao-os",
          nome: "Gestão de OS",
          tipo: "hard",
          nivelCalculado: 4,
          media: 85,
          nEvidencias: 2,
          nivelValidado: null
        }
      ],
      situacoes: [],
      validacao: { validadoPor: null, validadoEm: null, justificativa: null },
      alertas: [],
      contribuicoes: [],
      contestacoes: []
    };
    expect(labFichaDeRevisaoSchema.parse({ ...ficha, respostaIa: { segredo: 1 } })).toEqual(ficha);
    const { validacao: _validacao, ...semValidacao } = ficha;
    expect(_validacao).toBeDefined();
    expect(labFichaDeRevisaoSchema.safeParse(semValidacao).success).toBe(false);
    expect(
      labFichaDeRevisaoSchema.safeParse({
        ...ficha,
        skills: [{ ...ficha.skills[0], nivelValidado: 6 }]
      }).success
    ).toBe(false);
  });
});

describe("códigos de erro da curadoria", () => {
  it("não repetem nenhum e não colidem com os do módulo nem com os do cadastro", () => {
    expect(new Set(labCodigosDeErroDaCuradoria).size).toBe(labCodigosDeErroDaCuradoria.length);
    for (const codigo of labCodigosDeErroDaCuradoria) {
      expect((labCodigosDeErro as readonly string[]).includes(codigo), codigo).toBe(false);
      expect((labCodigosDeErroDoCadastro as readonly string[]).includes(codigo), codigo).toBe(
        false
      );
    }
  });
});
