import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cores, hexParaCanais } from "./cores";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function token(nome: string): string {
  const achado = css.match(new RegExp(`--lab-${nome}:\\s*([^;]+);`));
  if (!achado?.[1]) throw new Error(`Token --lab-${nome} não existe em tokens.css`);
  return achado[1].trim();
}

describe("cores dos gráficos", () => {
  it("convertem hexadecimal para os canais dos tokens CSS", () => {
    expect(hexParaCanais("#047857")).toBe("4 120 87");
    expect(hexParaCanais("#ffffff")).toBe("255 255 255");
  });

  it("espelham os tokens de tokens.css (mexeu em um, mexa no outro)", () => {
    expect(hexParaCanais(cores.tinta)).toBe(token("tinta"));
    expect(hexParaCanais(cores.tinta2)).toBe(token("tinta-2"));
    expect(hexParaCanais(cores.linha)).toBe(token("linha"));
    expect(hexParaCanais(cores.destaque)).toBe(token("destaque"));
    expect(hexParaCanais(cores.destaqueSuave)).toBe(token("destaque-suave"));
    expect(hexParaCanais(cores.info)).toBe(token("info"));
    expect(hexParaCanais(cores.aviso)).toBe(token("aviso"));
    expect(hexParaCanais(cores.perigo)).toBe(token("perigo"));
  });
});
