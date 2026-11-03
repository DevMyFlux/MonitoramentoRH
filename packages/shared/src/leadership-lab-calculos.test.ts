import { describe, expect, it } from "vitest";
import { labEstilos, type LabEstilo } from "./leadership-lab.js";
import {
  LabCalculoError,
  agilidadeDoTurno,
  arredondar,
  calcularResultado,
  classificarFlexibilidade,
  deveGerarAlertaAmarelo,
  medirResposta,
  nivelDaMedia,
  podeExibirTendencia,
  type TurnoResolvido
} from "./leadership-lab-calculos.js";

function turno(numero: number, extra: Partial<TurnoResolvido> = {}): TurnoResolvido {
  return {
    numero,
    aderencia: 70,
    tempoEsgotado: false,
    tempoRespostaMs: 10_000,
    estilo: "orientacao",
    estiloAdequado: "orientacao",
    skills: [],
    ...extra
  };
}

function esgotado(numero: number, extra: Partial<TurnoResolvido> = {}): TurnoResolvido {
  return turno(numero, {
    aderencia: 0,
    tempoEsgotado: true,
    tempoRespostaMs: null,
    estilo: null,
    ...extra
  });
}

describe("nivelDaMedia (nível por skill)", () => {
  it.each([
    [100, 5],
    [90, 5],
    [89.99, 4],
    [70, 4],
    [69.99, 3],
    [50, 3],
    [49.99, 2],
    [25, 2],
    [24.99, 1],
    [0, 1]
  ])("média %s -> nível %s", (mediaAderencia, nivel) => {
    expect(nivelDaMedia(mediaAderencia)).toBe(nivel);
  });

  it("nunca diminui quando a média aumenta", () => {
    let anterior = 0;
    for (let m = 0; m <= 100; m += 0.25) {
      const nivel = nivelDaMedia(m);
      expect(nivel).toBeGreaterThanOrEqual(anterior);
      anterior = nivel;
    }
  });

  it.each([-1, 100.01, Number.NaN, Number.POSITIVE_INFINITY])("recusa média %s", (m) => {
    expect(() => nivelDaMedia(m)).toThrow(LabCalculoError);
  });
});

describe("classificarFlexibilidade", () => {
  it.each([
    [100, "alta"],
    [80, "alta"],
    [79.99, "media"],
    [40, "media"],
    [39.99, "baixa"],
    [0, "baixa"]
  ] as const)("%s%% -> %s", (pct, classe) => {
    expect(classificarFlexibilidade(pct)).toBe(classe);
  });

  it("recusa percentual fora de 0 a 100", () => {
    expect(() => classificarFlexibilidade(101)).toThrow(LabCalculoError);
  });
});

describe("medirResposta (tempo medido no servidor)", () => {
  const t0 = new Date("2026-03-02T10:00:00.000Z");
  const apos = (s: number) => new Date(t0.getTime() + s * 1000);
  const medir = (decorridoS: number, tempoLimiteS = 60, toleranciaS = 3) =>
    medirResposta({ apresentadaEm: t0, recebidaEm: apos(decorridoS), tempoLimiteS, toleranciaS });

  it("desconta a tolerância de rede uma vez", () => {
    expect(medir(20)).toEqual({ tempoBrutoMs: 20_000, tempoRespostaMs: 17_000, esgotado: false });
  });

  it("chegar exatamente no limite ainda vale; um milissegundo depois, não", () => {
    expect(medir(63).esgotado).toBe(false); // 63 - 3 = 60
    const tarde = medirResposta({
      apresentadaEm: t0,
      recebidaEm: new Date(apos(63).getTime() + 1),
      tempoLimiteS: 60,
      toleranciaS: 3
    });
    expect(tarde.esgotado).toBe(true);
  });

  it("a tolerância não deixa o tempo negativo", () => {
    expect(medir(1).tempoRespostaMs).toBe(0);
  });

  it("relógio que anda para trás vira 0, sem esgotar", () => {
    expect(medir(-5)).toEqual({ tempoBrutoMs: 0, tempoRespostaMs: 0, esgotado: false });
  });

  it("recusa limite e tolerância inválidos, e datas inválidas", () => {
    expect(() => medir(1, 0)).toThrow(LabCalculoError);
    expect(() => medir(1, 60, -1)).toThrow(LabCalculoError);
    expect(() =>
      medirResposta({
        apresentadaEm: new Date("x"),
        recebidaEm: t0,
        tempoLimiteS: 60,
        toleranciaS: 0
      })
    ).toThrow(LabCalculoError);
  });
});

