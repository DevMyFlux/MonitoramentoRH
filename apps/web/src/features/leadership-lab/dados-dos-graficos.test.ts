import { describe, expect, it } from "vitest";
import {
  dadosDaEvolucao,
  dadosDoRadar,
  descricaoDaEvolucao,
  descricaoDoRadar,
  quebrarEmLinhas
} from "./dados-dos-graficos";
import { AGORA, painel } from "../../test/dados-do-lab";

describe("quebrarEmLinhas", () => {
  it("quebra só entre palavras, sem passar do máximo", () => {
    expect(quebrarEmLinhas("Delegação e desenvolvimento do time", 16)).toEqual([
      "Delegação e",
      "desenvolvimento",
      "do time"
    ]);
  });

  it("uma palavra maior que o máximo fica inteira na sua linha", () => {
    expect(quebrarEmLinhas("Supercalifragilístico", 5)).toEqual(["Supercalifragilístico"]);
  });

  it("texto curto, vazio e com espaços sobrando", () => {
    expect(quebrarEmLinhas("Delegação", 16)).toEqual(["Delegação"]);
    expect(quebrarEmLinhas("", 16)).toEqual([]);
    expect(quebrarEmLinhas("  a   b  ", 16)).toEqual(["a b"]);
  });

  it("juntar as linhas devolve o texto original", () => {
    const nomes = painel().skills.map((s) => s.nome);
    for (const nome of nomes) expect(quebrarEmLinhas(nome, 16).join(" ")).toBe(nome);
  });
});

describe("radar", () => {
  const skills = painel().skills.map((s, i) =>
    i === 1 ? { ...s, nivel: 4, nivelCalculado: 4, nEvidencias: 2 } : s
  );

  it("uma skill sem evidência fica no centro (0); com evidência, no nível", () => {
    const dados = dadosDoRadar(skills);
    expect(dados).toHaveLength(8);
    expect(dados[0]).toEqual({ skill: skills[0]?.nome, nivel: 0 });
    expect(dados[1]).toEqual({ skill: skills[1]?.nome, nivel: 4 });
  });

  it("a descrição para leitor de tela diz 'sem evidência' e o nível", () => {
    const texto = descricaoDoRadar(skills);
    expect(texto).toContain(`${skills[1]?.nome}: nível 4 de 5`);
    expect(texto).toContain(`${skills[0]?.nome}: sem evidência`);
  });
});

describe("evolução", () => {
  const pontos = [
    {
      resultadoId: "r1",
      sessaoId: "s1",
      concluidaEm: AGORA,
      aderenciaGeral: 76,
      agilidade: 88.33,
      statusValidacao: "aguardando_validacao" as const,
      nSituacoes: 5
    },
    {
      resultadoId: "r2",
      sessaoId: "s2",
      concluidaEm: "2026-03-09T13:00:00.000Z",
      aderenciaGeral: 82,
      agilidade: 70,
      statusValidacao: "validado" as const,
      nSituacoes: 5
    }
  ];

  it("numera os testes na ordem recebida e marca os que aguardam validação", () => {
    const dados = dadosDaEvolucao(pontos);
    expect(dados.map((d) => d.rotulo)).toEqual(["Teste 1", "Teste 2"]);
    expect(dados.map((d) => d.aguardandoValidacao)).toEqual([true, false]);
    expect(dados[0]).toMatchObject({ aderencia: 76, agilidade: 88.33, data: "02/03/2026" });
  });

  it("a descrição para leitor de tela traz data, aderência e agilidade de cada teste", () => {
    expect(descricaoDaEvolucao(pontos)).toBe(
      "Teste 1 (02/03/2026): aderência 76, agilidade 88.33; Teste 2 (09/03/2026): aderência 82, agilidade 70"
    );
  });
});
