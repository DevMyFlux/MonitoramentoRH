import { describe, expect, it } from "vitest";
import { chaveDaTransicao, iniciais } from "./navegacao";

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
