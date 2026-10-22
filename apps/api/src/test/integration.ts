import { randomUUID } from "node:crypto";
import type { RoleName } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../modules/auth/password-service.js";

/** Os testes de integração só rodam com um banco de teste informado (ver vitest.config.ts). */
export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

export const PASSWORD = "SenhaDeTeste!2026";

export type ApiResult = { status: number; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function startApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export function client(app: FastifyInstance) {
  async function call(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    token?: string,
    body?: unknown
  ): Promise<ApiResult> {
    const response = await app.inject({
      method,
      url: `/api/v1${url}`,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      ...(body === undefined ? {} : { payload: body as object })
    });
    let parsed: unknown = null;
    try {
      parsed = response.json();
    } catch {
      parsed = response.body;
    }
    return { status: response.statusCode, body: parsed };
  }
  async function login(email: string, password = PASSWORD): Promise<ApiResult> {
    return call("POST", "/auth/login", undefined, { email, password });
  }
  async function token(email: string, password = PASSWORD): Promise<string> {
    const result = await login(email, password);
    if (result.status !== 200)
      throw new Error(`login de ${email} falhou: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body.data.accessToken as string;
  }
  return { call, login, token };
}

export type TestUser = { id: string; email: string };

export async function createUser(input: {
  role: RoleName;
  suffix: string;
  scope?: { companyId: string; unitId: string; operationId: string } | "global";
  createdBy?: string;
}): Promise<TestUser> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: input.role } });
  const email = `${input.role.toLowerCase()}.${input.suffix}@teste.local`;
  const created = await prisma.user.create({
    data: {
      email,
      name: `Teste ${input.role} ${input.suffix}`,
      passwordHash: hashPassword(PASSWORD),
      roleId: role.id,
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      ...(input.scope
        ? {
            scopes: {
              create:
                input.scope === "global" ? { isGlobal: true } : { isGlobal: false, ...input.scope }
            }
          }
        : {})
    },
    select: { id: true, email: true }
  });
  return created;
}

export type Fixture = {
  suffix: string;
  scope: { companyId: string; unitId: string; operationId: string };
  seededAdminId: string;
  seededDevId: string;
};

/** Empresa → cliente → unidade → operação isoladas, para o teste não depender de dados de outros. */
export async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);
  const company = await prisma.company.create({ data: { name: `Empresa ${suffix}` } });
  const client_ = await prisma.client.create({
    data: { companyId: company.id, name: `Cliente ${suffix}` }
  });
  const unit = await prisma.unit.create({
    data: { companyId: company.id, clientId: client_.id, name: `Unidade ${suffix}` }
  });
  const operation = await prisma.operation.create({
    data: {
      companyId: company.id,
      clientId: client_.id,
      unitId: unit.id,
      name: `Operação ${suffix}`,
      code: `T${suffix}`
    }
  });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@myflux.local" },
    select: { id: true }
  });
  const dev = await prisma.user.findUniqueOrThrow({
    where: { email: "dev@myflux.local" },
    select: { id: true }
  });
  return {
    suffix,
    scope: { companyId: company.id, unitId: unit.id, operationId: operation.id },
    seededAdminId: admin.id,
    seededDevId: dev.id
  };
}

let versionCounter = 100;
/** Cria uma versão de escala direto no banco, na situação pedida (para testar as transições do fluxo). */
export async function createScheduleVersion(
  operationId: string,
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED",
  createdBy: string
) {
  versionCounter += 1;
  return prisma.scheduleVersion.create({
    data: {
      operationId,
      month: new Date("2026-10-01T00:00:00Z"),
      version: versionCounter,
      status,
      generatedInput: {},
      generatedResult: {
        grid: { year: 2026, month: 10, sections: [], holidays: [] },
        pendencies: [],
        metrics: { required: 0, covered: 0, coverage: 0 }
      },
      createdBy
    }
  });
}
