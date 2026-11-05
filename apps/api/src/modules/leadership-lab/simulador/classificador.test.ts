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

describe("classificar com a biblioteca real", () => {
  const quem = (texto: string) => {
    const r = classificar(texto, categoriasDaBiblioteca);
    return r.resultado === "encontrado"
      ? r.categoriaId
      : r.resultado === "ambiguo"
        ? r.categoriaIds
        : null;
  };

  it("o exemplo do pedido cai em climatização", () => {
    expect(quem("Estou com problema para realizar a manutenção do ar-condicionado")).toBe(
      "climatizacao-ventilacao"
    );
  });

  it.each([
    ["A autoclave da CME parou e há cirurgias agendadas", "autoclaves-cme"],
    ["Problema na esterilização do instrumental", "autoclaves-cme"],
    ["O alarme do oxigênio da UTI disparou", "gases-medicinais-alarmes"],
    ["Suspeita de vazamento de gás medicinal no bloco", "gases-medicinais-alarmes"],
    ["A bomba de vácuo clínico está sem reserva", "compressores-vacuo"],
    ["O fancoil da sala cirúrgica não gela", "climatizacao-ventilacao"],
    ["O disjuntor do quadro elétrico desarmou", "quadros-eletricos"],
    ["O gerador não assumiu depois da queda de energia", "geradores-transferencia"],
    ["O detector de fumaça do corredor dispara sem motivo", "incendio-alarme"],
    ["A caixa d'água do prédio está quase vazia", "reservatorios-agua"],
    ["O elevador de macas parou", "elevadores"],
    ["A geladeira de vacinas passou do ponto", "refrigeracao-cadeia-frio"],
    ["A osmose reversa da hemodiálise alarmou", "hemodialise-agua"],
    ["A bomba de infusão da UTI está falhando", "equipamentos-medicos"]
  ])("%s -> %s", (texto, esperado) => {
    const r = quem(texto);
    const ids = Array.isArray(r) ? r : r === null ? [] : [r];
    expect(ids).toContain(esperado);
  });

  it("assunto fora da biblioteca não vira tema", () => {
    expect(quem("Preciso trocar a lâmpada do corredor e pintar a recepção")).toBeNull();
    expect(quem("O refeitório está sem café")).toBeNull();
  });
});
