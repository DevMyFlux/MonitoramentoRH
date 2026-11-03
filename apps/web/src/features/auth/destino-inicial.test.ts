import { describe, expect, it } from "vitest";
import { destinoInicial } from "./destino-inicial";

describe("destinoInicial", () => {
  it("o participante do Leadership Lab (COMUM) vai ao painel dele", () => {
    expect(destinoInicial("COMUM")).toBe("/lab");
  });

  it.each(["DEV", "ADMIN", "RH"] as const)("%s continua indo para Colaboradores", (perfil) => {
    expect(destinoInicial(perfil)).toBe("/colaboradores");
  });

  it("sem saber o perfil, vai para onde sempre foi", () => {
    expect(destinoInicial(undefined)).toBe("/colaboradores");
  });
});
