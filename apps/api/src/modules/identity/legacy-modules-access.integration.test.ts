/**
 * Os módulos antigos (cadastros-mestre, parâmetros, QLP, aptidão, avaliações, posições, recrutamento e importações)
 * decidem o acesso por PERMISSÃO, no servidor. API real + Postgres real. Cada linha da tabela chama uma operação
 * representativa do módulo com cada perfil: quem tem a permissão passa da autorização (qualquer outro status é erro
 * de dados, não de acesso); quem não tem recebe 403 PERMISSION_DENIED, sem efeito nenhum.
 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import {
  client,
  createFixture,
  createUser,
  hasDatabase,
  startApp,
  type ApiResult,
  type Fixture
} from "../../test/integration.js";

const SEEDED_PASSWORD = "ChangeMe!2026";

type Who = "dev" | "admin" | "rh" | "approver" | "comum";
const everyone: Who[] = ["dev", "admin", "rh", "approver", "comum"];

describe.skipIf(!hasDatabase)("módulos antigos: acesso por permissão", () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof client>;
  let fx: Fixture;
  let tokens: Record<Who, string>;

  beforeAll(async () => {
    app = await startApp();
    api = client(app);
    fx = await createFixture();
    const rh = await createUser({ role: "RH", suffix: fx.suffix, scope: fx.scope, createdBy: fx.seededAdminId });
    const approver = await createUser({ role: "APPROVER", suffix: fx.suffix, scope: fx.scope, createdBy: fx.seededAdminId });
    const comum = await createUser({ role: "COMUM", suffix: fx.suffix, scope: fx.scope, createdBy: fx.seededAdminId });
    tokens = {
      dev: await api.token("dev@myflux.local", SEEDED_PASSWORD),
      admin: await api.token("admin@myflux.local", SEEDED_PASSWORD),
      rh: await api.token(rh.email),
      approver: await api.token(approver.email),
      comum: await api.token(comum.email)
    };
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const someUuid = "00000000-0000-4000-8000-000000000001";
  const csv = Buffer.from("nome;matricula\nFulano;1\n").toString("base64");

  type Case = {
    name: string;
    permission: string;
    allowed: Who[];
    call: (token: string) => Promise<ApiResult>;
  };
  const cases = (): Case[] => [
    {
      name: "cadastros-mestre (criar empresa)",
      permission: "masterdata:manage",
      allowed: ["dev", "admin"],
      call: (t) => api.call("POST", "/companies", t, {})
    },
    {
      name: "parâmetros (criar parâmetro)",
      permission: "parameters:manage",
      allowed: ["dev", "admin"],
      call: (t) => api.call("POST", "/parameters", t, {})
    },
    {
      name: "escala por QLP (gerar)",
      permission: "qlp:manage",
      allowed: ["dev", "admin"],
      call: (t) => api.call("POST", "/schedules/generate", t, {})
    },
    {
      name: "QLP (criar versão)",
      permission: "qlp:manage",
      allowed: ["dev", "admin"],
      call: (t) =>
        api.call("POST", "/qlp/versions", t, {
          operationId: fx.scope.operationId,
          kind: "OPERATIONAL",
          validFrom: "2026-11-01T00:00:00.000Z",
          reason: "teste de acesso",
          requirements: [{ functionId: someUuid, quantity: 1 }]
        })
    },
    {
      name: "aptidão (criar requisito)",
      permission: "aptitude:manage",
      allowed: ["dev", "admin", "rh"],
      call: (t) => api.call("POST", "/requirements", t, {})
    },
    {
      name: "avaliações (criar avaliação)",
      permission: "evaluations:manage",
      allowed: ["dev", "admin", "rh"],
      call: (t) => api.call("POST", "/evaluations", t, {})
    },
    {
      name: "posições (atribuir colaborador)",
      permission: "positions:assign",
      allowed: ["dev", "admin", "rh"],
      call: (t) => api.call("POST", `/positions/${someUuid}/assign`, t, {})
    },
    {
      name: "recrutamento (abrir requisição)",
      permission: "recruitment:manage",
      allowed: ["dev", "admin", "rh"],
      call: (t) => api.call("POST", "/recruitment/requests", t, {})
    },
    {
      name: "importar colaboradores",
      permission: "imports:employees",
      allowed: ["dev", "admin", "rh"],
      call: (t) => api.call("POST", "/imports", t, { type: "EMPLOYEES", fileName: "x.csv", contentBase64: csv })
    },
    {
      name: "importar QLP",
      permission: "imports:run",
      allowed: ["dev", "admin"],
      call: (t) => api.call("POST", "/imports", t, { type: "QLP", fileName: "x.csv", contentBase64: csv })
    }
  ];

  it("cada perfil só passa onde tem a permissão; o restante é 403 PERMISSION_DENIED", async () => {
    for (const c of cases()) {
      for (const who of everyone) {
        const result = await c.call(tokens[who]);
        if (c.allowed.includes(who)) {
          // Passou da AUTORIZAÇÃO: pode falhar depois por dados ou por escopo (outro código), mas não por permissão.
          const label = `${who} × ${c.name} (${result.status} ${JSON.stringify(result.body).slice(0, 120)})`;
          expect(result.status, label).not.toBe(401);
          expect(result.body?.code, label).not.toBe("PERMISSION_DENIED");
        } else {
          expect(result.status, `${who} × ${c.name}`).toBe(403);
          expect(result.body.code, `${who} × ${c.name}`).toBe("PERMISSION_DENIED");
          expect(result.body.details?.permission ?? result.body.permission, `${who} × ${c.name}`).toBe(c.permission);
        }
      }
    }
  }, 120_000);

  it("sem login, todas as operações respondem 401", async () => {
    for (const c of cases()) {
      const result = await c.call("");
      expect(result.status, c.name).toBe(401);
    }
  });

  it("a permissão manda, não o nome do perfil: conceder masterdata:manage ao RH abre o cadastro; retirar fecha na hora", async () => {
    const rhRole = await prisma.role.findUniqueOrThrow({ where: { name: "RH" } });
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code: "masterdata:manage" } });
    const before = await api.call("POST", "/companies", tokens.rh, {});
    expect(before.status).toBe(403);
    await prisma.rolePermission.create({ data: { roleId: rhRole.id, permissionId: permission.id } });
    try {
      const granted = await api.call("POST", "/companies", tokens.rh, {});
      expect(granted.status).not.toBe(401);
      expect(granted.body?.code).not.toBe("PERMISSION_DENIED");
    } finally {
      await prisma.rolePermission.deleteMany({ where: { roleId: rhRole.id, permissionId: permission.id } });
    }
    const after = await api.call("POST", "/companies", tokens.rh, {});
    expect(after.status).toBe(403);
  });

  it("o administrador consegue conceder/retirar as novas permissões pela matriz (e ela aparece no catálogo)", async () => {
    const roles = await api.call("GET", "/roles", tokens.admin);
    expect(roles.status).toBe(200);
    const catalog = roles.body.data.catalog.map((p: { code: string }) => p.code);
    for (const code of [
      "masterdata:manage",
      "aptitude:manage",
      "evaluations:manage",
      "imports:run",
      "imports:employees",
      "qlp:manage",
      "positions:assign",
      "parameters:manage",
      "recruitment:manage"
    ]) {
      expect(catalog).toContain(code);
    }
    const rh = roles.body.data.roles.find((r: { name: string }) => r.name === "RH");
    expect(rh.permissions).toEqual(expect.arrayContaining(["aptitude:manage", "evaluations:manage", "imports:employees", "positions:assign", "recruitment:manage"]));
    expect(rh.permissions).not.toContain("masterdata:manage");
  });
});
