import { describe, expect, it } from "vitest";
import { ehAptidao, motivosDaAptidao } from "./aptidao";

describe("aptidão na tela", () => {
  it("só aceita a forma que a API devolve", () => {
    expect(ehAptidao({ status: "RED", reasons: [] })).toBe(true);
    expect(ehAptidao([])).toBe(false);
    expect(ehAptidao({ status: "AZUL", reasons: [] })).toBe(false);
    expect(ehAptidao({ status: "GREEN" })).toBe(false);
    expect(ehAptidao(null)).toBe(false);
  });

  it("lista os motivos graves primeiro e esconde os verdes quando há problema", () => {
    const texto = motivosDaAptidao({
      status: "RED",
      reasons: [
        { code: "A", message: "ASO vence dentro do periodo de alerta.", severity: "YELLOW" },
        { code: "B", message: "NR-10 ausente ou vencido.", severity: "RED" },
        { code: "C", message: "Tudo certo com X.", severity: "GREEN" }
      ]
    });
    expect(texto).toBe("NR-10 ausente ou vencido. · ASO vence dentro do periodo de alerta.");
  });

  it("verde mostra a explicação do servidor; sem motivos, mostra a palavra do estado", () => {
    expect(
      motivosDaAptidao({
        status: "GREEN",
        reasons: [{ code: "OK", message: "Todos os requisitos atendidos.", severity: "GREEN" }]
      })
    ).toBe("Todos os requisitos atendidos.");
    expect(motivosDaAptidao({ status: "YELLOW", reasons: [] })).toBe("Atenção");
  });
});
