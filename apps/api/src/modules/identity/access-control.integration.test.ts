/**
 * Controle de acesso de ponta a ponta: API real + Postgres real (nada de mock).
 * Cobre a regra de negócio dos perfis (RH, Aprovador, administradores), a autorização NO SERVIDOR (não só na tela),
 * revogação imediata de permissão, proteção contra elevação de privilégio, troca de perfil, bloqueio de conta e auditoria.
 */
import { defaultRolePermissions } from "@my-flux/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import {
  PASSWORD,
  client,
  createFixture,
  createScheduleVersion,
  createUser,
  hasDatabase,
  startApp,
  type Fixture,
  type TestUser
} from "../../test/integration.js";

const SEEDED_PASSWORD = "ChangeMe!2026"; // senha das contas da seed (banco de teste)

describe.skipIf(!hasDatabase)("controle de acesso por perfil", () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof client>;
  let fx: Fixture;
  let rh: TestUser;
  let approver: TestUser;
  let comum: TestUser;
  let tokens: Record<"rh" | "approver" | "comum" | "admin" | "dev", string>;

  beforeAll(async () => {
    app = await startApp();
    api = client(app);
    fx = await createFixture();
    rh = await createUser({
      role: "RH",
      suffix: fx.suffix,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    approver = await createUser({
      role: "APPROVER",
      suffix: fx.suffix,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    comum = await createUser({
      role: "COMUM",
      suffix: fx.suffix,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    tokens = {
      rh: await api.token(rh.email),
      approver: await api.token(approver.email),
      comum: await api.token(comum.email),
      admin: await api.token("admin@myflux.local", SEEDED_PASSWORD),
      dev: await api.token("dev@myflux.local", SEEDED_PASSWORD)
    };
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  describe("sessão", () => {
    it("sem login nada é permitido (401)", async () => {
      for (const [method, url] of [
        ["GET", "/schedules"],
        ["GET", "/employees"],
        ["POST", "/employee-schedules/generate"],
        ["GET", "/users"],
        ["GET", "/roles"]
      ] as const) {
        const r = await api.call(method, url);
        expect(r.status, `${method} ${url}`).toBe(401);
        expect(r.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    });

    it("/auth/me devolve as permissões do perfil, vindas do banco", async () => {
      const cases = [
        ["rh", defaultRolePermissions.RH],
        ["approver", defaultRolePermissions.APPROVER],
        ["comum", defaultRolePermissions.COMUM]
      ] as const;
      for (const [key, expected] of cases) {
        const me = await api.call("GET", "/auth/me", tokens[key]);
        expect(me.status).toBe(200);
        expect([...me.body.data.user.permissions].sort()).toEqual([...expected].sort());
      }
    });

    it("a resposta de login nunca traz o hash da senha", async () => {
      const r = await api.login(rh.email);
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|pbkdf2/i);
    });
  });

  describe("Aprovador: só consulta e decide", () => {
    it("lê as escalas", async () => {
      expect((await api.call("GET", "/schedules", tokens.approver)).status).toBe(200);
    });

    it.each([
      ["criar colaborador", "POST", "/employees"],
      ["editar colaborador", "PATCH", "/employees/00000000-0000-4000-8000-000000000001"],
      ["arquivar colaborador", "DELETE", "/employees/00000000-0000-4000-8000-000000000001"],
      ["registrar afastamento", "POST", "/calendar/events"],
      ["gerar escala", "POST", "/employee-schedules/generate"],
      ["ajustar dia da escala", "POST", "/schedule-day-overrides"],
      ["remover ajuste", "DELETE", "/schedule-day-overrides/00000000-0000-4000-8000-000000000001"],
      ["excluir escala", "DELETE", "/employee-schedules/00000000-0000-4000-8000-000000000001"],
      ["listar usuários", "GET", "/users"],
      ["ver permissões dos perfis", "GET", "/roles"],
      ["alterar permissões", "PUT", "/roles/RH/permissions"],
      ["consultar a auditoria", "GET", "/audit/logs"]
    ] as const)(
      "NÃO pode %s (403 no servidor, antes de olhar o corpo da requisição)",
      async (_name, method, url) => {
        const r = await api.call(method, url, tokens.approver, method === "GET" ? undefined : {});
        expect(r.status).toBe(403);
        expect(r.body.code).toBe("PERMISSION_DENIED");
        expect(r.body.message).toContain("Seu perfil não tem a permissão");
      }
    );

    it("aprova uma escala enviada, mas não envia, não publica nem exclui", async () => {
      const inReview = await createScheduleVersion(fx.scope.operationId, "IN_REVIEW", rh.id);
      const approve = await api.call("PATCH", `/schedules/${inReview.id}/status`, tokens.approver, {
        status: "APPROVED"
      });
      expect(approve.status).toBe(200);
      expect(approve.body.data.status).toBe("APPROVED");

      const draft = await createScheduleVersion(fx.scope.operationId, "DRAFT", rh.id);
      const submit = await api.call("PATCH", `/schedules/${draft.id}/status`, tokens.approver, {
        status: "IN_REVIEW"
      });
      expect(submit.status).toBe(403);
      expect(submit.body.code).toBe("SCHEDULE_WORKFLOW_FORBIDDEN");

      const approved = await createScheduleVersion(fx.scope.operationId, "APPROVED", rh.id);
      const publish = await api.call("PATCH", `/schedules/${approved.id}/status`, tokens.approver, {
        status: "PUBLISHED"
      });
      expect(publish.status).toBe(403);
      expect(
        (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: approved.id } })).status
      ).toBe("APPROVED");
    });
  });

  describe("RH: opera as escalas, mas não aprova nem administra", () => {
    it("envia para aprovação e publica a escala aprovada", async () => {
      const draft = await createScheduleVersion(fx.scope.operationId, "DRAFT", rh.id);
      const submit = await api.call("PATCH", `/schedules/${draft.id}/status`, tokens.rh, {
        status: "IN_REVIEW"
      });
      expect(submit.status).toBe(200);

      const approved = await createScheduleVersion(fx.scope.operationId, "APPROVED", rh.id);
      const publish = await api.call("PATCH", `/schedules/${approved.id}/status`, tokens.rh, {
        status: "PUBLISHED"
      });
      expect(publish.status).toBe(200);
      expect(publish.body.data.status).toBe("PUBLISHED");
    });

    it("não aprova e não publica escala pendente ou em rascunho", async () => {
      const inReview = await createScheduleVersion(fx.scope.operationId, "IN_REVIEW", rh.id);
      const approve = await api.call("PATCH", `/schedules/${inReview.id}/status`, tokens.rh, {
        status: "APPROVED"
      });
      expect(approve.status).toBe(403);
      const publishPending = await api.call(
        "PATCH",
        `/schedules/${inReview.id}/status`,
        tokens.rh,
        { status: "PUBLISHED" }
      );
      expect(publishPending.status).toBe(403);
      const draft = await createScheduleVersion(fx.scope.operationId, "DRAFT", rh.id);
      const publishDraft = await api.call("PATCH", `/schedules/${draft.id}/status`, tokens.rh, {
        status: "PUBLISHED"
      });
      expect(publishDraft.status).toBe(403);
      expect(
        (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: inReview.id } })).status
      ).toBe("IN_REVIEW");
    });

    it("passa pela autorização das operações de cadastro e de escala (qualquer outro status é erro de dados, não de acesso)", async () => {
      for (const [method, url] of [
        ["POST", "/employees"],
        ["POST", "/calendar/events"],
        ["POST", "/employee-schedules/generate"],
        ["POST", "/schedule-day-overrides"]
      ] as const) {
        const r = await api.call(method, url, tokens.rh, {});
        expect([401, 403], `${method} ${url}`).not.toContain(r.status);
      }
    });

    it.each([
      ["listar usuários", "GET", "/users"],
      ["ver permissões dos perfis", "GET", "/roles"],
      ["alterar permissões", "PUT", "/roles/COMUM/permissions"],
      ["trocar perfil de usuário", "PATCH", "/users/00000000-0000-4000-8000-000000000001/role"],
      ["desbloquear conta", "POST", "/users/00000000-0000-4000-8000-000000000001/unlock"],
      ["consultar a auditoria", "GET", "/audit/logs"]
    ] as const)("NÃO pode %s", async (_name, method, url) => {
      const r = await api.call(method, url, tokens.rh, method === "GET" ? undefined : {});
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("PERMISSION_DENIED");
    });
  });

  describe("COMUM mantém só a leitura que já tinha", () => {
    it("lê as escalas e não opera nada", async () => {
      expect((await api.call("GET", "/schedules", tokens.comum)).status).toBe(200);
      for (const [method, url] of [
        ["POST", "/employees"],
        ["POST", "/employee-schedules/generate"],
        ["POST", "/schedule-day-overrides"],
        ["GET", "/users"]
      ] as const) {
        expect(
          (await api.call(method, url, tokens.comum, method === "GET" ? undefined : {})).status,
          `${method} ${url}`
        ).toBe(403);
      }
      const draft = await createScheduleVersion(fx.scope.operationId, "DRAFT", rh.id);
      expect(
        (
          await api.call("PATCH", `/schedules/${draft.id}/status`, tokens.comum, {
            status: "IN_REVIEW"
          })
        ).status
      ).toBe(403);
    });
  });

  describe("escopo: o acesso à unidade continua valendo", () => {
    it("RH de uma unidade não consegue gerar escala de outra unidade", async () => {
      const other = await createFixture();
      const r = await api.call("POST", "/employee-schedules/generate", tokens.rh, {
        operationId: other.scope.operationId,
        month: "2026-10"
      });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("SCOPE_FORBIDDEN");
    });
  });

  describe("permissões são decididas pelo banco, não pelo nome do perfil", () => {
    it("revogar uma permissão vale na PRÓXIMA requisição, sem novo login", async () => {
      const before = await api.call("POST", "/employee-schedules/generate", tokens.rh, {
        operationId: fx.scope.operationId,
        month: "2026-10"
      });
      expect([401, 403]).not.toContain(before.status);

      const without = defaultRolePermissions.RH.filter((code) => code !== "schedules:generate");
      const revoke = await api.call("PUT", "/roles/RH/permissions", tokens.admin, {
        permissions: without,
        justification: "Teste de revogação imediata"
      });
      expect(revoke.status).toBe(200);
      try {
        const after = await api.call("POST", "/employee-schedules/generate", tokens.rh, {
          operationId: fx.scope.operationId,
          month: "2026-10"
        });
        expect(after.status).toBe(403);
        expect(after.body.message).toContain("Gerar escalas");
      } finally {
        const restore = await api.call("PUT", "/roles/RH/permissions", tokens.admin, {
          permissions: [...defaultRolePermissions.RH],
          justification: "Restaurar o padrão"
        });
        expect(restore.status).toBe(200);
      }
      const restored = await api.call("POST", "/employee-schedules/generate", tokens.rh, {
        operationId: fx.scope.operationId,
        month: "2026-10"
      });
      expect([401, 403]).not.toContain(restored.status);
    });

    it("a alteração de permissões fica registrada na auditoria, com antes, depois e justificativa", async () => {
      const without = defaultRolePermissions.RH.filter((code) => code !== "schedules:archive");
      await api.call("PUT", "/roles/RH/permissions", tokens.admin, {
        permissions: without,
        justification: "Auditoria do teste"
      });
      await api.call("PUT", "/roles/RH/permissions", tokens.admin, {
        permissions: [...defaultRolePermissions.RH]
      });
      const logs = await prisma.auditLog.findMany({
        where: { action: "PERMISSION_CHANGE", entity: "Role", justification: "Auditoria do teste" },
        orderBy: { createdAt: "desc" }
      });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs[0]!;
      expect(entry.userRole).toBe("ADMIN");
      expect((entry.before as { permissions: string[] }).permissions).toContain(
        "schedules:archive"
      );
      expect((entry.after as { permissions: string[] }).permissions).not.toContain(
        "schedules:archive"
      );
    });
  });

  describe("proteção contra elevação de privilégio", () => {
    it("administrador (não-DEV) não altera permissões do próprio perfil nem do perfil DEV", async () => {
      for (const role of ["ADMIN", "DEV"]) {
        const r = await api.call("PUT", `/roles/${role}/permissions`, tokens.admin, {
          permissions: ["auth:me"]
        });
        expect(r.status, role).toBe(403);
        expect(r.body.code).toBe("PERMISSION_CHANGE_FORBIDDEN");
      }
    });

    it("nenhum perfil perde a consulta da própria sessão, e o DEV não perde a gestão de permissões", async () => {
      const noMe = await api.call("PUT", "/roles/COMUM/permissions", tokens.admin, {
        permissions: ["schedules:read"]
      });
      expect(noMe.status).toBe(403);
      expect(noMe.body.message).toContain("não pode ser retirada");

      const devWithout = defaultRolePermissions.DEV.filter((code) => code !== "permissions:manage");
      const lockout = await api.call("PUT", "/roles/DEV/permissions", tokens.dev, {
        permissions: devWithout
      });
      expect(lockout.status).toBe(403);
      const still = await api.call("GET", "/roles", tokens.dev);
      expect(still.status).toBe(200); // o sistema não se trancou
    });

    it("recusa permissão que não existe no catálogo", async () => {
      const r = await api.call("PUT", "/roles/RH/permissions", tokens.admin, {
        permissions: [...defaultRolePermissions.RH, "tudo:liberado"]
      });
      expect(r.status).toBe(403);
      expect(r.body.message).toContain("não existe");
    });

    it("administrador não promove ninguém a administrador/DEV, e ninguém troca o próprio perfil", async () => {
      const toAdmin = await api.call("PATCH", `/users/${comum.id}/role`, tokens.admin, {
        role: "ADMIN"
      });
      expect(toAdmin.status).toBe(403);
      expect(toAdmin.body.code).toBe("ROLE_ELEVATION_FORBIDDEN");
      const toDev = await api.call("PATCH", `/users/${comum.id}/role`, tokens.admin, {
        role: "DEV"
      });
      expect(toDev.status).toBe(403);

      const adminId = fx.seededAdminId;
      const self = await api.call("PATCH", `/users/${adminId}/role`, tokens.admin, {
        role: "COMUM"
      });
      expect(self.status).toBe(409);
      expect(self.body.code).toBe("CANNOT_CHANGE_OWN_ROLE");
    });

    it("troca o perfil de um usuário, revoga as sessões dele e registra a mudança", async () => {
      const target = await createUser({
        role: "COMUM",
        suffix: `${fx.suffix}r`,
        scope: fx.scope,
        createdBy: fx.seededAdminId
      });
      const targetToken = await api.token(target.email);
      const change = await api.call("PATCH", `/users/${target.id}/role`, tokens.admin, {
        role: "APPROVER",
        justification: "Passa a aprovar escalas"
      });
      expect(change.status).toBe(200);
      expect(change.body.data).toMatchObject({
        changed: true,
        role: "APPROVER",
        previousRole: "COMUM"
      });

      // a pessoa continua com o token antigo, mas já vale o perfil novo (permissões lidas do banco a cada requisição)
      const me = await api.call("GET", "/auth/me", targetToken);
      expect(me.status).toBe(200);
      expect(me.body.data.user.role).toBe("APPROVER");
      expect(me.body.data.user.permissions).toContain("schedules:approve");

      const sessions = await prisma.refreshSession.count({
        where: { userId: target.id, revokedAt: null }
      });
      expect(sessions).toBe(0);
      const log = await prisma.auditLog.findFirst({
        where: { action: "ROLE_CHANGE", entityId: target.id }
      });
      expect(log?.justification).toBe("Passa a aprovar escalas");
      expect(log?.before).toEqual({ role: "COMUM" });
      expect(log?.after).toEqual({ role: "APPROVER" });
    });
  });

  describe("conta desativada e bloqueada", () => {
    it("desativar uma conta derruba o token que ela já tinha, na hora", async () => {
      const target = await createUser({
        role: "RH",
        suffix: `${fx.suffix}d`,
        scope: fx.scope,
        createdBy: fx.seededAdminId
      });
      const targetToken = await api.token(target.email);
      expect((await api.call("GET", "/schedules", targetToken)).status).toBe(200);

      const off = await api.call("PATCH", `/users/${target.id}/status`, tokens.admin, {
        isActive: false
      });
      expect(off.status).toBe(200);
      expect((await api.call("GET", "/schedules", targetToken)).status).toBe(401);

      // senha certa em conta desativada: mensagem clara; senha errada: nada é revelado
      const right = await api.login(target.email);
      expect(right.status).toBe(403);
      expect(right.body.code).toBe("ACCOUNT_DISABLED");
      const wrong = await api.login(target.email, "outra-senha-qualquer-1");
      expect(wrong.status).toBe(401);
      expect(wrong.body.code).toBe("INVALID_CREDENTIALS");

      expect(
        (await api.call("PATCH", `/users/${target.id}/status`, tokens.admin, { isActive: true }))
          .status
      ).toBe(200);
      expect((await api.login(target.email)).status).toBe(200);
    });

    it("ninguém desativa a própria conta", async () => {
      const r = await api.call("PATCH", `/users/${fx.seededAdminId}/status`, tokens.admin, {
        isActive: false
      });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe("CANNOT_DISABLE_SELF");
    });
  });
});

describe.skipIf(!hasDatabase)("bloqueio de conta por tentativas de login", () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof client>;
  let fx: Fixture;

  beforeAll(async () => {
    app = await startApp();
    api = client(app);
    fx = await createFixture();
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  it("5 senhas erradas bloqueiam; com a senha certa a resposta diz que está bloqueada; o administrador desbloqueia", async () => {
    const user = await createUser({
      role: "RH",
      suffix: `${fx.suffix}l`,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    for (let i = 1; i <= 5; i++) {
      const r = await api.login(user.email, `senha-errada-${i}-xxxx`);
      expect(r.status, `tentativa ${i}`).toBe(401);
      expect(r.body.code).toBe("INVALID_CREDENTIALS");
    }
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lockedUntil && stored.lockedUntil.getTime() > Date.now()).toBe(true);

    // senha errada em conta bloqueada continua igual a qualquer outra senha errada (nada é revelado a quem adivinha)
    const wrongWhileLocked = await api.login(user.email, "mais-uma-senha-errada");
    expect(wrongWhileLocked.status).toBe(401);
    expect(wrongWhileLocked.body.code).toBe("INVALID_CREDENTIALS");

    // quem sabe a senha certa é informado do bloqueio
    const locked = await api.login(user.email, PASSWORD);
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    expect(locked.body.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.body.message).toContain("bloqueada temporariamente");

    const adminToken = await api.token("admin@myflux.local", SEEDED_PASSWORD);
    const unlock = await api.call("POST", `/users/${user.id}/unlock`, adminToken);
    expect(unlock.status).toBe(200);
    expect((await api.login(user.email, PASSWORD)).status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();
  }, 60_000);

  it("um login certo zera as falhas anteriores", async () => {
    const user = await createUser({
      role: "RH",
      suffix: `${fx.suffix}z`,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    for (let i = 0; i < 3; i++) await api.login(user.email, "senha-errada-qualquer-1");
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginAttempts
    ).toBe(3);
    expect((await api.login(user.email, PASSWORD)).status).toBe(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginAttempts
    ).toBe(0);
  }, 60_000);

  it("e-mail que não existe responde exatamente como senha errada (não revela quem tem conta)", async () => {
    const missing = await api.login("ninguem.existe@teste.local", "qualquer-senha-123");
    const real = await createUser({
      role: "COMUM",
      suffix: `${fx.suffix}x`,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    const wrong = await api.login(real.email, "qualquer-senha-123");
    expect(missing.status).toBe(wrong.status);
    expect(missing.body).toEqual(wrong.body);
  }, 60_000);
});
