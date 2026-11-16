import { labConsumoDeIaSchema } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { lerPrecoDaIa, montarConsumo } from "./consumo-ia.js";

const linha = (agente: string, tokensEntrada: number, tokensSaida: number, falhas = 0) => ({
  agente,
  chamadas: 10,
  falhas,
  tokensEntrada,
  tokensSaida,
  latenciaMediaMs: 4321.6
});

describe("consumo de IA", () => {
  it("sem preço configurado não estima custo (o sistema não supõe tabela de preço)", () => {
    expect(lerPrecoDaIa({})).toBeNull();
    expect(lerPrecoDaIa({ LAB_IA_PRECO_ENTRADA_USD_MILHAO: "0,30" })).toBeNull();
    expect(
      lerPrecoDaIa({ LAB_IA_PRECO_ENTRADA_USD_MILHAO: "x", LAB_IA_PRECO_SAIDA_USD_MILHAO: "2" })
    ).toBeNull();
    const consumo = montarConsumo([linha("agente_lab", 1000, 500)], [], null);
    expect(consumo.custoEstimadoUsd).toBeNull();
    expect(consumo.tokensPorTeste).toBeNull();
  });

  it("soma por agente, média por teste concluído e custo com o preço do ambiente", () => {
    const preco = lerPrecoDaIa({
      LAB_IA_PRECO_ENTRADA_USD_MILHAO: "0,50",
      LAB_IA_PRECO_SAIDA_USD_MILHAO: "3"
    });
    expect(preco).toEqual({ entradaPorMilhao: 0.5, saidaPorMilhao: 3 });
    const consumo = montarConsumo(
      [linha("facilitador", 200_000, 100_000), linha("agente_lab", 800_000, 400_000, 2)],
      [
        { tokensEntrada: 30_000, tokensSaida: 10_000 },
        { tokensEntrada: 50_000, tokensSaida: 30_000 }
      ],
      preco
    );
    expect(labConsumoDeIaSchema.parse(consumo)).toEqual(consumo);
    expect(consumo.agentes.map((a) => a.agente)).toEqual(["agente_lab", "facilitador"]);
    expect(consumo.agentes[0]).toMatchObject({ falhas: 2, latenciaMediaMs: 4322 });
    expect(consumo.testesConcluidos).toBe(2);
    expect(consumo.tokensPorTeste).toBe(60_000);
    // total: 1M de entrada x 0,50 + 0,5M de saída x 3 = 2,00; por teste: (0,04 + 0,12) / 2 = 0,08
    expect(consumo.custoEstimadoUsd).toEqual({ total: 2, porTeste: 0.08 });
  });
});
