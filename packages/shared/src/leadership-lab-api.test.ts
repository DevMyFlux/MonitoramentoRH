import { describe, expect, it } from "vitest";
import {
  labCodigosDeErro,
  labEstadoDoTesteSchema,
  labPainelSchema,
  labRespostaDoTesteSchema,
  labResultadoSchema,
  labSituacaoSchema,
  labTermoSchema,
  labTipoDePerfilSchema
} from "./leadership-lab-api.js";

const AGORA = "2026-03-02T13:00:00.000Z";

const opcoes = [
  { id: "A", texto: "Reunir a equipe e redistribuir as tarefas." },
  { id: "B", texto: "Resolver sozinho." },
  { id: "C", texto: "Esperar o cliente se manifestar." }
];

const situacao = {
  numero: 2,
  marco: false,
  texto: "Um cliente reclama do atraso.",
  opcoes,
  consequencia: "A equipe se reorganizou.",
  tempoLimiteS: 60,
  tempoRestanteMs: 45_000
};

const resultado = {
  resultadoId: "r1",
  sessaoId: "s1",
  concluidaEm: AGORA,
  statusValidacao: "aguardando_validacao",
  aderenciaGeral: 76,
  agilidade: 88.33,
  niveisPorSkill: [
    {
      skillId: "gestao-os",
      nome: "Gestão de OS",
      tipo: "hard",
      nivel: 4,
      media: 85,
      nEvidencias: 2
    }
  ],
  resumo: "Bom desempenho.",
  pontoForte: "Comunicação.",
  pontoDesenvolvimento: null,
  sugestoes: ["Praticar a delegação."],
  situacoes: [
    {
      numero: 1,
      marco: false,
      texto: "Texto.",
      opcoes,
      escolha: "A",
      tempoEsgotado: false,
      aderencia: 100,
      tempoRespostaMs: 8_000,
      justificativa: "Porque sim.",
      consequencia: null
    }
  ]
};

const painel = {
  termo: { versaoAtual: "2026-1", aceito: true, aceitoEm: AGORA },
  acao: { tipo: "iniciar", molde: { id: "m1", nivel: "supervisor", nome: "Supervisor" } },
  indicadores: {
    testesFeitos: 0,
    testesValidados: 0,
    aderenciaMedia: null,
    agilidadeMedia: null,
    ultimoTesteEm: null
  },
  evolucao: { pontos: [], tendenciaDisponivel: false },
  skills: [
    {
      skillId: "gestao-os",
      nome: "Gestão de OS",
      tipo: "hard",
      nivel: null,
      nivelCalculado: null,
      validado: false,
      nEvidencias: 0,
      resultadoId: null,
      sessaoId: null,
      atualizadoEm: null
    }
  ],
  tipoDePerfil: { disponivel: false, testesFeitos: 0, testesNecessarios: 3 },
  alertas: [],
  sugestoes: { itens: [], origem: null }
};

