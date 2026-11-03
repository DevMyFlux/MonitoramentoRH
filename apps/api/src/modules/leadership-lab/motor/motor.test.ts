import { describe, expect, it } from "vitest";
import {
  ConfigDoLabInvalida,
  FUSO_PADRAO,
  IA_TIMEOUT_PADRAO_MS,
  lerConfigDoLab
} from "./config.js";
import {
  LIMITE_CARACTERES_CAMPO_LIVRE,
  iniciarEntradaSchema,
  responderEntradaSchema,
  tempoEsgotadoEntradaSchema
} from "./entradas.js";
import { inicioDoDia } from "./tempo-do-dia.js";
import { visaoDaSituacao, visaoDoResultado } from "./visoes.js";

describe("lerConfigDoLab", () => {
  it("exige a tolerância de tempo: sem valor padrão, para não decidir a nota por conta própria", () => {
    expect(() => lerConfigDoLab({})).toThrow(ConfigDoLabInvalida);
    expect(() => lerConfigDoLab({ LAB_TOLERANCIA_TEMPO_S: "  " })).toThrow(/obrigatória/);
  });

  it("aceita 0 (sem desconto) e decimais", () => {
    expect(lerConfigDoLab({ LAB_TOLERANCIA_TEMPO_S: "0" }).toleranciaTempoS).toBe(0);
    expect(lerConfigDoLab({ LAB_TOLERANCIA_TEMPO_S: "2.5" }).toleranciaTempoS).toBe(2.5);
  });

  it("usa os padrões documentados quando só a tolerância é informada", () => {
    expect(lerConfigDoLab({ LAB_TOLERANCIA_TEMPO_S: "3" })).toMatchObject({
      toleranciaTempoS: 3,
      limiteTestesDia: null,
      fusoHorario: FUSO_PADRAO,
      iaTimeoutMs: IA_TIMEOUT_PADRAO_MS
    });
  });

  it("lê o limite diário e o timeout da IA", () => {
    const config = lerConfigDoLab({
      LAB_TOLERANCIA_TEMPO_S: "3",
      LAB_LIMITE_TESTES_DIA: "2",
      LAB_IA_TIMEOUT_MS: "8000"
    });
    expect(config).toMatchObject({ limiteTestesDia: 2, iaTimeoutMs: 8000 });
  });

  it.each([
    ["tolerância negativa", { LAB_TOLERANCIA_TEMPO_S: "-1" }, "LAB_TOLERANCIA_TEMPO_S"],
    ["tolerância não numérica", { LAB_TOLERANCIA_TEMPO_S: "três" }, "LAB_TOLERANCIA_TEMPO_S"],
    [
      "limite zero",
      { LAB_TOLERANCIA_TEMPO_S: "3", LAB_LIMITE_TESTES_DIA: "0" },
      "LAB_LIMITE_TESTES_DIA"
    ],
    [
      "limite fracionado",
      { LAB_TOLERANCIA_TEMPO_S: "3", LAB_LIMITE_TESTES_DIA: "1.5" },
      "LAB_LIMITE_TESTES_DIA"
    ],
    [
      "timeout minúsculo",
      { LAB_TOLERANCIA_TEMPO_S: "3", LAB_IA_TIMEOUT_MS: "10" },
      "LAB_IA_TIMEOUT_MS"
    ]
  ])("recusa %s e diz qual variável está errada", (_nome, env, variavel) => {
    expect(() => lerConfigDoLab(env)).toThrow(variavel);
  });
});

