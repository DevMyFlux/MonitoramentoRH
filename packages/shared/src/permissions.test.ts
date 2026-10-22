import { describe, expect, it } from "vitest";
import {
  canEditRolePermissions,
  defaultRolePermissions,
  hasPermission,
  isPermissionCode,
  isRoleAtLeast,
  permissionCatalog,
  permissionCodes,
  permissionLabel,
  protectedPermissions,
  roleRank,
  validatePermissionChange,
  type PermissionCode,
  type Role
} from "./permissions.js";

const roles = Object.keys(roleRank) as Role[];

describe("catálogo de permissões", () => {
  it("não tem código repetido e todo código segue recurso:ação", () => {
    const codes = permissionCatalog.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z]+:[a-z]+$/);
  });

  it("todo item tem rótulo e descrição legíveis", () => {
    for (const p of permissionCatalog) {
      expect(p.label.length).toBeGreaterThan(3);
      expect(p.description.length).toBeGreaterThan(10);
    }
    expect(permissionLabel("schedules:approve")).toBe("Aprovar escalas");
    expect(permissionLabel("coisa:inexistente")).toBe("coisa:inexistente");
  });

  it("as permissões padrão só referenciam códigos do catálogo", () => {
    for (const role of roles) {
      for (const code of defaultRolePermissions[role])
        expect(isPermissionCode(code), `${role}:${code}`).toBe(true);
      for (const code of protectedPermissions[role])
        expect(defaultRolePermissions[role]).toContain(code);
    }
  });
});

describe("matriz padrão por perfil (requisito de negócio)", () => {
  const can = (role: Role, code: PermissionCode) =>
    hasPermission(defaultRolePermissions[role], code);

  it("administradores (DEV e ADMIN) têm todas as permissões", () => {
    for (const role of ["DEV", "ADMIN"] as const) {
      for (const code of permissionCodes) expect(can(role, code), `${role}:${code}`).toBe(true);
    }
  });

  it("RH opera as escalas, mas NÃO aprova nem reprova", () => {
    for (const code of [
      "employees:manage",
      "leaves:manage",
      "substitutions:manage",
      "schedules:generate",
      "schedules:edit",
      "schedules:submit",
      "schedules:publish"
    ] as const) {
      expect(can("RH", code), code).toBe(true);
    }
    expect(can("RH", "schedules:approve")).toBe(false);
    expect(can("RH", "schedules:reject")).toBe(false);
    expect(can("RH", "permissions:manage")).toBe(false);
    expect(can("RH", "users:manage")).toBe(false);
  });

  it("Aprovador só consulta e decide: não edita colaboradores, rodízios, atribuições nem o conteúdo da escala", () => {
    expect(defaultRolePermissions.APPROVER).toEqual([
      "auth:me",
      "schedules:read",
      "schedules:approve",
      "schedules:reject"
    ]);
    for (const code of [
      "employees:manage",
      "leaves:manage",
      "substitutions:manage",
      "schedules:generate",
      "schedules:edit",
      "schedules:submit",
      "schedules:publish",
      "schedules:archive",
      "users:manage",
      "permissions:manage"
    ] as const) {
      expect(can("APPROVER", code), code).toBe(false);
    }
  });

  it("COMUM mantém o acesso de leitura que já tinha e nada de gestão", () => {
    expect(defaultRolePermissions.COMUM).toEqual(["auth:me", "schedules:read"]);
  });

  it("o título Desenvolvedor, sozinho, não concede nada: a decisão depende das permissões recebidas", () => {
    expect(hasPermission([], "schedules:approve")).toBe(false);
    expect(hasPermission(undefined, "schedules:approve")).toBe(false);
  });
});