describe("contrato das respostas do Leadership Lab", () => {
  describe("termo", () => {
    it("aceita aceito e pendente", () => {
      expect(
        labTermoSchema.parse({ versaoAtual: "2026-1", aceito: true, aceitoEm: AGORA })
      ).toEqual({ versaoAtual: "2026-1", aceito: true, aceitoEm: AGORA });
      expect(
        labTermoSchema.safeParse({ versaoAtual: "2026-1", aceito: false, aceitoEm: null }).success
      ).toBe(true);
    });

    it("recusa data que não é ISO 8601", () => {
      expect(
        labTermoSchema.safeParse({ versaoAtual: "2026-1", aceito: true, aceitoEm: "02/03/2026" })
          .success
      ).toBe(false);
    });
  });

  describe("painel", () => {
    it("aceita o painel de quem ainda não fez nenhum teste", () => {
      expect(labPainelSchema.parse(painel)).toEqual(painel);
    });

    it.each([
      {
        nome: "continuar",
        acao: {
          tipo: "continuar",
          sessaoId: "s1",
          situacaoAtual: 3,
          totalSituacoes: 5,
          molde: { id: "m1", nivel: "supervisor", nome: "Supervisor" }
        }
      },
      {
        nome: "indisponível por limite diário",
        acao: { tipo: "indisponivel", motivo: "limite-diario", molde: null, limiteDiario: 2 }
      },
      {
        nome: "indisponível por termo pendente",
        acao: { tipo: "indisponivel", motivo: "termo-pendente", molde: null, limiteDiario: null }
      }
    ])("aceita a ação $nome", ({ acao }) => {
      expect(labPainelSchema.safeParse({ ...painel, acao }).success).toBe(true);
    });

    it("recusa ação desconhecida e motivo desconhecido", () => {
      expect(labPainelSchema.safeParse({ ...painel, acao: { tipo: "pular" } }).success).toBe(false);
      expect(
        labPainelSchema.safeParse({
          ...painel,
          acao: { tipo: "indisponivel", motivo: "porque-sim", molde: null, limiteDiario: null }
        }).success
      ).toBe(false);
    });

    it("recusa o painel a que falta um bloco", () => {
      const { acao: _acao, ...semAcao } = painel;
      expect(_acao).toBeDefined();
      expect(labPainelSchema.safeParse(semAcao).success).toBe(false);
    });

    it("o perfil só traz estilo e flexibilidade quando disponível", () => {
      expect(
        labTipoDePerfilSchema.safeParse({
          disponivel: false,
          testesFeitos: 1,
          testesNecessarios: 3
        }).success
      ).toBe(true);
      // "disponível" sem os campos do perfil não vale.
      expect(labTipoDePerfilSchema.safeParse({ disponivel: true }).success).toBe(false);
      expect(
        labTipoDePerfilSchema.safeParse({
          disponivel: true,
          estiloPredominante: null,
          estilosEmpatados: ["direcao", "apoio"],
          distribuicao: { direcao: 2, orientacao: 0, apoio: 2, delegacao: 0 },
          flexibilidade: "media",
          flexibilidadePct: 50,
          nEscolhas: 4,
          testesConsiderados: 3,
          testesAguardandoValidacao: 1
        }).success
      ).toBe(true);
    });

    it("recusa estilo que não existe", () => {
      expect(
        labTipoDePerfilSchema.safeParse({
          disponivel: true,
          estiloPredominante: "autoritario",
          estilosEmpatados: [],
          distribuicao: { direcao: 0, orientacao: 0, apoio: 0, delegacao: 0 },
          flexibilidade: null,
          flexibilidadePct: null,
          nEscolhas: 0,
          testesConsiderados: 0,
          testesAguardandoValidacao: 0
        }).success
      ).toBe(false);
    });
  });

  describe("situação do teste", () => {
    it("aceita uma situação com 3 opções", () => {
      expect(labSituacaoSchema.parse(situacao)).toEqual(situacao);
    });

    it("recusa número de opções diferente de 3, letra desconhecida e tempo negativo", () => {
      expect(labSituacaoSchema.safeParse({ ...situacao, opcoes: opcoes.slice(0, 2) }).success).toBe(
        false
      );
      expect(
        labSituacaoSchema.safeParse({
          ...situacao,
          opcoes: [...opcoes.slice(0, 2), { id: "D", texto: "?" }]
        }).success
      ).toBe(false);
      expect(labSituacaoSchema.safeParse({ ...situacao, tempoRestanteMs: -1 }).success).toBe(false);
    });

    it("descarta o que não é do contrato: um campo de avaliação que vazasse não chega à tela", () => {
      const vazada = { ...situacao, aderencia: 100, estilo: "direcao", justificativa: "segredo" };
      const lida = labSituacaoSchema.parse(vazada);
      expect(lida).toEqual(situacao);
      expect(JSON.stringify(lida)).not.toContain("segredo");
    });
  });

  describe("resposta do teste", () => {
    const deSituacao = {
      tipo: "situacao",
      sessaoId: "s1",
      totalSituacoes: 5,
      tempoEsgotadoNaAnterior: false,
      situacao
    };
    const deResultado = {
      tipo: "resultado",
      sessaoId: "s1",
      tempoEsgotadoNaAnterior: false,
      consequencia: "Fim.",
      resultado
    };
    const emProcessamento = {
      tipo: "em-processamento",
      sessaoId: "s1",
      numero: 2,
      totalSituacoes: 5
    };

    it("POST devolve situação ou resultado, nunca 'em-processamento'", () => {
      expect(labRespostaDoTesteSchema.safeParse(deSituacao).success).toBe(true);
      expect(labRespostaDoTesteSchema.safeParse(deResultado).success).toBe(true);
      expect(labRespostaDoTesteSchema.safeParse(emProcessamento).success).toBe(false);
    });

    it("GET /sessoes/atual devolve situação ou 'em-processamento', nunca resultado", () => {
      expect(labEstadoDoTesteSchema.safeParse(deSituacao).success).toBe(true);
      expect(labEstadoDoTesteSchema.safeParse(emProcessamento).success).toBe(true);
      expect(labEstadoDoTesteSchema.safeParse(deResultado).success).toBe(false);
    });

    it("recusa tipo desconhecido", () => {
      expect(labRespostaDoTesteSchema.safeParse({ ...deSituacao, tipo: "outra" }).success).toBe(
        false
      );
    });
  });

  describe("resultado", () => {
    it("aceita o resultado completo", () => {
      expect(labResultadoSchema.parse(resultado)).toEqual(resultado);
    });

    it("aceita a omissão (sem escolha e sem tempo de resposta)", () => {
      const omitida = {
        ...resultado,
        situacoes: [
          {
            ...resultado.situacoes[0],
            escolha: null,
            tempoEsgotado: true,
            aderencia: 0,
            tempoRespostaMs: null
          }
        ]
      };
      expect(labResultadoSchema.safeParse(omitida).success).toBe(true);
    });

    it("recusa status de validação desconhecido", () => {
      expect(
        labResultadoSchema.safeParse({ ...resultado, statusValidacao: "talvez" }).success
      ).toBe(false);
    });
  });

  it("a lista de códigos de erro não repete nenhum", () => {
    expect(new Set(labCodigosDeErro).size).toBe(labCodigosDeErro.length);
  });
});
