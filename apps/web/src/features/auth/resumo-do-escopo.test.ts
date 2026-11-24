import { describe, expect, it } from "vitest";
import { resumoDoEscopo } from "./resumo-do-escopo";

describe("resumo do escopo no cabeçalho", () => {
  it("DEV tem acesso total, com ou sem escopo cadastrado", () => {
    expect(resumoDoEscopo({ role: "DEV", scopes: [] })).toEqual({
      perfil: "Dev",
      alcance: "acesso total"
    });
  });

  it("um escopo global vale sobre os outros", () => {
    const usuario = {
      role: "ADMIN" as const,
      scopes: [{ isGlobal: false, operationId: "o1" }, { isGlobal: true }]
    };
    expect(resumoDoEscopo(usuario).alcance).toBe("global");
  });

  it("conta empresas, unidades e operações distintas, no singular e no plural", () => {
    const usuario = {
      role: "RH" as const,
      scopes: [
        { isGlobal: false, operationId: "o1" },
        { isGlobal: false, operationId: "o2" },
        { isGlobal: false, operationId: "o2" },
        { isGlobal: false, unitId: "u1" }
      ]
    };
    expect(resumoDoEscopo(usuario)).toEqual({ perfil: "RH", alcance: "1 unidade, 2 operações" });
  });

  it("sem escopo diz isso, em vez de ficar em branco", () => {
    expect(resumoDoEscopo({ role: "COMUM", scopes: [] })).toEqual({
      perfil: "Colaborador",
      alcance: "sem escopo"
    });
  });
});