describe("agilidadeDoTurno", () => {
  const limite = 60;
  it.each([
    [0, 100],
    [15_000, 75],
    [30_000, 50],
    [60_000, 0],
    [90_000, 0]
  ])("%s ms de 60 s -> %s", (ms, esperado) => {
    expect(agilidadeDoTurno({ tempoEsgotado: false, tempoRespostaMs: ms }, limite)).toBe(esperado);
  });

  it("tempo esgotado conta 0", () => {
    expect(agilidadeDoTurno({ tempoEsgotado: true, tempoRespostaMs: null }, limite)).toBe(0);
  });

  it("exige tempo de resposta quando houve resposta", () => {
    expect(() => agilidadeDoTurno({ tempoEsgotado: false, tempoRespostaMs: null }, limite)).toThrow(
      LabCalculoError
    );
    expect(() => agilidadeDoTurno({ tempoEsgotado: false, tempoRespostaMs: -1 }, limite)).toThrow(
      LabCalculoError
    );
  });
});

describe("calcularResultado", () => {
  // Exemplo conferido à mão, limite de 60 s.
  const exemplo: TurnoResolvido[] = [
    turno(1, {
      aderencia: 100,
      tempoRespostaMs: 12_000, // agilidade 80
      estilo: "orientacao",
      estiloAdequado: "orientacao",
      skills: ["gestao-os", "comunicacao-cliente"]
    }),
    turno(2, {
      aderencia: 70,
      tempoRespostaMs: 30_000, // agilidade 50
      estilo: "apoio",
      estiloAdequado: "orientacao",
      skills: ["gestao-os"]
    }),
    turno(3, {
      aderencia: 40,
      tempoRespostaMs: 45_000, // agilidade 25
      estilo: "orientacao",
      estiloAdequado: "orientacao",
      skills: ["comunicacao-cliente", "gestao-equipe"]
    }),
    turno(4, {
      aderencia: 10,
      tempoRespostaMs: 54_000, // agilidade 10
      estilo: null, // não envolveu a equipe
      estiloAdequado: "direcao",
      skills: ["aplicacao-nr-pop"]
    }),
    esgotado(5, { estiloAdequado: "apoio" })
  ];

  it("calcula todos os indicadores do exemplo", () => {
    expect(calcularResultado(exemplo, { tempoLimiteS: 60 })).toEqual({
      aderenciaGeral: 44, // (100 + 70 + 40 + 10 + 0) / 5
      agilidade: 33, // (80 + 50 + 25 + 10 + 0) / 5
      niveisPorSkill: {
        "gestao-os": { nivel: 4, media: 85, nEvidencias: 2 },
        "comunicacao-cliente": { nivel: 4, media: 70, nEvidencias: 2 },
        "gestao-equipe": { nivel: 2, media: 40, nEvidencias: 1 },
        "aplicacao-nr-pop": { nivel: 1, media: 10, nEvidencias: 1 }
      },
      estiloPredominante: "orientacao", // 2 contra 1
      estilosEmpatados: [],
      flexibilidadePct: 66.67, // 2 de 3 escolhas com a equipe
      flexibilidade: "media",
      turnosComAlertaVermelho: [4]
    });
  });

  it("a agilidade aparece separada da aderência: rápido e errado não é bom", () => {
    const rapidoEErrado = [1, 2, 3, 4, 5].map((n) =>
      turno(n, { aderencia: 10, tempoRespostaMs: 0 })
    );
    const resultado = calcularResultado(rapidoEErrado, { tempoLimiteS: 60 });
    expect(resultado.agilidade).toBe(100);
    expect(resultado.aderenciaGeral).toBe(10);
    expect(resultado.turnosComAlertaVermelho).toEqual([1, 2, 3, 4, 5]);
  });

  it("tempo esgotado: aderência 0 e agilidade 0 para a situação", () => {
    const r = calcularResultado([turno(1, { aderencia: 100, tempoRespostaMs: 0 }), esgotado(2)], {
      tempoLimiteS: 60
    });
    expect(r.aderenciaGeral).toBe(50);
    expect(r.agilidade).toBe(50);
  });

  it("uma situação que cita a mesma skill duas vezes conta uma evidência", () => {
    const r = calcularResultado([turno(1, { skills: ["gestao-os", "gestao-os"] })], {
      tempoLimiteS: 60
    });
    expect(r.niveisPorSkill["gestao-os"]).toEqual({ nivel: 4, media: 70, nEvidencias: 1 });
  });

  it("skills de uma situação com tempo esgotado contam com aderência 0", () => {
    const r = calcularResultado(
      [turno(1, { aderencia: 100, skills: ["delegacao"] }), esgotado(2, { skills: ["delegacao"] })],
      { tempoLimiteS: 60 }
    );
    expect(r.niveisPorSkill["delegacao"]).toEqual({ nivel: 3, media: 50, nEvidencias: 2 });
  });

  it("não inventa nível para skill sem evidência", () => {
    const r = calcularResultado([turno(1, { skills: [] })], { tempoLimiteS: 60 });
    expect(r.niveisPorSkill).toEqual({});
  });

  describe("estilo predominante e flexibilidade", () => {
    const comEstilos = (estilos: Array<LabEstilo | null>, adequado: LabEstilo = "orientacao") =>
      calcularResultado(
        estilos.map((estilo, i) => turno(i + 1, { estilo, estiloAdequado: adequado })),
        { tempoLimiteS: 60 }
      );

    it("o mais frequente vence", () => {
      expect(comEstilos(["apoio", "apoio", "direcao", null, null])).toMatchObject({
        estiloPredominante: "apoio",
        estilosEmpatados: []
      });
    });

    it("empate: não escolhe um, devolve os empatados na ordem canônica", () => {
      const r = comEstilos(["apoio", "orientacao", "apoio", "orientacao", null]);
      expect(r.estiloPredominante).toBeNull();
      expect(r.estilosEmpatados).toEqual(["orientacao", "apoio"]);
    });

    it("sem escolha que envolva a equipe: sem estilo e sem flexibilidade", () => {
      expect(comEstilos([null, null, null])).toMatchObject({
        estiloPredominante: null,
        estilosEmpatados: [],
        flexibilidadePct: null,
        flexibilidade: null
      });
    });

    it("omissão não é decisão: ignora o estilo de situação com tempo esgotado", () => {
      const r = calcularResultado(
        [
          turno(1, { estilo: "apoio", estiloAdequado: "apoio" }),
          esgotado(2, { estilo: "direcao" })
        ],
        { tempoLimiteS: 60 }
      );
      expect(r.estiloPredominante).toBe("apoio");
      expect(r.flexibilidadePct).toBe(100);
    });

    it.each([
      // adequadas / total -> %, classe
      [5, 5, 100, "alta"],
      [4, 5, 80, "alta"],
      [3, 5, 60, "media"],
      [2, 5, 40, "media"],
      [1, 5, 20, "baixa"],
      [0, 5, 0, "baixa"]
    ] as const)("%s de %s adequadas = %s%% (%s)", (adequadas, total, pct, classe) => {
      const turnos = Array.from({ length: total }, (_, i) =>
        turno(i + 1, {
          estilo: i < adequadas ? "apoio" : "direcao",
          estiloAdequado: "apoio"
        })
      );
      expect(calcularResultado(turnos, { tempoLimiteS: 60 })).toMatchObject({
        flexibilidadePct: pct,
        flexibilidade: classe
      });
    });
  });

  describe("entrada inválida", () => {
    const calcular = (turnos: TurnoResolvido[], tempoLimiteS = 60) =>
      calcularResultado(turnos, { tempoLimiteS });

    it("recusa teste vazio e tempo limite inválido", () => {
      expect(() => calcular([])).toThrow(LabCalculoError);
      expect(() => calcular([turno(1)], 0)).toThrow(LabCalculoError);
    });

    it("recusa número de situação repetido ou inválido", () => {
      expect(() => calcular([turno(1), turno(1)])).toThrow(/repetido/);
      expect(() => calcular([turno(0)])).toThrow(LabCalculoError);
      expect(() => calcular([turno(1.5)])).toThrow(LabCalculoError);
    });

    it("recusa aderência fora da escala", () => {
      expect(() => calcular([turno(1, { aderencia: 55 })])).toThrow(/fora da escala/);
    });

    it("aderência 0 só existe com tempo esgotado, e tempo esgotado exige aderência 0", () => {
      expect(() => calcular([turno(1, { aderencia: 0 })])).toThrow(/só existe para tempo esgotado/);
      expect(() => calcular([turno(1, { tempoEsgotado: true, tempoRespostaMs: null })])).toThrow(
        /exige aderência 0/
      );
      expect(() => calcular([esgotado(1, { tempoRespostaMs: 5 })])).toThrow(/exige aderência 0/);
    });

    it("recusa estilo e skill inválidos", () => {
      expect(() => calcular([turno(1, { estilo: "x" as unknown as LabEstilo })])).toThrow(
        /estilo desconhecido/
      );
      expect(() => calcular([turno(1, { estiloAdequado: "x" as unknown as LabEstilo })])).toThrow(
        /estilo adequado/
      );
      expect(() => calcular([turno(1, { skills: [" "] })])).toThrow(/skill/);
    });

    it("situação respondida sem tempo de resposta", () => {
      expect(() => calcular([turno(1, { tempoRespostaMs: null })])).toThrow(LabCalculoError);
    });
  });
});

