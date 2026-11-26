// O prazo de expiração do teste interno parado: 24 horas, configurável por ambiente.
import { describe, expect, it } from "vitest";
import { lerConfigDoLab } from "./config.js";

const ler = (extra: Record<string, string> = {}) =>
  lerConfigDoLab({ LAB_TOLERANCIA_TEMPO_S: "0", ...extra });

describe("LAB_TESTE_INTERNO_EXPIRA_H", () => {
  it("sem a variável, são 24 horas", () => {
    expect(ler().expiraTesteInternoH).toBe(24);
  });

  it("aceita outro prazo", () => {
    expect(ler({ LAB_TESTE_INTERNO_EXPIRA_H: "48" }).expiraTesteInternoH).toBe(48);
  });

  it.each(["0", "-1", "um dia", "1.5"])("recusa %s na subida", (valor) => {
    expect(() => ler({ LAB_TESTE_INTERNO_EXPIRA_H: valor })).toThrow(/LAB_TESTE_INTERNO_EXPIRA_H/);
  });
});
