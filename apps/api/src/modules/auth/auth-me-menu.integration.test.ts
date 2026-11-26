// GET /auth/me devolve o menu da conta: é dele que a web monta a navegação. Exige
// LAB_TEST_DATABASE_URL (banco descartável); sem ela, é ignorado.
import type { FastifyInstance } from "fastify";
import { menuDoPerfil, perfisDeAcesso } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../leadership-lab/db/test-database.js";
import { criarUsuario, inserir } from "../leadership-lab/db/test-fixtures.js";
import { type Banco, encerrarBanco, prepararBanco } from "../leadership-lab/motor/cenario-de-teste.js";
import { createAccessToken } from "./token-service.js";

describe.skipIf(!integrationEnabled)("GET /auth/me", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let desligar: () => Promise<void>;

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../app.js");
    const { prisma } = await import("../../lib/prisma.js");
    desligar = () => prisma.$disconnect();
    app = await buildApp();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await desligar?.();
    if (banco) await encerrarBanco(banco);
  });

  it.each(perfisDeAcesso)("%s recebe o próprio menu, na ordem fixa", async (perfil) => {
    const roleId =
      perfil === "COMUM"
        ? banco.base.roleId
        : await inserir(banco.db.client, '"Role"', {
            id: crypto.randomUUID(),
            name: perfil,
            level: 2,
            description: perfil,
            updatedAt: new Date().toISOString()
          });
    const id = await criarUsuario(banco.db.client, banco.base, { roleId });
    const token = createAccessToken({
      id,
      email: "x@teste.local",
      name: "Pessoa",
      role: perfil,
      scopes: []
    });
    const r = await app.inject({
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data.user.menu).toEqual(menuDoPerfil(perfil));
  });
});
