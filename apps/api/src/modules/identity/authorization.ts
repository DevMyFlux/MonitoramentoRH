import { permissionLabel, type PermissionCode } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";

/**
 * Autorização por PERMISSÃO. O nome do perfil (inclusive "Desenvolvedor") não concede nada por si só: o que vale é
 * o conjunto de permissões que o banco entrega para a conta (`AuthenticatedUser.permissions`).
 */
export function can(
  user: Pick<AuthenticatedUser, "permissions">,
  permission: PermissionCode
): boolean {
  return Boolean(user.permissions?.includes(permission));
}

export function requirePermission(
  user: Pick<AuthenticatedUser, "permissions">,
  permission: PermissionCode
): void {
  if (can(user, permission)) return;
  throw new HttpError(
    403,
    "PERMISSION_DENIED",
    `Seu perfil não tem a permissão “${permissionLabel(permission)}”.`,
    { permission }
  );
}

/** Acesso a todas as unidades vem de ter um escopo global — não do nome do perfil. */
export function hasGlobalScope(user: Pick<AuthenticatedUser, "scopes">): boolean {
  return user.scopes.some((scope) => scope.isGlobal);
}