// ---------------------------------------------------------------------------
// Propriedades sobre entradas aleatórias, com semente fixa (repetíveis)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const skillsPossiveis = ["a", "b", "c", "d", "e", "f"];

function testeAleatorio(rnd: () => number, limiteS: number): TurnoResolvido[] {
  const escolher = <T>(itens: readonly T[]): T => itens[Math.floor(rnd() * itens.length)] as T;
  return Array.from({ length: 5 }, (_, i) => {
    const sem = rnd() < 0.15;
    const quantas = Math.floor(rnd() * 4);
    return {
      numero: i + 1,
      aderencia: sem ? 0 : escolher([100, 70, 40, 10]),
      tempoEsgotado: sem,
      tempoRespostaMs: sem ? null : Math.floor(rnd() * limiteS * 1000),
      estilo: rnd() < 0.3 ? null : escolher(labEstilos),
      estiloAdequado: escolher(labEstilos),
      skills: Array.from({ length: quantas }, () => escolher(skillsPossiveis))
    };
  });
}

/** Oráculo independente da implementação: tabela de níveis escrita por extenso. */
function nivelEsperado(m: number): number {
  if (m >= 90) return 5;
  if (m >= 70) return 4;
  if (m >= 50) return 3;
  if (m >= 25) return 2;
  return 1;
}