describe("hierarquia de delegação", () => {
  it("DEV > ADMIN > RH = Aprovador > COMUM", () => {
    expect(isRoleAtLeast("DEV", "ADMIN")).toBe(true);
    expect(isRoleAtLeast("ADMIN", "DEV")).toBe(false);
    expect(isRoleAtLeast("RH", "ADMIN")).toBe(false);
    expect(isRoleAtLeast("COMUM", "RH")).toBe(false);
    expect(roleRank.RH).toBe(roleRank.APPROVER);
  });

  it("perfil só edita perfis abaixo do seu; só o topo edita o próprio", () => {
    expect(canEditRolePermissions("ADMIN", "RH")).toBe(true);
    expect(canEditRolePermissions("ADMIN", "APPROVER")).toBe(true);
    expect(canEditRolePermissions("ADMIN", "ADMIN")).toBe(false);
    expect(canEditRolePermissions("ADMIN", "DEV")).toBe(false);
    expect(canEditRolePermissions("RH", "APPROVER")).toBe(false);
    expect(canEditRolePermissions("DEV", "DEV")).toBe(true);
    expect(canEditRolePermissions("DEV", "ADMIN")).toBe(true);
  });
});

describe("validatePermissionChange — proteção contra elevação de privilégio", () => {
  const admin = { actorRole: "ADMIN" as const, actorPermissions: defaultRolePermissions.ADMIN };

  it("permite o administrador ajustar o perfil RH", () => {
    const next = [...defaultRolePermissions.RH, "audit:read"];
    expect(
      validatePermissionChange({
        ...admin,
        targetRole: "RH",
        currentPermissions: defaultRolePermissions.RH,
        nextPermissions: next
      })
    ).toEqual([]);
  });

  it("recusa permissão que não existe no catálogo", () => {
    const problems = validatePermissionChange({
      ...admin,
      targetRole: "RH",
      currentPermissions: defaultRolePermissions.RH,
      nextPermissions: [...defaultRolePermissions.RH, "tudo:liberado"]
    });
    expect(problems.map((p) => p.code)).toContain("UNKNOWN_PERMISSION");
  });

  it("recusa editar um perfil acima ou igual ao do ator", () => {
    for (const target of ["ADMIN", "DEV"] as const) {
      const problems = validatePermissionChange({
        ...admin,
        targetRole: target,
        currentPermissions: defaultRolePermissions[target],
        nextPermissions: defaultRolePermissions[target]
      });
      expect(
        problems.map((p) => p.code),
        target
      ).toContain("ROLE_NOT_MANAGEABLE");
    }
  });

  it("não deixa conceder o que o próprio ator não possui", () => {
    const limitedAdmin = {
      actorRole: "ADMIN" as const,
      actorPermissions: defaultRolePermissions.ADMIN.filter((c) => c !== "schedules:publish")
    };
    const problems = validatePermissionChange({
      ...limitedAdmin,
      targetRole: "APPROVER",
      currentPermissions: defaultRolePermissions.APPROVER,
      nextPermissions: [...defaultRolePermissions.APPROVER, "schedules:publish"]
    });
    expect(problems.map((p) => p.code)).toEqual(["CANNOT_GRANT_UNHELD"]);
    expect(problems[0]?.message).toContain("Publicar escalas");
  });

  it("não deixa tirar permissão protegida (evita trancar o sistema)", () => {
    const dev = { actorRole: "DEV" as const, actorPermissions: defaultRolePermissions.DEV };
    const without = defaultRolePermissions.DEV.filter(
      (c) => c !== "permissions:manage" && c !== "users:manage"
    );
    const problems = validatePermissionChange({
      ...dev,
      targetRole: "DEV",
      currentPermissions: defaultRolePermissions.DEV,
      nextPermissions: without
    });
    expect(problems.map((p) => p.permission).sort()).toEqual([
      "permissions:manage",
      "users:manage"
    ]);
    // nenhum perfil perde a consulta da própria sessão
    const noMe = validatePermissionChange({
      ...admin,
      targetRole: "COMUM",
      currentPermissions: defaultRolePermissions.COMUM,
      nextPermissions: ["schedules:read"]
    });
    expect(noMe.map((p) => p.code)).toEqual(["PROTECTED_PERMISSION"]);
  });

  it("retirar permissões comuns de um perfil é permitido", () => {
    expect(
      validatePermissionChange({
        ...admin,
        targetRole: "RH",
        currentPermissions: defaultRolePermissions.RH,
        nextPermissions: ["auth:me", "schedules:read"]
      })
    ).toEqual([]);
  });
});
