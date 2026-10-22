import { useSyncExternalStore } from "react";
import { roleLabels, type PermissionCode, type Role } from "@my-flux/shared";

/**
 * Quem está logado e o que o perfil dele pode fazer, como a API informou em /auth/me.
 *
 * Serve para a interface mostrar ou esconder botões e menus. NÃO é segurança: a API valida a permissão de cada
 * operação no servidor, então um botão escondido (ou um usuário que chame a API direto) continua barrado lá.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
};

let current: SessionUser | null = null;
const listeners = new Set<() => void>();

export function setSessionUser(user: SessionUser | null): void {
  current = user;
  for (const listener of listeners) listener();
}

export function getSessionUser(): SessionUser | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function userCan(
  user: Pick<SessionUser, "permissions"> | null,
  permission: PermissionCode
): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(subscribe, getSessionUser, getSessionUser);
}

/** `can("schedules:approve")` — falso enquanto a sessão ainda está carregando. */
export function usePermissions(): {
  user: SessionUser | null;
  can: (permission: PermissionCode) => boolean;
  roleLabel: string;
} {
  const user = useSessionUser();
  return {
    user,
    can: (permission) => userCan(user, permission),
    roleLabel: user ? roleLabels[user.role] : ""
  };
}
