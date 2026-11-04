import { describe, expect, it } from "vitest";
import {
  labAtualizarMoldeEntradaSchema,
  labAtualizarParticipanteEntradaSchema,
  labAtualizarTurmaEntradaSchema,
  labBuscaMinimaCaracteres,
  labBuscaSchema,
  labCadastrarParticipanteEntradaSchema,
  labCodigosDeErroDoCadastro,
  labConfigDosMoldesSchema,
  labCriarTurmaEntradaSchema,
  labIncluirNaTurmaEntradaSchema,
  labNomeDaTurmaLimites,
  labParticipanteDoCadastroSchema,
  labTempoLimiteFaixaS,
  labTurmaDetalheSchema
} from "./leadership-lab-cadastro-api.js";
import { labCodigosDeErro } from "./leadership-lab-api.js";

const ID = "6f1d5a9e-2f5b-4d1e-9b0a-3c2d1e0f9a8b";
const OUTRO_ID = "0b7b3a5e-8d34-4c0f-a2b6-5e1f9d7c4a12";
const AGORA = "2026-03-02T13:00:00.000Z";

const colaborador = {
  id: ID,
  nome: "Ana Souza",
  identificador: "MAT-1",
  cargo: "Supervisor de campo",
  operacao: "Operação A",
  molde: { nivel: "supervisor", nome: "Supervisor", liberado: true }
};
const participante = {
  id: OUTRO_ID,
  ativo: true,
  vinculadoEm: AGORA,
  colaborador,
  usuario: { id: ID, nome: "Ana", email: "ana@exemplo.com" }
};

describe("entradas dos cadastros: estritas", () => {
  it("a busca exige o mínimo de letras, ignora espaços nas pontas e recusa campo a mais", () => {
    expect(labBuscaSchema.parse({ busca: "  ab  " })).toEqual({ busca: "ab" });
    expect(labBuscaMinimaCaracteres).toBe(2);
    expect(labBuscaSchema.safeParse({ busca: "a" }).success).toBe(false);
    expect(labBuscaSchema.safeParse({ busca: "   " }).success).toBe(false);
    expect(labBuscaSchema.safeParse({ busca: "x".repeat(81) }).success).toBe(false);
    expect(labBuscaSchema.safeParse({ busca: "ab", todos: "1" }).success).toBe(false);
    expect(labBuscaSchema.safeParse({}).success).toBe(false);
  });

  it("cadastrar participante pede dois UUIDs e nada além", () => {
    expect(
      labCadastrarParticipanteEntradaSchema.safeParse({ userId: ID, employeeId: OUTRO_ID }).success
    ).toBe(true);
    for (const corpo of [
      { userId: ID },
      { userId: ID, employeeId: "x" },
      { userId: ID, employeeId: OUTRO_ID, ativo: false }
    ]) {
      expect(labCadastrarParticipanteEntradaSchema.safeParse(corpo).success).toBe(false);
    }
  });

  it("atualizar participante só aceita 'ativo' booleano", () => {
    expect(labAtualizarParticipanteEntradaSchema.safeParse({ ativo: false }).success).toBe(true);
    for (const corpo of [{}, { ativo: "sim" }, { ativo: true, userId: ID }]) {
      expect(labAtualizarParticipanteEntradaSchema.safeParse(corpo).success).toBe(false);
    }
  });

  it("o nome da turma respeita os limites e perde os espaços das pontas", () => {
    expect(labCriarTurmaEntradaSchema.parse({ nome: "  Supervisores  " })).toEqual({
      nome: "Supervisores"
    });
    expect(labCriarTurmaEntradaSchema.safeParse({ nome: "A" }).success).toBe(false);
    expect(
      labCriarTurmaEntradaSchema.safeParse({ nome: "x".repeat(labNomeDaTurmaLimites.max) }).success
    ).toBe(true);
    expect(
      labCriarTurmaEntradaSchema.safeParse({ nome: "x".repeat(labNomeDaTurmaLimites.max + 1) })
        .success
    ).toBe(false);
    expect(labCriarTurmaEntradaSchema.safeParse({ nome: "Turma", curadorId: ID }).success).toBe(
      false
    );
  });

  it("atualizar turma exige ao menos um campo", () => {
    expect(labAtualizarTurmaEntradaSchema.safeParse({}).success).toBe(false);
    expect(labAtualizarTurmaEntradaSchema.safeParse({ nome: "Novo nome" }).success).toBe(true);
    expect(labAtualizarTurmaEntradaSchema.safeParse({ ativa: false }).success).toBe(true);
    expect(labAtualizarTurmaEntradaSchema.safeParse({ ativa: "x" }).success).toBe(false);
  });

  it("incluir na turma pede o id do participante", () => {
    expect(labIncluirNaTurmaEntradaSchema.safeParse({ participanteId: ID }).success).toBe(true);
    expect(labIncluirNaTurmaEntradaSchema.safeParse({ participanteId: "x" }).success).toBe(false);
    expect(labIncluirNaTurmaEntradaSchema.safeParse({}).success).toBe(false);
  });

  describe("molde", () => {
    const valido = { tempoLimiteS: 45, ativo: true, cargoIds: [ID] };

    it("aceita o estado completo, com ou sem tempo", () => {
      expect(labAtualizarMoldeEntradaSchema.safeParse(valido).success).toBe(true);
      expect(
        labAtualizarMoldeEntradaSchema.safeParse({ tempoLimiteS: null, ativo: false, cargoIds: [] })
          .success
      ).toBe(true);
    });

    it("o tempo tem faixa, é inteiro e não tem valor sugerido", () => {
      const tempo = (t: unknown) =>
        labAtualizarMoldeEntradaSchema.safeParse({ ...valido, tempoLimiteS: t }).success;
      expect(tempo(labTempoLimiteFaixaS.min)).toBe(true);
      expect(tempo(labTempoLimiteFaixaS.max)).toBe(true);
      for (const ruim of [0, -1, 1.5, labTempoLimiteFaixaS.max + 1, "45", undefined]) {
        expect(tempo(ruim), String(ruim)).toBe(false);
      }
    });

    it("recusa campos a mais (temas e número de situações não se mudam por aqui) e falta de campo", () => {
      for (const corpo of [
        { ...valido, temas: ["x"] },
        { ...valido, numeroSituacoes: 9 },
        { tempoLimiteS: 45, ativo: true },
        { tempoLimiteS: 45, cargoIds: [] },
        { ...valido, cargoIds: ["x"] },
        { ...valido, cargoIds: Array.from({ length: 501 }, () => ID) }
      ]) {
        expect(labAtualizarMoldeEntradaSchema.safeParse(corpo).success).toBe(false);
      }
    });
  });
});