describe("calcularResultado: propriedades em 500 testes aleatórios", () => {
  const rnd = mulberry32(20260302);
  const casos = Array.from({ length: 500 }, () => {
    const limiteS = 30 + Math.floor(rnd() * 120);
    return { limiteS, turnos: testeAleatorio(rnd, limiteS) };
  });

  it("indicadores ficam em 0 a 100 e a aderência geral é a média simples", () => {
    for (const { limiteS, turnos } of casos) {
      const r = calcularResultado(turnos, { tempoLimiteS: limiteS });
      const mediaSimples = turnos.reduce((s, t) => s + t.aderencia, 0) / turnos.length;
      expect(r.aderenciaGeral).toBe(arredondar(mediaSimples));
      expect(r.aderenciaGeral).toBeGreaterThanOrEqual(0);
      expect(r.aderenciaGeral).toBeLessThanOrEqual(100);
      expect(r.agilidade).toBeGreaterThanOrEqual(0);
      expect(r.agilidade).toBeLessThanOrEqual(100);
    }
  });

  it("o nível de cada skill segue a média das escolhas que a citam", () => {
    for (const { limiteS, turnos } of casos) {
      const r = calcularResultado(turnos, { tempoLimiteS: limiteS });
      const citadas = new Set(turnos.flatMap((t) => t.skills));
      expect(new Set(Object.keys(r.niveisPorSkill))).toEqual(citadas);
      for (const skill of citadas) {
        const aderencias = turnos.filter((t) => t.skills.includes(skill)).map((t) => t.aderencia);
        const m = aderencias.reduce((s, a) => s + a, 0) / aderencias.length;
        expect(r.niveisPorSkill[skill]).toEqual({
          nivel: nivelEsperado(m),
          media: arredondar(m),
          nEvidencias: aderencias.length
        });
      }
    }
  });

  it("a ordem das situações não muda o resultado", () => {
    for (const { limiteS, turnos } of casos.slice(0, 100)) {
      const embaralhado = [...turnos].reverse();
      expect(calcularResultado(embaralhado, { tempoLimiteS: limiteS })).toEqual(
        calcularResultado(turnos, { tempoLimiteS: limiteS })
      );
    }
  });

  it("melhorar a aderência de uma escolha nunca piora a geral nem o nível de skill", () => {
    const escala = [10, 40, 70, 100];
    for (const { limiteS, turnos } of casos.slice(0, 150)) {
      const indice = turnos.findIndex((t) => !t.tempoEsgotado);
      if (indice < 0) continue;
      const atual = turnos[indice]!;
      const melhor = escala[Math.min(escala.indexOf(atual.aderencia) + 1, escala.length - 1)]!;
      const alterado = turnos.map((t, i) => (i === indice ? { ...t, aderencia: melhor } : t));
      const antes = calcularResultado(turnos, { tempoLimiteS: limiteS });
      const depois = calcularResultado(alterado, { tempoLimiteS: limiteS });
      expect(depois.aderenciaGeral).toBeGreaterThanOrEqual(antes.aderenciaGeral);
      for (const [skill, nivel] of Object.entries(antes.niveisPorSkill)) {
        expect(depois.niveisPorSkill[skill]!.nivel).toBeGreaterThanOrEqual(nivel.nivel);
      }
    }
  });

  it("o estilo predominante é um dos mais frequentes e o empate nunca é resolvido em silêncio", () => {
    for (const { limiteS, turnos } of casos) {
      const r = calcularResultado(turnos, { tempoLimiteS: limiteS });
      const contagem = new Map<string, number>();
      for (const t of turnos) {
        if (!t.tempoEsgotado && t.estilo) contagem.set(t.estilo, (contagem.get(t.estilo) ?? 0) + 1);
      }
      if (contagem.size === 0) {
        expect(r.estiloPredominante).toBeNull();
        expect(r.flexibilidade).toBeNull();
        continue;
      }
      const maior = Math.max(...contagem.values());
      const lideres = [...contagem].filter(([, n]) => n === maior).map(([e]) => e);
      if (lideres.length === 1) {
        expect(r.estiloPredominante).toBe(lideres[0]);
        expect(r.estilosEmpatados).toEqual([]);
      } else {
        expect(r.estiloPredominante).toBeNull();
        expect([...r.estilosEmpatados].sort()).toEqual([...lideres].sort());
      }
    }
  });
});

