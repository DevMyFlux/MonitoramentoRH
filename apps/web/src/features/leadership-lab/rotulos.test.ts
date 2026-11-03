import { labMotivosDeIndisponibilidade } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import {
  escolhaDaTecla,
  formatarNumero,
  formatarRelogio,
  motivoDeIndisponibilidade,
  teclaDaOpcao
} from "./rotulos";

describe("formatarRelogio", () => {
  it.each([
    [60_000, "1:00"],
    [59_001, "1:00"], // arredonda para cima: nunca mostra 0:00 com tempo sobrando
    [59_000, "0:59"],
    [125_000, "2:05"],
    [9_000, "0:09"],
    [1, "0:01"],
    [0, "0:00"],
    [-500, "0:00"]
  ])("%i ms -> %s", (ms, texto) => {
    expect(formatarRelogio(ms)).toBe(texto);
  });
});

describe("formatarNumero", () => {
  it("usa vírgula e no máximo uma casa decimal", () => {
    expect(formatarNumero(76)).toBe("76");
    expect(formatarNumero(88.33)).toBe("88,3");
    expect(formatarNumero(0)).toBe("0");
  });
});

describe("teclas das opções", () => {
  it("1, 2 e 3 escolhem A, B e C, e é a mesma tabela nos dois sentidos", () => {
    expect(escolhaDaTecla).toEqual({ "1": "A", "2": "B", "3": "C" });
    for (const [letra, tecla] of Object.entries(teclaDaOpcao)) {
      expect(escolhaDaTecla[tecla]).toBe(letra);
    }
  });
});

describe("motivos de indisponibilidade", () => {
  it("há texto para todos os motivos que a API pode devolver", () => {
    for (const motivo of labMotivosDeIndisponibilidade) {
      const texto = motivoDeIndisponibilidade[motivo];
      expect(texto.titulo, motivo).not.toBe("");
      expect(texto.descricao(2), motivo).not.toBe("");
    }
  });

  it("o limite diário diz quantos testes, no singular e no plural", () => {
    const { descricao } = motivoDeIndisponibilidade["limite-diario"];
    expect(descricao(1)).toBe("Você já fez 1 teste hoje. Volte amanhã.");
    expect(descricao(3)).toBe("Você já fez 3 testes hoje. Volte amanhã.");
    expect(descricao(null)).toBe("Volte amanhã.");
  });
});