describe("inicioDoDia", () => {
  const sp = "America/Sao_Paulo";
  it("o dia começa à meia-noite do fuso, não de UTC", () => {
    // 22h de 1º de março em São Paulo já é 2 de março em UTC.
    expect(inicioDoDia(new Date("2026-03-02T01:00:00Z"), sp).toISOString()).toBe(
      "2026-03-01T03:00:00.000Z"
    );
    expect(inicioDoDia(new Date("2026-03-02T15:00:00Z"), sp).toISOString()).toBe(
      "2026-03-02T03:00:00.000Z"
    );
  });

  it("exatamente à meia-noite local, o dia novo começa", () => {
    expect(inicioDoDia(new Date("2026-03-02T03:00:00Z"), sp).toISOString()).toBe(
      "2026-03-02T03:00:00.000Z"
    );
    expect(inicioDoDia(new Date("2026-03-02T02:59:59.999Z"), sp).toISOString()).toBe(
      "2026-03-01T03:00:00.000Z"
    );
  });

  it("funciona em outros fusos, inclusive com horário de verão", () => {
    expect(inicioDoDia(new Date("2026-03-02T15:00:00Z"), "UTC").toISOString()).toBe(
      "2026-03-02T00:00:00.000Z"
    );
    expect(inicioDoDia(new Date("2026-03-02T15:00:00Z"), "Asia/Tokyo").toISOString()).toBe(
      "2026-03-02T15:00:00.000Z"
    );
    // Nova York: o horário de verão começa em 8 de março de 2026. A meia-noite desse dia ainda é EST (UTC-5).
    expect(inicioDoDia(new Date("2026-03-08T20:00:00Z"), "America/New_York").toISOString()).toBe(
      "2026-03-08T05:00:00.000Z"
    );
    // Depois da virada, EDT (UTC-4).
    expect(inicioDoDia(new Date("2026-03-09T20:00:00Z"), "America/New_York").toISOString()).toBe(
      "2026-03-09T04:00:00.000Z"
    );
  });

  it("o início é sempre anterior ou igual ao instante, e a menos de 25 horas dele", () => {
    for (let h = 0; h < 24 * 5; h += 7) {
      const agora = new Date(Date.parse("2026-03-06T00:00:00Z") + h * 3_600_000);
      const inicio = inicioDoDia(agora, sp);
      expect(inicio.getTime()).toBeLessThanOrEqual(agora.getTime());
      expect(agora.getTime() - inicio.getTime()).toBeLessThan(25 * 3_600_000);
    }
  });
});

