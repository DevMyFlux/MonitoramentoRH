import { describe, expect, it } from "vitest";
import { resultado } from "../../test/dados-do-lab";
import { descreverCaminho, montarMapaDeDecisoes, resumir } from "./mapa-de-decisoes-dados";

const situacoes = resultado().situacoes;

describe("mapa de decisões", () => {
  it("cria 1 nó de situação e 3 de opção por situação, com a escolhida em destaque", () => {
    const { nodes } = montarMapaDeDecisoes(situacoes);
    expect(nodes.filter((n) => n.type === "situacao")).toHaveLength(5);
    expect(nodes.filter((n) => n.type === "opcao")).toHaveLength(15);
    const escolhidas = nodes.filter((n) => n.type === "opcao" && n.data.escolhida);
    expect(escolhidas.map((n) => n.id)).toEqual(["s1-A", "s2-A", "s3-A", "s4-A", "s5-A"]);
  });

  it("o caminho liga a escolha de cada situação à situação seguinte (e só a ela)", () => {
    const { edges } = montarMapaDeDecisoes(situacoes);
    const caminho = edges.filter((e) => e.target.startsWith("s") && !e.target.includes("-"));
    expect(caminho.map((e) => `${e.source}>${e.target}`)).toEqual([
      "s1-A>s2",
      "s2-A>s3",
      "s3-A>s4",
      "s4-A>s5"
    ]);
  });

  it("segue a escolha real, não sempre a mesma letra", () => {
    const outras = situacoes.map((s) => ({ ...s, escolha: "C" as const }));
    const { edges } = montarMapaDeDecisoes(outras);
    expect(edges.some((e) => e.source === "s1-C" && e.target === "s2")).toBe(true);
  });

  it("tempo esgotado vira um nó de omissão no caminho", () => {
    const s = situacoes.map((x) =>
      x.numero === 2 ? { ...x, escolha: null, tempoEsgotado: true } : x
    );
    const { nodes, edges } = montarMapaDeDecisoes(s);
    expect(nodes.some((n) => n.id === "s2-omissao")).toBe(true);
    expect(
      nodes.filter((n) => n.type === "opcao" && n.data.escolhida && n.id.startsWith("s2-"))
    ).toHaveLength(0);
    expect(edges.some((e) => e.source === "s2-omissao" && e.target === "s3")).toBe(true);
  });

  it("só a opção escolhida mostra a consequência", () => {
    const { nodes } = montarMapaDeDecisoes(situacoes);
    const com = nodes.filter((n) => n.type === "opcao" && n.data.consequencia);
    expect(com).toHaveLength(5);
  });

  it("nós não se sobrepõem na vertical dentro da coluna", () => {
    const { nodes } = montarMapaDeDecisoes(situacoes);
    const col = nodes.filter((n) => n.position.x === 0).sort((a, b) => a.position.y - b.position.y);
    for (let i = 1; i < col.length; i += 1) {
      const antes = col[i - 1];
      const agora = col[i];
      expect(agora!.position.y).toBeGreaterThanOrEqual(
        antes!.position.y + (antes!.initialHeight ?? 0)
      );
    }
  });

  it("resume o texto sem o prefixo e descreve o caminho em texto", () => {
    expect(resumir("(Simulação local) Uma frase curta.")).toBe("Uma frase curta.");
    expect(resumir(`${"palavra ".repeat(30)}`).endsWith("…")).toBe(true);
    expect(descreverCaminho(situacoes)).toHaveLength(5);
    expect(descreverCaminho(situacoes)[0]).toMatch(/^Situação 1: escolheu a opção A/);
  });
});
