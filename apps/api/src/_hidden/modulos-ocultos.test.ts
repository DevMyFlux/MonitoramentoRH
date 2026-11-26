// Módulos ocultos na API: QLP e Recrutamento não existem para ninguém (404 igual ao de rota
// inexistente, para os 4 perfis e para quem nem tem sessão); religar o módulo no registro traz as
// rotas de volta. Não usa banco: rota inexistente responde antes de qualquer consulta.
import { MODULOS, modulosOcultos, type ModuloDef } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createAccessToken } from "../modules/auth/token-service.js";
import { modulosDeApiLigados, registrarModulosOcultos } from "./registrar.js";

const PERFIS = ["DEV", "ADMIN", "RH", "COMUM"] as const;
const token = (role: (typeof PERFIS)[number]) =>
  createAccessToken({
    id: `u-${role}`,
    email: `${role}@teste.local`,
    name: role,
    role,
    scopes: []
  } as AuthenticatedUser);

const ROTAS_OCULTAS: ReadonlyArray<[metodo: "GET" | "POST", url: string]> = [
  ["GET", "/api/v1/qlp/versions"],
  ["POST", "/api/v1/qlp/versions"],
  ["GET", "/api/v1/positions"],
  ["POST", "/api/v1/positions"],
  ["POST", "/api/v1/positions/00000000-0000-4000-8000-000000000001/assign"],
  ["GET", "/api/v1/recruitment/requests"],
  ["POST", "/api/v1/recruitment/requests"]
];

/** A resposta sem o trecho que repete o caminho pedido. */
const semCaminho = (corpo: { message?: string }, url: string) => ({
  ...corpo,
  message: corpo.message?.replace(url, "<rota>")
});

describe("módulos ocultos: a lista", () => {
  it("só QLP e Recrutamento são ocultos e são os que moram em _hidden/", () => {
    expect(
      modulosOcultos()
        .map((m) => m.id)
        .sort()
    ).toEqual(["qlp", "recrutamento"]);
    expect(modulosDeApiLigados()).toEqual([]);
  });
});

describe("módulos ocultos: 404 para todos", () => {
  it("rotas do QLP, das posições e do Recrutamento respondem 404, igual a uma rota que nunca existiu", async () => {
    const app = await buildApp();
    try {
      for (const [metodo, url] of ROTAS_OCULTAS) {
        const modelo = await app.inject({ method: metodo, url: `${url}/inexistente-de-verdade` });
        for (const perfil of [...PERFIS, null]) {
          const r = await app.inject({
            method: metodo,
            url,
            ...(perfil ? { headers: { authorization: `Bearer ${token(perfil)}` } } : {}),
            ...(metodo === "POST" ? { payload: {} } : {})
          });
          expect(r.statusCode, `${perfil ?? "sem sessão"} ${metodo} ${url}`).toBe(404);
          expect(semCaminho(r.json(), url), `${perfil ?? "sem sessão"} ${url}`).toEqual(
            semCaminho(modelo.json(), `${url}/inexistente-de-verdade`)
          );
        }
      }
    } finally {
      await app.close();
    }
  }, 30000);

  it("o COMUM recebe 404 (não 403) nas rotas ocultas: o 403 confirmaria que o módulo existe", async () => {
    const app = await buildApp();
    try {
      const r = await app.inject({
        method: "GET",
        url: "/api/v1/qlp/versions",
        headers: { authorization: `Bearer ${token("COMUM")}` }
      });
      expect(r.statusCode).toBe(404);
      expect(JSON.stringify(r.json())).not.toContain("MODULO_FORBIDDEN");
    } finally {
      await app.close();
    }
  }, 15000);
});

describe("módulos ocultos: religar", () => {
  const registro = (...ativos: string[]): Record<string, ModuloDef> =>
    Object.fromEntries(
      Object.entries(MODULOS).map(([id, m]) => [
        id,
        ativos.includes(id) ? { ...m, status: "active" as const } : m
      ])
    );

  async function montar(reg: Record<string, ModuloDef>) {
    const app = Fastify();
    await registrarModulosOcultos(app, {
      users: {} as never,
      prisma: {} as never,
      apiPrefix: "/api/v1",
      registro: reg
    });
    await app.ready();
    return app;
  }

  const status = async (
    app: Awaited<ReturnType<typeof montar>>,
    metodo: "GET" | "POST",
    url: string
  ) =>
    (await app.inject({ method: metodo, url, ...(metodo === "POST" ? { payload: {} } : {}) }))
      .statusCode;

  it("com tudo oculto, nenhuma rota é registrada", async () => {
    const app = await montar(registro());
    try {
      for (const [metodo, url] of ROTAS_OCULTAS) expect(await status(app, metodo, url)).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("religar o QLP traz de volta as rotas dele e das posições (exigem login), sem trazer o Recrutamento", async () => {
    const app = await montar(registro("qlp"));
    try {
      expect(modulosDeApiLigados(registro("qlp"))).toEqual(["qlp"]);
      expect(await status(app, "GET", "/api/v1/qlp/versions")).toBe(401);
      expect(await status(app, "GET", "/api/v1/positions")).toBe(401);
      expect(
        await status(app, "POST", "/api/v1/positions/00000000-0000-4000-8000-000000000001/assign")
      ).toBe(401);
      expect(await status(app, "GET", "/api/v1/recruitment/requests")).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("religar o Recrutamento traz de volta as rotas dele", async () => {
    const app = await montar(registro("recrutamento"));
    try {
      expect(await status(app, "GET", "/api/v1/recruitment/requests")).toBe(401);
      expect(await status(app, "GET", "/api/v1/qlp/versions")).toBe(404);
    } finally {
      await app.close();
    }
  });
});