describe("deveGerarAlertaAmarelo", () => {
  it.each([
    [[40, 45], true],
    [[49.99, 0], true],
    [[40, 50], false], // 50 não é "abaixo de 50"
    [[60, 40], false],
    [[40, 60], false],
    [[30], false],
    [[], false],
    [[45, 20, 80, 30, 49], true], // só as duas últimas contam
    [[10, 10, 90, 10], false]
  ] as const)("%j -> %s", (medias, esperado) => {
    expect(deveGerarAlertaAmarelo(medias)).toBe(esperado);
  });

  it("'média abaixo de 50' é o mesmo que nível 1 ou 2 (perfil_skill.nivel <= 2)", () => {
    for (let m = 0; m <= 100; m += 0.25) {
      expect(m < 50).toBe(nivelDaMedia(m) <= 2);
    }
  });

  it("recusa média inválida nas duas últimas posições", () => {
    expect(() => deveGerarAlertaAmarelo([40, 120])).toThrow(LabCalculoError);
  });
});

describe("podeExibirTendencia", () => {
  it.each([
    [0, false],
    [2, false],
    [3, true],
    [10, true],
    [-1, false],
    [2.5, false]
  ])("%s testes -> %s", (n, esperado) => {
    expect(podeExibirTendencia(n)).toBe(esperado);
  });
});
