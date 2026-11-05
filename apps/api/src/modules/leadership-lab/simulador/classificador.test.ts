import { describe, expect, it } from "vitest";
import { categoriasDaBiblioteca } from "./catalogo.js";
import { classificar, normalizar, pontuar } from "./classificador.js";
import type { CategoriaDaBiblioteca } from "./tipos.js";

const cat = (id: string, fortes: string[], fracas: string[] = []): CategoriaDaBiblioteca => ({
  id,
  nome: id,
  descricao: id,
  palavrasFortes: fortes,
  palavrasFracas: fracas,
  exemplos: ["a", "b"]
});

describe("normalizar", () => {
  it("tira acento, pontuação e caixa", () => {
    expect(normalizar("  Ar-Condicionado: manutenção!  ")).toBe("ar condicionado manutencao");
    expect(normalizar("ÁGUA   tratada")).toBe("agua tratada");
  });
});

describe("classificar", () => {
  const clima = cat("clima", ["ar condicionado", "climatizacao", "fancoil"], ["temperatura", "ar"]);
  const cme = cat("cme", ["autoclave", "esterilizacao", "cme"]);
  const gases = cat("gases", ["oxigenio", "gas medicinal", "vacuo"], ["alarme"]);
  const todas = [clima, cme, gases];

  it("o exemplo do pedido cai em climatização", () => {
    const r = classificar(
      "Estou com problema para realizar a manutenção do ar-condicionado",
      todas
    );
    expect(r).toEqual({ resultado: "encontrado", categoriaId: "clima" });
  });

  it("reconhece variações e sinônimos", () => {
    expect(classificar("A autoclaves da CME pararam", todas)).toEqual({
      resultado: "encontrado",
      categoriaId: "cme"
    });
    expect(classificar("Falha na ESTERILIZAÇÃO", todas)).toEqual({
      resultado: "encontrado",
      categoriaId: "cme"
    });
    expect(classificar("vazamento de gás medicinal no centro cirúrgico", todas)).toEqual({
      resultado: "encontrado",
      categoriaId: "gases"
    });
    expect(classificar("o fancoil da sala parou", todas)).toEqual({
      resultado: "encontrado",
      categoriaId: "clima"
    });
  });

  it("palavra curta só casa inteira", () => {
    expect(pontuar("o parque está bonito", [clima])[0]?.pontos).toBe(0);
    expect(pontuar("falta ar na sala", [clima])[0]?.pontos).toBe(1);
  });

  it("sem correspondência confiável: nada é inventado", () => {
    expect(classificar("o café acabou e a copa está suja", todas)).toEqual({
      resultado: "sem-correspondencia"
    });
    // só palavra fraca não basta
    expect(classificar("a temperatura está estranha", todas)).toEqual({
      resultado: "sem-correspondencia"
    });
    expect(classificar("", todas)).toEqual({ resultado: "sem-correspondencia" });
  });

  it("empate próximo vira ambiguidade, com as sugestões", () => {
    const r = classificar("autoclave e ar condicionado", todas);
    expect(r.resultado).toBe("ambiguo");
    if (r.resultado === "ambiguo")
      expect(r.categoriaIds).toEqual(expect.arrayContaining(["clima", "cme"]));
  });

  it("é determinístico", () => {
    const t = "ar condicionado e autoclave";
    expect(classificar(t, todas)).toEqual(classificar(t, todas));
  });

  it("o exemplo de cada categoria da biblioteca cai nela mesma", () => {
    for (const c of categoriasDaBiblioteca) {
      for (const exemplo of c.exemplos) {
        const r = classificar(exemplo, categoriasDaBiblioteca);
        const ids =
          r.resultado === "encontrado"
            ? [r.categoriaId]
            : r.resultado === "ambiguo"
              ? r.categoriaIds
              : [];
        expect(ids, `${c.id}: "${exemplo}"`).toContain(c.id);
      }
    }
  });
});
