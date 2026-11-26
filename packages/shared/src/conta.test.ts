import { describe, expect, it } from "vitest";
import {
  cadastroIncompleto,
  camposFaltando,
  niveisDeGovernanca,
  rotuloDoNivel,
  textoDoQueFalta
} from "./conta.js";

describe("cadastro da conta", () => {
  const completo = {
    cargo: "Supervisor de manutenção",
    nivelGovernanca: "supervisor",
    areaId: "a1"
  };

  it("completo: nada falta", () => {
    expect(camposFaltando(completo)).toEqual([]);
    expect(cadastroIncompleto(completo)).toBe(false);
  });

  it("conta antiga (sem nada) falta os três; cargo em branco ou só espaços conta como faltando", () => {
    expect(camposFaltando({})).toEqual(["cargo", "nivelGovernanca", "areaId"]);
    expect(camposFaltando({ cargo: null, nivelGovernanca: null, areaId: null })).toEqual([
      "cargo",
      "nivelGovernanca",
      "areaId"
    ]);
    expect(camposFaltando({ ...completo, cargo: "   " })).toEqual(["cargo"]);
    expect(camposFaltando({ ...completo, areaId: "" })).toEqual(["areaId"]);
  });

  it("diz em português o que falta", () => {
    expect(textoDoQueFalta({ cargo: "X", areaId: "a" })).toBe("Nível de governança");
    expect(textoDoQueFalta({})).toBe("Cargo, Nível de governança, Área");
    expect(textoDoQueFalta(completo)).toBe("");
  });

  it("todo nível tem rótulo", () => {
    for (const nivel of niveisDeGovernanca) expect(rotuloDoNivel[nivel].length).toBeGreaterThan(0);
  });
});
