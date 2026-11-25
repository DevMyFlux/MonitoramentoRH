import type { AuthenticatedUser } from "@my-flux/types";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { createAccessToken } from "../auth/token-service.js";
import { registrarTravaDoComum } from "./comum-guard.js";

type Papel = AuthenticatedUser["role"];
const usuario = (id: string, role: Papel): AuthenticatedUser => ({
  id,
  email: `${id}@teste.local`,
  name: id,
  role,
  scopes: []
});
const token = (id: string, role: Papel) => createAccessToken(usuario(id, role));

/** O que o "banco" diz de cada pessoa (pode divergir do que o token afirma). */
const banco = new Map<string, Papel>();
const repositorioFalso = {
  findById: async (id: string) => {
    const role = banco.get(id);
    return role ? ({ ...usuario(id, role) } as never) : null;
  }
};

const ROTAS = [
  "/api/v1/auth/me",
  "/api/v1/suporte/conversa",
  "/api/v1/leadership-lab/painel",
  "/api/v1/treinamentos/minhas",
  "/api/v1/employees",
  "/api/v1/employees/export",
  "/api/v1/operations",
  "/api/v1/functions",
  "/api/v1/parameters",
  "/api/v1/users",
  "/api/v1/qlp/versions"
];

async function montar(): Promise<FastifyInstance> {
  const app = Fastify();
  app.setErrorHandler((erro, _req, resposta) => {
    if (erro instanceof HttpError)
      return resposta.status(erro.statusCode).send({ code: erro.code, message: erro.message });
    return resposta.status(500).send({ code: "ERRO" });
  });
  registrarTravaDoComum(app, repositorioFalso, "/api/v1");
  for (const rota of ROTAS) app.get(rota, async () => ({ data: "rodou" }));
  app.get("/fora-da-api", async () => ({ data: "rodou" }));
  await app.ready();
  return app;
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  banco.clear();
});

const pedir = (a: FastifyInstance, url: string, bearer?: string) =>
  a.inject({
    method: "GET",
    url,
    ...(bearer ? { headers: { authorization: `Bearer ${bearer}` } } : {})
  });

describe("trava do COMUM fora do Lab", () => {
  it("o COMUM alcança o global e o Lab, e é barrado (403) em todo o resto", async () => {
    app = await montar();
    banco.set("ana", "COMUM");
    const t = token("ana", "COMUM");
    const liberadas = [
      "/api/v1/auth/me",
      "/api/v1/suporte/conversa",
      "/api/v1/leadership-lab/painel",
      "/api/v1/treinamentos/minhas"
    ];
    for (const rota of ROTAS) {
      const r = await pedir(app, rota, t);
      if (liberadas.includes(rota)) expect(r.statusCode, rota).toBe(200);
      else {
        expect(r.statusCode, rota).toBe(403);
        expect(r.json().code).toBe("MODULO_FORBIDDEN");
      }
    }
  });

  it("DEV, ADMIN e RH passam em tudo", async () => {
    app = await montar();
    for (const role of ["DEV", "ADMIN", "RH"] as const) {
      banco.set(role, role);
      for (const rota of ROTAS)
        expect((await pedir(app, rota, token(role, role))).statusCode, `${role} ${rota}`).toBe(200);
    }
  });

  it("quem foi promovido não fica barrado: o token ainda diz COMUM, mas o banco diz RH", async () => {
    app = await montar();
    banco.set("beto", "RH");
    expect((await pedir(app, "/api/v1/employees", token("beto", "COMUM"))).statusCode).toBe(200);
  });

  it("sem token, com token inválido ou fora da API, a trava não responde (a rota decide)", async () => {
    app = await montar();
    expect((await pedir(app, "/api/v1/employees")).statusCode).toBe(200); // a rota real devolveria 401
    expect((await pedir(app, "/api/v1/employees", "token-falso")).statusCode).toBe(200);
    banco.set("ana", "COMUM");
    expect((await pedir(app, "/fora-da-api", token("ana", "COMUM"))).statusCode).toBe(200);
  });

  it("consulta na URL não engana o prefixo", async () => {
    app = await montar();
    banco.set("ana", "COMUM");
    const t = token("ana", "COMUM");
    expect((await pedir(app, "/api/v1/employees?x=/leadership-lab", t)).statusCode).toBe(403);
    expect((await pedir(app, "/api/v1/leadership-lab/painel?x=1", t)).statusCode).toBe(200);
  });
});
