// Os tokens do Leadership Lab usam só a paleta do MY FLUX (fases 1 a 5 do redesenho), e o foco e as
// fontes seguem o resto do sistema. Teste em ambiente de arquivos (sem DOM).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tokens do Lab = paleta do MY FLUX", () => {
  const css = readFileSync(new URL("../ui/tokens.css", import.meta.url), "utf8");
  const raiz = readFileSync(new URL("../../../styles.css", import.meta.url), "utf8");

  // Os canais de cada token --mf-* (a paleta travada).
  const paleta = new Set([...raiz.matchAll(/--mf-[a-z0-9-]+:\s*(\d+ \d+ \d+);/g)].map((m) => m[1]));
  // Cores neutras de apoio (tons de cinza-azulado e o branco) e a mistura de esmeralda 800 com tinta.
  const apoio = new Set(["255 255 255", "248 250 252", "241 245 249", "203 213 225", "5 82 63"]);

  it("as cores de marca, texto e semânticas só usam canais da paleta", () => {
    const nomes = [
      "fundo",
      "tinta",
      "tinta-2",
      "tinta-3",
      "linha",
      "destaque",
      "destaque-suave",
      "destaque-texto",
      "sucesso",
      "sucesso-suave",
      "sucesso-texto",
      "aviso",
      "aviso-suave",
      "aviso-texto",
      "perigo",
      "perigo-suave",
      "perigo-texto",
      "info",
      "info-suave",
      "info-texto"
    ];
    for (const nome of nomes) {
      const canal = css.match(new RegExp(`--lab-${nome}:\\s*([^;]+);`))?.[1]?.trim();
      expect(canal, `--lab-${nome}`).toBeTruthy();
      expect(paleta.has(canal!) || apoio.has(canal!), `--lab-${nome}: ${canal}`).toBe(true);
    }
  });

  it("o foco do Lab é o anel azul de 3 px do sistema", () => {
    expect(css).toMatch(/\.lab :focus-visible \{\s*outline: 3px solid rgb\(var\(--mf-azul\)\)/);
  });

  it("títulos em Bricolage Grotesque e códigos em JetBrains Mono", () => {
    expect(css).toContain('"Bricolage Grotesque Variable"');
    expect(css).toContain('"JetBrains Mono Variable"');
  });
});
