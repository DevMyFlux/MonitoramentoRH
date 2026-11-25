import type { Role } from "@my-flux/types";
import { perfilGerencia } from "@my-flux/shared";
import { HttpError } from "../../lib/http-error.js";

// A regra mora em packages/shared (acessos.ts, perfilGerencia): DEV gerencia qualquer perfil, ADMIN só
// RH e COMUM, RH só COMUM. Aqui só se traduz para os nomes que as rotas já usam.
export function canCreateRole(actorRole: Role, targetRole: Role): boolean {
  return perfilGerencia(actorRole, targetRole);
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return perfilGerencia(actorRole, targetRole);
}

export function assertCanCreateRole(actorRole: Role, targetRole: Role): void {
  if (!canCreateRole(actorRole, targetRole)) {
    throw new HttpError(
      403,
      "ROLE_ELEVATION_FORBIDDEN",
      "Não é permitido criar um perfil de nível igual ou superior ao seu."
    );
  }
}

export function canDisableUser(targetRole: Role, activeDevCount: number): boolean {
  if (targetRole === "DEV" && activeDevCount <= 1) {
    return false;
  }

  return true;
}
