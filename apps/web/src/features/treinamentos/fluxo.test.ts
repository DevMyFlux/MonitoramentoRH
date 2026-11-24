import { visaoDoParticipante, treinoCenarioSchema } from "@my-flux/shared";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aplicarCena, cenaDepoisDas, depoisDaReacao, etapaDeRetomada } from "./fluxo";

const cenario = treinoCenarioSchema.parse(
  JSON.parse(
    readFileSync(
      new URL(
        "../../../../../packages/shared/src/treinamentos/exemplos/manutencao-quadro-uti.json",
        import.meta.url
      ),
      "utf8"
    )
  )
);
const visao = visaoDoParticipante(cenario);
const resposta = (perguntaId: string, alternativa: number) => {
  const pergunta = cenario.questions.find((q) => q.id === perguntaId)!;
  return { perguntaId, alternativa, reacao: pergunta.alternatives[alternativa]!.beat };
};

describe("fluxo do Palco", () => {
  it("sem tentativa começa na abertura; com tentativa, na primeira pergunta sem resposta", () => {
    expect(etapaDeRetomada(visao, null)).toEqual({ tipo: "abertura" });
    expect(etapaDeRetomada(visao, { respostas: [] })).toEqual({ tipo: "pergunta", indice: 0 });
    expect(etapaDeRetomada(visao, { respostas: [resposta("q1", 1), resposta("q3", 0)] })).toEqual({
      tipo: "pergunta",
      indice: 1
    });
    const todas = cenario.questions.map((q) => resposta(q.id, 0));
    expect(etapaDeRetomada(visao, { respostas: todas })).toEqual({ tipo: "concluir" });
  });

  it("depois da última reação, concluir", () => {
    expect(depoisDaReacao(visao, 0)).toEqual({ tipo: "pergunta", indice: 1 });
    expect(depoisDaReacao(visao, 4)).toEqual({ tipo: "concluir" });
  });

  it("a cena reaplica as reações na ordem das perguntas, a última palavra vence", () => {
    expect(aplicarCena({ icu: "none", lock: "0" }, { lock: "1" })).toEqual({
      icu: "none",
      lock: "1"
    });
    // q4 (bloqueio) respondida antes de q1 na ordem do servidor: a ordem da cena é a das perguntas.
    const estado = cenaDepoisDas(visao, [resposta("q4", 1), resposta("q1", 0)], { icu: "none" });
    expect(estado).toEqual({ icu: "alert", lock: "1" });
  });
});
