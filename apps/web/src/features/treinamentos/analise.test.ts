import { evaluate, treinoCenarioSchema } from "@my-flux/shared";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  arestasAtivas,
  cadeiaDeCausas,
  estadoDosNos,
  explicacaoDe,
  idDoNo,
  montarGrafo,
  resultadosQueMudaram
} from "./analise";

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
const resultado = {
  decisoes: cenario.decisions.map((d) => ({
    id: d.id,
    label: d.label,
    procedure: d.procedure,
    cumpriu: true
  })),
  regras: {
    events: cenario.events.map((e) => ({
      id: e.id,
      label: e.label,
      tone: e.tone,
      when: e.when,
      scene: e.scene
    })),
    outcomes: cenario.outcomes.map((o) => ({
      id: o.id,
      label: o.label,
      levels: o.levels,
      when: o.when
    }))
  }
};
const decisoes = (exceto: string[] = []) =>
  Object.fromEntries(cenario.decisions.map((d) => [d.id, !exceto.includes(d.id)]));
const grafo = montarGrafo(resultado);
const rotulos = Object.fromEntries(grafo.nos.map((n) => [n.id, n.rotulo]));

describe("análise de causa e consequência", () => {
  it("monta as três colunas e liga cada regra à sua origem, sem arestas repetidas", () => {
    expect(grafo.nos.filter((n) => n.tipo === "decisao")).toHaveLength(5);
    expect(grafo.nos.filter((n) => n.tipo === "acontecimento")).toHaveLength(cenario.events.length);
    expect(grafo.nos.filter((n) => n.tipo === "resultado")).toHaveLength(3);
    const chaves = grafo.arestas.map((a) => a.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves).toContain("decisao:medir->acontecimento:arco");
    expect(chaves).toContain("acontecimento:arco->acontecimento:lesao");
    expect(chaves).toContain("acontecimento:lesao->resultado:tecnico");
    // Todo nó de origem existe.
    const ids = new Set(grafo.nos.map((n) => n.id));
    for (const a of grafo.arestas) expect(ids.has(a.de) && ids.has(a.para), a.chave).toBe(true);
  });

  it("a cadeia de uma lesão volta até as decisões que a causaram", () => {
    const desfecho = evaluate(cenario, decisoes(["medir", "epi"]));
    const { nos, arestas } = cadeiaDeCausas(desfecho, idDoNo("resultado", "tecnico"));
    for (const no of [
      "resultado:tecnico",
      "acontecimento:arco",
      "acontecimento:lesao",
      "decisao:medir",
      "decisao:epi"
    ])
      expect(nos.has(no), no).toBe(true);
    expect(nos.has("decisao:avisar_uti")).toBe(false);
    expect(arestas.has("decisao:medir->acontecimento:arco")).toBe(true);
  });

  it("explica em português e aponta o que mudou num 'e se?'", () => {
    const original = evaluate(cenario, decisoes(["medir"]));
    expect(explicacaoDe(original, idDoNo("acontecimento", "arco"), rotulos)).toEqual([
      "“Medir a ausência de tensão” não foi cumprida"
    ]);
    const simulado = evaluate(cenario, decisoes());
    expect([...resultadosQueMudaram(original, simulado)].sort()).toEqual([
      "conformidade",
      "tecnico",
      "uti"
    ]);
    expect(resultadosQueMudaram(original, original).size).toBe(0);
    // Condição que falhou: o texto diz o que de fato aconteceu, não o que a regra exigia.
    expect(explicacaoDe(original, idDoNo("resultado", "tecnico"), rotulos)).toEqual([
      "“Arco elétrico no quadro” aconteceu",
      "“Lesão por arco” não aconteceu"
    ]);
  });

  it("o estado dos nós e as arestas ativas seguem o desfecho", () => {
    const desfecho = evaluate(cenario, decisoes(["bloqueio"]));
    const estado = estadoDosNos(decisoes(["bloqueio"]), desfecho);
    expect(estado["decisao:bloqueio"]).toEqual({ tipo: "decisao", cumpriu: false });
    expect(estado["acontecimento:arco"]).toMatchObject({ aconteceu: true, tom: "bad" });
    expect(estado["resultado:tecnico"]).toMatchObject({ nivel: "warn" });
    const ativas = arestasAtivas(desfecho);
    expect(ativas.has("decisao:bloqueio->acontecimento:arco")).toBe(true);
    expect(ativas.has("decisao:medir->acontecimento:arco")).toBe(false);
  });
});
