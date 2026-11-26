// A exportação CSV: o formato que o Excel em português lê e a proteção contra fórmulas.
import { describe, expect, it } from "vitest";
import { celulaDeCsv, paraCsv } from "./acompanhamento.js";

describe("celulaDeCsv", () => {
  it("deixa o texto comum como está e cerca o que tem separador, aspas ou quebra de linha", () => {
    expect(celulaDeCsv("Ana Souza")).toBe("Ana Souza");
    expect(celulaDeCsv("a;b")).toBe('"a;b"');
    expect(celulaDeCsv('ele disse "oi"')).toBe('"ele disse ""oi"""');
    expect(celulaDeCsv("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });

  it("neutraliza o que a planilha leria como fórmula", () => {
    for (const perigoso of ["=1+1", "+SOMA(A1)", "-2+3", "@cmd", "\tcmd"]) {
      expect(celulaDeCsv(perigoso).startsWith("'")).toBe(true);
    }
    expect(celulaDeCsv("-12")).toBe("-12");
  });
});

describe("paraCsv", () => {
  it("usa ';', vírgula decimal, CRLF e BOM", () => {
    const csv = paraCsv([
      ["Nome", "Aderência (%)"],
      ["Ana", "85.5"],
      ["=cmd", "100"]
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe("Nome;Aderência (%)\r\nAna;85,5\r\n'=cmd;100\r\n");
  });
});
