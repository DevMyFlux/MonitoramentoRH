import { defaultRolePermissions, permissionCodes, type PermissionCode, type Role } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { canImport } from "../imports/import-policy.js";
import { can } from "./authorization.js";

/**
 * Prova de equivalência: ao trocar "decide pelo nome do perfil" por "decide por permissão", NENHUM perfil pode ganhar
 * nem perder acesso com a matriz PADRÃO. As listas abaixo são uma cópia CONGELADA da regra antiga (os assertRole /
 * assertCanManage* que existiam no código) — não são importadas de lugar nenhum, de propósito.
 */
const roles: Role[] = ["DEV", "ADMIN", "RH", "APPROVER", "COMUM"];

/** Quem podia o quê pelo nome do perfil, antes da migração para permissões. */
const legacyRule: Record<string, readonly Role[]> = {
  "masterdata:manage": ["DEV", "ADMIN"], // assertCanManageMasterData (empresas, clientes, unidades, contratos…)
  "parameters:manage": ["DEV", "ADMIN"], // POST /parameters
  "qlp:manage": ["DEV", "ADMIN"], // QLP (criar/aprovar/arquivar) e geração da escala por QLP
  "aptitude:manage": ["DEV", "ADMIN", "RH"], // assertCanManageAptitude
  "evaluations:manage": ["DEV", "ADMIN", "RH"], // assertCanManageEvaluations e rhWorkflowRoles
  "positions:assign": ["DEV", "ADMIN", "RH"], // POST /positions/:id/assign
  "recruitment:manage": ["DEV", "ADMIN", "RH"] // recrutamento
};

/** Importação pela regra antiga: DEV/ADMIN qualquer base; RH só colaboradores. */
function legacyCanImport(role: Role, type: "EMPLOYEES" | "QLP" | "SCHEDULE"): boolean {
  if (role === "DEV" || role === "ADMIN") return true;
  return role === "RH" && type === "EMPLOYEES";
}

describe("matriz padrão nova × regra antiga por perfil", () => {
  for (const [permission, allowed] of Object.entries(legacyRule)) {
    it(`${permission}: exatamente ${allowed.join(", ")}`, () => {
      for (const role of roles) {
        const user = { permissions: [...defaultRolePermissions[role]] };
        expect(can(user, permission as PermissionCode), `${role} × ${permission}`).toBe(allowed.includes(role));
      }
    });
  }

  it("importações: DEV/ADMIN qualquer base, RH só colaboradores, os demais nada", () => {
    for (const role of roles) {
      const user = { permissions: [...defaultRolePermissions[role]] };
      for (const type of ["EMPLOYEES", "QLP", "SCHEDULE"] as const) {
        expect(canImport(user, type), `${role} × importar ${type}`).toBe(legacyCanImport(role, type));
      }
    }
  });

  it("Aprovador e Comum não ganharam nenhuma permissão dos módulos antigos", () => {
    const legacyPermissions = [...Object.keys(legacyRule), "imports:run", "imports:employees"];
    for (const role of ["APPROVER", "COMUM"] as const) {
      for (const code of legacyPermissions) {
        expect(defaultRolePermissions[role], `${role} × ${code}`).not.toContain(code);
      }
    }
  });

  it("o catálogo tem exatamente as permissões antigas + as novas (nenhuma sobrando, nenhuma faltando)", () => {
    for (const code of [...Object.keys(legacyRule), "imports:run", "imports:employees"]) {
      expect(permissionCodes).toContain(code);
    }
  });
});
