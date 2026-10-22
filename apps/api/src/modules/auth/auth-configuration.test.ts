import { describe, expect, it } from "vitest";
import { assertAuthConfiguration, checkAuthConfiguration } from "./token-service.js";

const strong = "x".repeat(40);
const prod = (extra: Record<string, string | undefined> = {}) =>
  ({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: strong,
    JWT_REFRESH_SECRET: "y".repeat(40),
    ...extra
  }) as NodeJS.ProcessEnv;

describe("segredos de assinatura em produção", () => {
  it("fora de produção não exige nada (desenvolvimento local continua simples)", () => {
    expect(checkAuthConfiguration({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toEqual({
      errors: [],
      warnings: []
    });
    expect(checkAuthConfiguration({ NODE_ENV: "test" } as NodeJS.ProcessEnv).errors).toEqual([]);
  });

  it("recusa subir sem segredos", () => {
    expect(() => assertAuthConfiguration({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
      /JWT_ACCESS_SECRET não está definido/
    );
    expect(() => assertAuthConfiguration(prod({ JWT_REFRESH_SECRET: "" }))).toThrow(
      /JWT_REFRESH_SECRET não está definido/
    );
  });

  it("recusa os valores de exemplo do repositório", () => {
    expect(() =>
      assertAuthConfiguration(prod({ JWT_ACCESS_SECRET: "change-me-access-secret" }))
    ).toThrow(/valor de exemplo/);
    expect(() =>
      assertAuthConfiguration(prod({ JWT_REFRESH_SECRET: "dev-refresh-secret-change-me" }))
    ).toThrow(/valor de exemplo/);
  });

  it("recusa usar o mesmo segredo para acesso e renovação", () => {
    expect(() => assertAuthConfiguration(prod({ JWT_REFRESH_SECRET: strong }))).toThrow(
      /precisam ser diferentes/
    );
  });

  it("aceita segredos próprios; segredo curto vira só um aviso (não derruba um deploy que já funciona)", () => {
    expect(assertAuthConfiguration(prod())).toEqual([]);
    const warnings = assertAuthConfiguration(
      prod({ JWT_ACCESS_SECRET: "segredo-curto-mas-proprio-1" })
    );
    expect(warnings).toEqual([
      "JWT_ACCESS_SECRET tem menos de 32 caracteres; use um segredo mais longo."
    ]);
  });
});
