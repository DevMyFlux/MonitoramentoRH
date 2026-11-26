import { describe, expect, it } from "vitest";
import { niveisDeGovernanca } from "./conta.js";
import {
  moldeDoPublico,
  agilidadeDosCenarios,
  aderenciaDosCenarios,
  labTesteIniciarEntradaSchema,
  labTesteRespostaEntradaSchema,
  moldeDoNivel,
  origemDoPerfil,
  publicoDoCadastro
} from "./leadership-lab-teste.js";
import { treinoPublicos } from "./treinamento-schema.js";

describe("origem do resultado", () => {
  it("só o COMUM é participante; DEV, ADMIN e RH são internos", () => {
    expect(origemDoPerfil("COMUM")).toBe("participante");
    for (const perfil of ["DEV", "ADMIN", "RH"]) expect(origemDoPerfil(perfil)).toBe("interno");
  });
});

describe("público do cadastro (nível + área)", () => {
  it.each([
    ["supervisor", "manutencao", "supervisor-manutencao-adm", "tabela"],
    ["supervisor", "administrativo", "supervisor-manutencao-adm", "tabela"],
    ["coordenador", "administrativo", "coordenador-administrativo", "tabela"],
    ["assistente", "administrativo", "administrativo-geral", "tabela"],
    ["assistente", "compras", "administrativo-geral", "tabela"],
    // RH é RH em qualquer nível.
    ["assistente", "rh", "rh", "tabela"],
    ["supervisor", "rh", "rh", "tabela"],
    ["coordenador", "rh", "rh", "tabela"],
    ["diretoria", "rh", "rh", "tabela"],
    // Fora da tabela: cai pelo nível.
    ["coordenador", "compras", "coordenador-administrativo", "nivel"],
    ["coordenador", "financeiro", "coordenador-administrativo", "nivel"],
    ["supervisor", "compras", "supervisor-manutencao-adm", "nivel"],
    ["diretoria", "manutencao", "coordenador-administrativo", "nivel"],
    ["diretoria", "administrativo", "coordenador-administrativo", "nivel"]
  ] as const)("%s em %s -> %s (%s)", (nivel, area, publico, regra) => {
    expect(publicoDoCadastro({ nivelGovernanca: nivel, areaSlug: area })).toEqual({
      publico,
      regra
    });
  });

  it("toda combinação de nível e área cai num dos 4 públicos conhecidos", () => {
    for (const nivel of niveisDeGovernanca)
      for (const area of [
        "rh",
        "administrativo",
        "compras",
        "manutencao",
        "financeiro",
        "outra-area"
      ])
        expect(treinoPublicos).toContain(
          publicoDoCadastro({ nivelGovernanca: nivel, areaSlug: area }).publico
        );
  });
});

describe("molde do nível", () => {
  it("assistente = encarregado, supervisor = supervisor, coordenador e diretoria = coordenador", () => {
    expect(moldeDoNivel("assistente")).toBe("encarregado");
    expect(moldeDoNivel("supervisor")).toBe("supervisor");
    expect(moldeDoNivel("coordenador")).toBe("coordenador");
    expect(moldeDoNivel("diretoria")).toBe("coordenador");
  });
});

describe("molde do público", () => {
  it("cada público tem um molde, e todos os moldes existem no Lab", () => {
    expect(treinoPublicos.map(moldeDoPublico)).toEqual([
      "supervisor",
      "coordenador",
      "supervisor",
      "encarregado"
    ]);
  });
});

describe("indicadores do teste por cenários", () => {
  it("aderência é a % de decisões cumpridas", () => {
    expect(aderenciaDosCenarios(15, 15)).toBe(100);
    expect(aderenciaDosCenarios(0, 15)).toBe(0);
    expect(aderenciaDosCenarios(10, 15)).toBe(66.67);
    expect(aderenciaDosCenarios(0, 0)).toBe(0);
  });

  it("agilidade: 100 em tempo zero, cai linearmente até a referência e nunca fica negativa", () => {
    expect(agilidadeDosCenarios([0, 0])).toBe(100);
    expect(agilidadeDosCenarios([30_000])).toBe(50);
    expect(agilidadeDosCenarios([60_000])).toBe(0);
    expect(agilidadeDosCenarios([600_000, 0])).toBe(50);
    expect(agilidadeDosCenarios([-5])).toBe(100);
    expect(agilidadeDosCenarios([])).toBe(0);
    expect(agilidadeDosCenarios([10_000], 20)).toBe(50);
  });
});

describe("corpos das requisições", () => {
  it("iniciar aceita só o público (opcional) e recusa campo a mais", () => {
    expect(labTesteIniciarEntradaSchema.safeParse({}).success).toBe(true);
    expect(labTesteIniciarEntradaSchema.safeParse({ publico: "rh" }).success).toBe(true);
    expect(labTesteIniciarEntradaSchema.safeParse({ publico: "diretoria" }).success).toBe(false);
    expect(
      labTesteIniciarEntradaSchema.safeParse({ publico: "rh", origem: "interno" }).success
    ).toBe(false);
  });

  it("a resposta é uma pergunta e uma alternativa de 0 a 3", () => {
    expect(
      labTesteRespostaEntradaSchema.safeParse({ perguntaId: "q1", alternativa: 3 }).success
    ).toBe(true);
    for (const alternativa of [-1, 4, 1.5, "1"])
      expect(
        labTesteRespostaEntradaSchema.safeParse({ perguntaId: "q1", alternativa }).success
      ).toBe(false);
    expect(
      labTesteRespostaEntradaSchema.safeParse({ perguntaId: "q1", alternativa: 0, extra: 1 })
        .success
    ).toBe(false);
  });
});
