import { labLimiteDasListasDoCurador } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { itemDaRevisao, participanteResumido } from "../../test/dados-da-curadoria";
import {
  descricaoDaDistribuicao,
  distribuicaoDaAderencia,
  resultadosPorTeste,
  resumoDosResultados
} from "./visao-geral-dados";

const itens = [
  itemDaRevisao({
    resultadoId: "r1",
    aderenciaGeral: 80,
    agilidade: 90,
    statusValidacao: "validado"
  }),
  itemDaRevisao({ resultadoId: "r2", aderenciaGeral: 60, agilidade: 70 }),
  itemDaRevisao({
    resultadoId: "r3",
    aderenciaGeral: 100,
    agilidade: 50,
    moldeNome: "Coordenador",
    statusValidacao: "ajustado",
    participante: participanteResumido({ id: "p2", nome: "Bruno Lima" })
  })
];

describe("visão geral do RH: números derivados da lista de resultados", () => {
  it("resume: total, participantes distintos, médias e quantos já foram validados", () => {
    expect(resumoDosResultados(itens)).toEqual({
      total: 3,
      parcial: false,
      participantes: 2,
      aderenciaMedia: 80,
      agilidadeMedia: 70,
      validados: 2
    });
  });

  it("sem resultados, as médias ficam nulas (nunca zero)", () => {
    expect(resumoDosResultados([])).toMatchObject({
      total: 0,
      aderenciaMedia: null,
      agilidadeMedia: null
    });
  });

  it("avisa quando a lista veio no limite do servidor", () => {
    const cheia = Array.from({ length: labLimiteDasListasDoCurador }, (_, i) =>
      itemDaRevisao({ resultadoId: `r${i}` })
    );
    expect(resumoDosResultados(cheia).parcial).toBe(true);
  });

  it("distribui em cinco faixas de 20 pontos; 100 cai na última e 0 na primeira", () => {
    const faixas = distribuicaoDaAderencia([
      ...itens,
      itemDaRevisao({ resultadoId: "r4", aderenciaGeral: 0 }),
      itemDaRevisao({ resultadoId: "r5", aderenciaGeral: 79.9 })
    ]);
    expect(faixas).toEqual([
      { faixa: "0–19%", resultados: 1 },
      { faixa: "20–39%", resultados: 0 },
      { faixa: "40–59%", resultados: 0 },
      { faixa: "60–79%", resultados: 2 },
      { faixa: "80–100%", resultados: 2 }
    ]);
    expect(descricaoDaDistribuicao(faixas)).toContain("0–19%: 1 resultado;");
  });

  it("agrupa por teste, do que tem mais resultados para o que tem menos", () => {
    expect(resultadosPorTeste(itens)).toEqual([
      { teste: "Supervisor", resultados: 2, aderenciaMedia: 70, agilidadeMedia: 80 },
      { teste: "Coordenador", resultados: 1, aderenciaMedia: 100, agilidadeMedia: 50 }
    ]);
  });
});
