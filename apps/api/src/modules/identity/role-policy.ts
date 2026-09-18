import type { Role } from "@my-flux/types";
import { roleRank } from "@my-flux/shared";
import { HttpError } from "../../lib/http-error.js";

export function canCreateRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "DEV") {
    return true;
  }

  return roleRank[actorRole] > roleRank[targetRole];
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "DEV") {
    return true;
  }

  return roleRank[actorRole] > roleRank[targetRole];
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
