import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

describe("api bootstrap", () => {
  it("exposes versioned health endpoint", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.json()).toEqual({
      service: "my-flux-api",
      status: "ok",
      version: "0.0.0"
    });

    await app.close();
  }, 15000);
});

describe("Leadership Lab no servidor", () => {
  const rota = "/api/v1/leadership-lab/termo";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem LAB_IA_URL o módulo está desligado: as rotas não existem e o resto sobe igual", async () => {
    vi.stubEnv("LAB_IA_URL", "");
    const app = await buildApp();

    expect((await app.inject({ method: "GET", url: rota })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/v1/health" })).statusCode).toBe(200);

    await app.close();
  }, 15000);

  it("com o módulo configurado, as rotas existem e exigem autenticação", async () => {
    vi.stubEnv("LAB_IA_URL", "https://ia.exemplo.test");
    vi.stubEnv("LAB_IA_TOKEN", "segredo-de-teste");
    vi.stubEnv("LAB_TOLERANCIA_TEMPO_S", "3");
    const app = await buildApp();

    const semToken = await app.inject({ method: "GET", url: rota });
    expect(semToken.statusCode).toBe(401);
    expect(semToken.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
    // As respostas do Lab nunca ficam em cache, nem as de erro.
    expect(semToken.headers["cache-control"]).toBe("no-store");

    await app.close();
  }, 15000);

  it("ligado mas sem a tolerância de tempo, o servidor não sobe e diz o que falta", async () => {
    vi.stubEnv("LAB_IA_URL", "https://ia.exemplo.test");
    vi.stubEnv("LAB_IA_TOKEN", "segredo-de-teste");
    vi.stubEnv("LAB_TOLERANCIA_TEMPO_S", "");

    await expect(buildApp()).rejects.toThrow(/LAB_TOLERANCIA_TEMPO_S/);
  }, 15000);
});
