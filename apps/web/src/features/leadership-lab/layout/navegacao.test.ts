import { describe, expect, it } from "vitest";
import { navigationGroups } from "../../navigation/nav-items";
import { chaveDaTransicao, gruposDoMenu, iniciais, itemAtivo } from "./navegacao";

const itens = navigationGroups.flatMap((g) => g.items);

describe("itemAtivo", () => {
  it("escolhe o item de endereço mais específico, não todos os que combinam", () => {
    // /lab/rh/revisao/abc combina com /lab e com /lab/rh; vale o mais específico.
    expect(itemAtivo("/lab/rh/revisao/abc", itens)).toBe("/lab/rh");
    expect(itemAtivo("/lab/config", itens)).toBe("/lab/config");
  });

  it("o painel e as telas do teste ficam no item do Lab", () => {
    expect(itemAtivo("/lab", itens)).toBe("/lab");
    expect(itemAtivo("/lab/teste", itens)).toBe("/lab");
    expect(itemAtivo("/lab/resultado/sessao-1", itens)).toBe("/lab");
  });

  it("fora do Lab e do menu, nenhum item é o ativo", () => {
    expect(itemAtivo("/relatorio-que-nao-existe", itens)).toBeNull();
  });
});

describe("gruposDoMenu", () => {
  it("o Desenvolvimento (onde mora o Lab) vem primeiro", () => {
    const grupos = gruposDoMenu("COMUM", false);
    expect(grupos[0]?.label).toBe("Desenvolvimento");
  });

  it("cada perfil vê só a sua parte do Lab", () => {
    const rotulos = (perfil: Parameters<typeof gruposDoMenu>[0]) =>
      gruposDoMenu(perfil, false)
        .flatMap((g) => g.items)
        .map((i) => i.label);
    expect(rotulos("COMUM")).toContain("Leadership Lab");
    expect(rotulos("COMUM")).not.toContain("Acompanhamento do Lab");
    expect(rotulos("RH")).toContain("Acompanhamento do Lab");
    expect(rotulos("RH")).not.toContain("Configuração do Lab");
    expect(rotulos("ADMIN")).toContain("Configuração do Lab");
  });

  it("no modo de teste, todos veem tudo; os itens ocultos do sistema continuam ocultos", () => {
    const rotulos = gruposDoMenu(undefined, true)
      .flatMap((g) => g.items)
      .map((i) => i.label);
    expect(rotulos).toEqual(
      expect.arrayContaining(["Leadership Lab", "Acompanhamento do Lab", "Configuração do Lab"])
    );
    expect(rotulos).not.toContain("Dashboard");
  });
});

describe("iniciais", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(iniciais("Ana Souza")).toBe("AS");
    expect(iniciais("  maria da silva  ")).toBe("MS");
  });
  it("com um nome só, uma letra; sem nome, vazio", () => {
    expect(iniciais("ana")).toBe("A");
    expect(iniciais("")).toBe("");
  });
});

describe("chaveDaTransicao", () => {
  it("as abas do acompanhamento compartilham a chave: só o conteúdo anima entre elas", () => {
    expect(chaveDaTransicao("/lab/rh/revisao")).toBe(chaveDaTransicao("/lab/rh/alertas"));
  });
  it("as demais páginas trocam a cada endereço", () => {
    expect(chaveDaTransicao("/lab")).not.toBe(chaveDaTransicao("/lab/teste"));
  });
});