describe("entradas do participante", () => {
  it("responder: escolha só A, B ou C; número de 1 a 10; campo extra recusado", () => {
    expect(responderEntradaSchema.safeParse({ numero: 1, escolha: "B" }).success).toBe(true);
    for (const ruim of [
      { numero: 1, escolha: "D" },
      { numero: 0, escolha: "A" },
      { numero: 11, escolha: "A" },
      { numero: 1.5, escolha: "A" },
      { escolha: "A" },
      { numero: 1, escolha: "A", aderencia: 100 },
      { numero: 1, escolha: "A", estilo: "apoio" }
    ]) {
      expect(responderEntradaSchema.safeParse(ruim).success, JSON.stringify(ruim)).toBe(false);
    }
  });

  it("campo livre: opcional, aparado, e com teto de proteção", () => {
    const base = { numero: 2, escolha: "A" } as const;
    expect(
      responderEntradaSchema.parse({ ...base, textoLivre: "  chamaria o gerente  " }).textoLivre
    ).toBe("chamaria o gerente");
    expect(responderEntradaSchema.safeParse({ ...base, textoLivre: null }).success).toBe(true);
    expect(responderEntradaSchema.safeParse({ ...base, textoLivre: "   " }).success).toBe(false);
    expect(
      responderEntradaSchema.safeParse({
        ...base,
        textoLivre: "x".repeat(LIMITE_CARACTERES_CAMPO_LIVRE)
      }).success
    ).toBe(true);
    expect(
      responderEntradaSchema.safeParse({
        ...base,
        textoLivre: "x".repeat(LIMITE_CARACTERES_CAMPO_LIVRE + 1)
      }).success
    ).toBe(false);
  });

  it("iniciar e tempo esgotado são estritos", () => {
    expect(iniciarEntradaSchema.safeParse({}).success).toBe(true);
    expect(iniciarEntradaSchema.safeParse({ moldeId: "não-é-uuid" }).success).toBe(false);
    expect(iniciarEntradaSchema.safeParse({ nivel: "diretor" }).success).toBe(false);
    expect(tempoEsgotadoEntradaSchema.safeParse({ numero: 3 }).success).toBe(true);
    expect(tempoEsgotadoEntradaSchema.safeParse({ numero: 3, aderencia: 0 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Visões: o que sai do servidor
// ---------------------------------------------------------------------------

const opcoes = [
  { id: "A", texto: "a" },
  { id: "B", texto: "b" },
  { id: "C", texto: "c" }
];

/** Uma linha de turno do banco com TUDO o que existe nela, inclusive o que é segredo. */
function linhaDeTurno(extra: Record<string, unknown> = {}) {
  return {
    id: "turno-1",
    sessaoId: "sessao-1",
    numero: 2,
    marco: false,
    texto: "Situação",
    opcoes,
    estiloAdequado: "SEGREDO-estilo-adequado",
    apresentadaEm: new Date("2026-03-02T13:00:00Z"),
    respondidaEm: null,
    escolha: null,
    tempoRespostaMs: null,
    tempoEsgotado: false,
    aderencia: 70,
    estilo: "SEGREDO-estilo",
    alerta: "SEGREDO-alerta",
    justificativa: "SEGREDO-justificativa",
    consequencia: "Efeito.",
    textoLivre: "SEGREDO-texto-livre",
    decisaoGuarda: "seguir",
    processandoAte: null,
    ...extra
  };
}

describe("visaoDaSituacao: o que o participante vê durante o teste", () => {
  const agora = new Date("2026-03-02T13:00:20Z");

  it("só tem número, marco, texto, opções, consequência e tempo", () => {
    const visao = visaoDaSituacao({
      turno: linhaDeTurno(),
      consequenciaAnterior: "O solicitante ligou.",
      tempoLimiteS: 60,
      agora
    });
    expect(Object.keys(visao).sort()).toEqual([
      "consequencia",
      "marco",
      "numero",
      "opcoes",
      "tempoLimiteS",
      "tempoRestanteMs",
      "texto"
    ]);
    expect(visao.opcoes.every((o) => Object.keys(o).sort().join() === "id,texto")).toBe(true);
  });

  it("nada que existe na linha do banco vaza: nem aderência, estilo, alerta, justificativa, texto livre", () => {
    const visao = visaoDaSituacao({
      turno: linhaDeTurno({ opcoes: opcoes.map((o) => ({ ...o, correta: true, aderencia: 100 })) }),
      consequenciaAnterior: null,
      tempoLimiteS: 60,
      agora
    });
    const texto = JSON.stringify(visao);
    expect(texto).not.toContain("SEGREDO");
    expect(texto).not.toContain("aderencia");
    expect(texto).not.toContain("correta");
  });

  it("o tempo restante é calculado no servidor e nunca fica negativo", () => {
    const base = { turno: linhaDeTurno(), consequenciaAnterior: null, tempoLimiteS: 60 };
    expect(
      visaoDaSituacao({ ...base, agora: new Date("2026-03-02T13:00:00Z") }).tempoRestanteMs
    ).toBe(60_000);
    expect(visaoDaSituacao({ ...base, agora }).tempoRestanteMs).toBe(40_000);
    expect(
      visaoDaSituacao({ ...base, agora: new Date("2026-03-02T13:05:00Z") }).tempoRestanteMs
    ).toBe(0);
    // Relógio atrás do início: não passa do limite.
    expect(
      visaoDaSituacao({ ...base, agora: new Date("2026-03-02T12:00:00Z") }).tempoRestanteMs
    ).toBe(60_000);
  });

  it("opções que não são exatamente três (A, B, C) são recusadas", () => {
    expect(() =>
      visaoDaSituacao({
        turno: linhaDeTurno({ opcoes: opcoes.slice(0, 2) }),
        consequenciaAnterior: null,
        tempoLimiteS: 60,
        agora
      })
    ).toThrow();
    expect(() =>
      visaoDaSituacao({
        turno: linhaDeTurno({
          opcoes: [
            { id: "A", texto: "a" },
            { id: "B", texto: "b" },
            { id: "Z", texto: "z" }
          ]
        }),
        consequenciaAnterior: null,
        tempoLimiteS: 60,
        agora
      })
    ).toThrow();
  });
});

describe("visaoDoResultado: depois do último turno", () => {
  const resultado = {
    id: "res-1",
    statusValidacao: "aguardando_validacao",
    aderenciaGeral: 76,
    agilidade: 88.33,
    niveisPorSkill: {
      delegacao: { nivel: 2, media: 40, nEvidencias: 1 },
      "gestao-os": { nivel: 5, media: 100, nEvidencias: 1 }
    },
    resumo: "Resumo.",
    pontoForte: "Forte.",
    pontoDesenvolvimento: "Desenvolver.",
    sugestoes: ["Uma."]
  };
  const turnos = [2, 1].map((numero) => ({
    numero,
    marco: false,
    texto: `Situação ${numero}`,
    opcoes,
    escolha: "B",
    tempoEsgotado: false,
    aderencia: 70,
    tempoRespostaMs: 7000,
    justificativa: "Porque sim.",
    consequencia: "Efeito."
  }));

  it("mostra aderência por situação, níveis com evidências e o selo de validação", () => {
    const visao = visaoDoResultado({
      sessao: { id: "s1", concluidaEm: new Date("2026-03-02T13:01:00Z") },
      resultado,
      turnos
    });
    expect(visao).toMatchObject({
      resultadoId: "res-1",
      statusValidacao: "aguardando_validacao",
      aderenciaGeral: 76,
      agilidade: 88.33,
      concluidaEm: "2026-03-02T13:01:00.000Z"
    });
    // Situações em ordem, mesmo vindas fora de ordem.
    expect(visao.situacoes.map((s) => s.numero)).toEqual([1, 2]);
    expect(visao.situacoes[0]).toMatchObject({
      aderencia: 70,
      escolha: "B",
      justificativa: "Porque sim."
    });
    // Níveis na ordem das skills do piloto, com nome e quantas escolhas os sustentam.
    expect(visao.niveisPorSkill.map((n) => n.skillId)).toEqual(["gestao-os", "delegacao"]);
    expect(visao.niveisPorSkill[0]).toMatchObject({
      nome: "Gestão de OS e prioridades",
      tipo: "hard",
      nivel: 5,
      nEvidencias: 1
    });
  });

  it("não expõe a resposta completa da IA nem estilo, flexibilidade ou estilo adequado", () => {
    const visao = visaoDoResultado({
      sessao: { id: "s1", concluidaEm: null },
      resultado: {
        ...resultado,
        respostaIa: { segredo: true },
        estiloPredominante: "apoio"
      } as typeof resultado,
      turnos: turnos.map((t) => ({ ...t, estilo: "apoio", estiloAdequado: "direcao" }))
    });
    const texto = JSON.stringify(visao);
    for (const proibido of [
      "respostaIa",
      "estiloPredominante",
      "estiloAdequado",
      "estilo",
      "flexibilidade",
      "segredo"
    ]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it("tempo esgotado aparece como sem escolha e aderência 0", () => {
    const visao = visaoDoResultado({
      sessao: { id: "s1", concluidaEm: null },
      resultado,
      turnos: [
        { ...turnos[1]!, escolha: null, tempoEsgotado: true, aderencia: 0, tempoRespostaMs: null }
      ]
    });
    expect(visao.situacoes[0]).toMatchObject({ escolha: null, tempoEsgotado: true, aderencia: 0 });
  });
});
