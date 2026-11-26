import { describe, expect, it } from "vitest";
import { niveisDeGovernanca } from "./conta.js";
import {
  publicoPelasRegras,
  type RegraDePublico,
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

describe("público pelas regras configuradas", () => {
  const RH = "11111111-1111-4111-8111-111111111111";
  const COMPRAS = "22222222-2222-4222-8222-222222222222";
  const regra = (
    nivelGovernanca: RegraDePublico["nivelGovernanca"],
    areaId: string | null,
    publico: RegraDePublico["publico"],
    ativa = true
  ): RegraDePublico => ({ nivelGovernanca, areaId, publico, ativa });
  const conta = (
    nivelGovernanca: "assistente" | "supervisor" | "coordenador" | "diretoria",
    areaId: string,
    areaSlug: string
  ) => ({
    nivelGovernanca,
    areaId,
    areaSlug
  });

  it("a regra mais específica vence: nível+área, depois só a área, depois só o nível", () => {
    const regras = [
      regra("assistente", null, "administrativo-geral"),
      regra(null, RH, "rh"),
      regra("supervisor", COMPRAS, "supervisor-manutencao-adm")
    ];
    // Assistente de RH: a regra da área (2) vence a do nível (1).
    expect(publicoPelasRegras(regras, conta("assistente", RH, "rh"))).toEqual({
      publico: "rh",
      origem: "regra"
    });
    expect(publicoPelasRegras(regras, conta("assistente", COMPRAS, "compras")).publico).toBe(
      "administrativo-geral"
    );
    expect(publicoPelasRegras(regras, conta("supervisor", COMPRAS, "compras")).publico).toBe(
      "supervisor-manutencao-adm"
    );
  });

  it("nível e área juntos vencem a regra só da área", () => {
    const regras = [
      regra(null, COMPRAS, "administrativo-geral"),
      regra("coordenador", COMPRAS, "coordenador-administrativo")
    ];
    expect(publicoPelasRegras(regras, conta("coordenador", COMPRAS, "compras")).publico).toBe(
      "coordenador-administrativo"
    );
    expect(publicoPelasRegras(regras, conta("supervisor", COMPRAS, "compras")).publico).toBe(
      "administrativo-geral"
    );
  });

  it("regra inativa não vale; sem regra que sirva, vale o padrão do código", () => {
    const regras = [regra("coordenador", COMPRAS, "rh", false)];
    expect(publicoPelasRegras(regras, conta("coordenador", COMPRAS, "compras"))).toEqual({
      publico: "coordenador-administrativo",
      origem: "padrao"
    });
    expect(publicoPelasRegras([], conta("assistente", RH, "rh"))).toEqual({
      publico: "rh",
      origem: "padrao"
    });
  });

  it("empate: a primeira da lista", () => {
    const regras = [
      regra("supervisor", null, "rh"),
      regra("supervisor", null, "administrativo-geral")
    ];
    expect(publicoPelasRegras(regras, conta("supervisor", COMPRAS, "compras")).publico).toBe("rh");
  });
});

describe("corpos da configuração", () => {
  it("regra exige nível, área ou os dois", async () => {
    const { treinoRegrasDePublicoBodySchema: schema } = await import("./treinamentos-api.js");
    const ok = { nivelGovernanca: "supervisor", areaId: null, publico: "rh", ativa: true };
    expect(schema.safeParse({ regras: [ok] }).success).toBe(true);
    expect(schema.safeParse({ regras: [{ ...ok, nivelGovernanca: null }] }).success).toBe(false);
    expect(schema.safeParse({ regras: [{ ...ok, publico: "diretoria" }] }).success).toBe(false);
  });

  it("quantidade de 1 a 10, sem repetir público e turma", async () => {
    const { treinoTesteConfigBodySchema: schema } = await import("./treinamentos-api.js");
    const item = { publico: "rh", turmaId: null, quantidade: 3 };
    expect(schema.safeParse({ itens: [item] }).success).toBe(true);
    expect(schema.safeParse({ itens: [{ ...item, quantidade: 0 }] }).success).toBe(false);
    expect(schema.safeParse({ itens: [{ ...item, quantidade: 11 }] }).success).toBe(false);
    expect(schema.safeParse({ itens: [item, { ...item, quantidade: 4 }] }).success).toBe(false);
  });
});