describe("saídas dos cadastros", () => {
  it("o participante do cadastro: aceita o contrato e descarta o que não é dele", () => {
    const lido = labParticipanteDoCadastroSchema.parse({
      ...participante,
      passwordHash: "segredo"
    });
    expect(lido).toEqual(participante);
    expect(JSON.stringify(lido)).not.toContain("segredo");
  });

  it("o colaborador pode estar sem cargo e sem molde", () => {
    expect(
      labParticipanteDoCadastroSchema.safeParse({
        ...participante,
        colaborador: { ...colaborador, cargo: null, molde: null }
      }).success
    ).toBe(true);
  });

  it("recusa nível de molde desconhecido e data que não é ISO", () => {
    expect(
      labParticipanteDoCadastroSchema.safeParse({
        ...participante,
        colaborador: { ...colaborador, molde: { nivel: "diretor", nome: "x", liberado: true } }
      }).success
    ).toBe(false);
    expect(
      labParticipanteDoCadastroSchema.safeParse({ ...participante, vinculadoEm: "02/03/2026" })
        .success
    ).toBe(false);
  });

  it("o detalhe da turma traz o resumo e a lista de participantes", () => {
    const turma = { id: ID, nome: "Turma", ativa: true, criadaEm: AGORA, nParticipantes: 1 };
    expect(
      labTurmaDetalheSchema.safeParse({ ...turma, participantes: [participante] }).success
    ).toBe(true);
    expect(labTurmaDetalheSchema.safeParse(turma).success).toBe(false);
    expect(
      labTurmaDetalheSchema.safeParse({ ...turma, nParticipantes: -1, participantes: [] }).success
    ).toBe(false);
  });

  it("a configuração dos moldes traz moldes e cargos", () => {
    const config = {
      moldes: [
        {
          id: ID,
          nivel: "supervisor",
          nome: "Supervisor",
          temas: ["Comunicação"],
          numeroSituacoes: 5,
          tempoLimiteS: null,
          ativo: false,
          cargoIds: [],
          testesEmAndamento: 0
        }
      ],
      cargos: [{ id: OUTRO_ID, nome: "Supervisor de campo", moldeNivel: null }]
    };
    expect(labConfigDosMoldesSchema.parse(config)).toEqual(config);
    expect(labConfigDosMoldesSchema.safeParse({ moldes: config.moldes }).success).toBe(false);
  });
});

describe("códigos de erro do cadastro", () => {
  it("não repetem nenhum e não colidem com os do módulo", () => {
    expect(new Set(labCodigosDeErroDoCadastro).size).toBe(labCodigosDeErroDoCadastro.length);
    for (const codigo of labCodigosDeErroDoCadastro) {
      expect((labCodigosDeErro as readonly string[]).includes(codigo), codigo).toBe(false);
    }
  });
});
