import { describe, expect, it } from "vitest";
import { agruparPorDia, diferencas } from "./diferencas";

describe("diferenças da auditoria", () => {
  it("separa o que foi adicionado, removido e alterado, e esconde o que ficou igual", () => {
    const mudancas = diferencas(
      { nome: "Ana", status: "ACTIVE", turno: "DIURNO", obs: "x" },
      { nome: "Ana", status: "VACATION", turno: "DIURNO", equipe: "A" }
    );
    expect(mudancas).toEqual([
      { campo: "status", tipo: "alterado", antes: "ACTIVE", depois: "VACATION" },
      { campo: "obs", tipo: "removido", antes: "x" },
      { campo: "equipe", tipo: "adicionado", depois: "A" }
    ]);
  });

  it("criação (sem antes) lista tudo como adicionado; campos aninhados viram caminhos", () => {
    expect(diferencas(null, { contrato: { inicio: "2026-01-01", horas: 36 } })).toEqual([
      { campo: "contrato.inicio", tipo: "adicionado", depois: "2026-01-01" },
      { campo: "contrato.horas", tipo: "adicionado", depois: "36" }
    ]);
  });

  it("valores que não são objeto comparam como um valor só; listas também", () => {
    expect(diferencas("a", "b")).toEqual([
      { campo: "(valor)", tipo: "alterado", antes: "a", depois: "b" }
    ]);
    expect(diferencas({ dias: ["D", "N"] }, { dias: ["D", "N"] })).toEqual([]);
    expect(diferencas({ dias: ["D"] }, { dias: ["N"] })[0]?.tipo).toBe("alterado");
  });

  it("agrupa por dia no fuso de São Paulo, na ordem recebida", () => {
    const grupos = agruparPorDia([
      { id: 1, createdAt: "2026-11-24T12:00:00Z" },
      { id: 2, createdAt: "2026-11-24T02:30:00Z" }, // 23:30 do dia 23 em São Paulo
      { id: 3, createdAt: "2026-11-23T15:00:00Z" }
    ]);
    expect(grupos.map((g) => [g.dia, g.registros.map((r) => r.id)])).toEqual([
      ["2026-11-24", [1]],
      ["2026-11-23", [2, 3]]
    ]);
  });
});
