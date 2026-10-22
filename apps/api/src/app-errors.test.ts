import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { HttpError } from "./lib/http-error.js";

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function appWithRoutes() {
  const instance = await buildApp();
  instance.get("/__t/http-error", async () => {
    throw new HttpError(409, "NO_EMPLOYEES", "Nenhum colaborador ativo nesta unidade.", {
      operationId: "op-1"
    });
  });
  instance.get("/__t/boom", async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432 — senha=segredo123");
  });
  app = instance;
  return instance;
}

describe("respostas de erro da API", () => {
  it("sem login: mantém o código técnico e devolve mensagem clara com a ação recomendada", async () => {
    const a = await buildApp();
    app = a;
    const res = await a.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe("AUTHENTICATION_REQUIRED");
    expect(body.message).toBe("É necessário entrar no sistema para continuar.");
    expect(body.details.action).toBe("Faça login novamente.");
  }, 15000);

  it("validação: explica quais campos estão errados, em português", async () => {
    const a = await buildApp();
    app = a;
    const res = await a.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "isso-nao-e-email" }
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toContain("Alguns dados enviados estão incompletos ou inválidos.");
    expect(body.message).toContain("E-mail: e-mail inválido");
    expect(body.message).not.toMatch(/Invalid|Too small|expected/i);
    expect(body.details.fields.length).toBeGreaterThan(0);
  }, 15000);

  it("HttpError conhecido: frase amigável, código e details originais preservados", async () => {
    const a = await appWithRoutes();
    const res = await a.inject({ method: "GET", url: "/__t/http-error" });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe("NO_EMPLOYEES");
    expect(body.message).toBe("Não há colaboradores ativos nesta unidade para montar a escala.");
    expect(body.details.operationId).toBe("op-1");
    expect(body.details.technicalMessage).toBe("Nenhum colaborador ativo nesta unidade.");
  }, 15000);

  it("erro inesperado: nada interno vaza (nem mensagem, nem stack, nem dado sensível), só a referência", async () => {
    const a = await appWithRoutes();
    const res = await a.inject({ method: "GET", url: "/__t/boom" });
    expect(res.statusCode).toBe(500);
    const raw = res.body;
    expect(raw).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|segredo123|stack|at .*\.ts/i);
    const body = res.json();
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.message).toBe("Ocorreu um erro inesperado.");
    expect(typeof body.details.reference).toBe("string");
  }, 15000);

  it("rota inexistente da API responde no formato padrão e em português", async () => {
    const a = await buildApp();
    app = a;
    const res = await a.inject({ method: "GET", url: "/api/v1/nao-existe" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("O registro não foi encontrado.");
  }, 15000);
});
