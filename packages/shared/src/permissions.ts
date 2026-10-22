/**
 * Catálogo de permissões e matriz padrão por perfil.
 *
 * Autorização é decidida por PERMISSÃO (`recurso:ação`), não pelo nome do perfil: o título "Desenvolvedor", sozinho,
 * não concede nada. O que cada perfil pode fazer vem das linhas de `RolePermission` no banco, que o administrador
 * edita; a matriz abaixo é só o PONTO DE PARTIDA (migração/seed) e a referência dos testes.
 *
 * Os códigos daqui precisam existir na migração `0016_permissions_and_approver` — há um teste que compara os dois.
 */

export type Role = "DEV" | "ADMIN" | "RH" | "APPROVER" | "COMUM";

/**
 * Hierarquia de delegação (quem pode criar/gerenciar quem). Aprovador e RH ficam no mesmo nível: nenhum dos dois
 * cria o outro. Não é um privilégio por si só — só impede escalada (ninguém cria/edita perfil acima do seu).
 */
export const roleRank: Record<Role, number> = { DEV: 4, ADMIN: 3, RH: 2, APPROVER: 2, COMUM: 1 };

export type RankedRole = Role;

export function isRoleAtLeast(role: RankedRole, minimum: RankedRole): boolean {
  return roleRank[role] >= roleRank[minimum];
}

export const roleLabels: Record<Role, string> = {
  DEV: "Desenvolvedor",
  ADMIN: "Administrador",
  RH: "RH",
  APPROVER: "Aprovador",
  COMUM: "Comum"
};

export type PermissionGroup = "Acesso" | "Cadastros" | "Escalas";

export type PermissionDefinition = {
  code: string;
  label: string;
  description: string;
  group: PermissionGroup;
};

export const permissionCatalog = [
  {
    code: "auth:me",
    label: "Consultar a própria sessão",
    description: "Ver os dados da própria conta e as permissões do perfil.",
    group: "Acesso"
  },
  {
    code: "users:create",
    label: "Criar usuários",
    description: "Cadastrar usuários com perfil abaixo do seu.",
    group: "Acesso"
  },
  {
    code: "users:invite",
    label: "Convidar usuários",
    description: "Enviar convites de acesso a novos usuários.",
    group: "Acesso"
  },
  {
    code: "users:manage",
    label: "Gerenciar usuários",
    description:
      "Listar usuários, ativar/desativar, desbloquear contas e alterar o perfil de um usuário.",
    group: "Acesso"
  },
  {
    code: "permissions:manage",
    label: "Gerenciar permissões dos perfis",
    description: "Definir o que cada perfil pode acessar.",
    group: "Acesso"
  },
  {
    code: "scope:manage",
    label: "Gerenciar escopos de acesso",
    description: "Definir a quais unidades cada usuário tem acesso.",
    group: "Acesso"
  },
  {
    code: "audit:read",
    label: "Consultar a auditoria",
    description: "Ver o registro de operações administrativas e decisões.",
    group: "Acesso"
  },
  {
    code: "employees:manage",
    label: "Gerenciar colaboradores",
    description: "Criar, editar e arquivar colaboradores.",
    group: "Cadastros"
  },
  {
    code: "leaves:manage",
    label: "Gerenciar afastamentos",
    description: "Registrar, alterar e cancelar férias, licenças e atestados.",
    group: "Cadastros"
  },
  {
    code: "substitutions:manage",
    label: "Configurar substituições",
    description: "Definir quem cobre um colaborador durante as férias.",
    group: "Cadastros"
  },
  {
    code: "schedules:read",
    label: "Consultar escalas",
    description: "Ver escalas, versões, pendências e o histórico de decisões.",
    group: "Escalas"
  },
  {
    code: "schedules:generate",
    label: "Gerar escalas",
    description: "Gerar a escala mensal de uma unidade.",
    group: "Escalas"
  },
  {
    code: "schedules:edit",
    label: "Editar escalas",
    description: "Ajustar células e atribuições de uma escala gerada.",
    group: "Escalas"
  },
  {
    code: "schedules:submit",
    label: "Enviar escalas para aprovação",
    description: "Enviar (ou reenviar) uma escala para análise.",
    group: "Escalas"
  },
  {
    code: "schedules:approve",
    label: "Aprovar escalas",
    description: "Aprovar uma escala enviada para análise.",
    group: "Escalas"
  },
  {
    code: "schedules:reject",
    label: "Reprovar escalas",
    description: "Reprovar uma escala, informando o motivo.",
    group: "Escalas"
  },
  {
    code: "schedules:publish",
    label: "Publicar escalas",
    description: "Publicar uma escala já aprovada.",
    group: "Escalas"
  },
  {
    code: "schedules:archive",
    label: "Excluir escalas",
    description: "Remover uma versão de escala da lista (fica registrada no histórico).",
    group: "Escalas"
  }
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof permissionCatalog)[number]["code"];

export const permissionCodes: readonly PermissionCode[] = permissionCatalog.map((p) => p.code);

const byCode = new Map<string, PermissionDefinition>(permissionCatalog.map((p) => [p.code, p]));

export function isPermissionCode(code: string): code is PermissionCode {
  return byCode.has(code);
}

export function permissionLabel(code: string): string {
  return byCode.get(code)?.label ?? code;
}

const allPermissions = [...permissionCodes];

/** Ponto de partida de cada perfil. Depois da migração, o banco é a fonte de verdade (editável pelo administrador). */
export const defaultRolePermissions: Record<Role, readonly PermissionCode[]> = {
  DEV: allPermissions,
  ADMIN: allPermissions,
  RH: [
    "auth:me",
    "users:create",
    "users:invite",
    "employees:manage",
    "leaves:manage",
    "substitutions:manage",
    "schedules:read",
    "schedules:generate",
    "schedules:edit",
    "schedules:submit",
    "schedules:publish",
    "schedules:archive"
  ],
  // O Aprovador só consulta e decide: não edita colaboradores, rodízios, atribuições nem o conteúdo das escalas.
  APPROVER: ["auth:me", "schedules:read", "schedules:approve", "schedules:reject"],
  COMUM: ["auth:me", "schedules:read"]
};

/** Permissões que um perfil nunca pode perder (evita travar o próprio sistema). */
export const protectedPermissions: Record<Role, readonly PermissionCode[]> = {
  DEV: ["auth:me", "users:manage", "permissions:manage"],
  ADMIN: ["auth:me"],
  RH: ["auth:me"],
  APPROVER: ["auth:me"],
  COMUM: ["auth:me"]
};

export function hasPermission(
  permissions: readonly string[] | undefined,
  code: PermissionCode
): boolean {
  return Boolean(permissions?.includes(code));
}

// ── Regras para alterar a matriz de permissões ────────────────────────────────

export type PermissionChangeProblem = {
  code:
    "UNKNOWN_PERMISSION" | "ROLE_NOT_MANAGEABLE" | "CANNOT_GRANT_UNHELD" | "PROTECTED_PERMISSION";
  permission?: string;
  message: string;
};

export type PermissionChangeInput = {
  actorRole: Role;
  actorPermissions: readonly string[];
  targetRole: Role;
  currentPermissions: readonly string[];
  nextPermissions: readonly string[];
};

/** Um perfil só edita perfis abaixo do seu; o topo (DEV) pode editar o próprio, preservando as permissões protegidas. */
export function canEditRolePermissions(actorRole: Role, targetRole: Role): boolean {
  return (
    roleRank[actorRole] > roleRank[targetRole] || (actorRole === "DEV" && targetRole === "DEV")
  );
}

/**
 * Valida uma troca da matriz de permissões de um perfil. Devolve a lista de problemas (vazia = permitido):
 *  - só códigos do catálogo;
 *  - só perfis abaixo do seu (ou o do próprio topo);
 *  - não se concede o que não se possui (sem escalada de privilégio);
 *  - permissões protegidas não saem do perfil.
 */
export function validatePermissionChange(input: PermissionChangeInput): PermissionChangeProblem[] {
  const problems: PermissionChangeProblem[] = [];
  const next = new Set(input.nextPermissions);
  const current = new Set(input.currentPermissions);

  for (const code of next) {
    if (!isPermissionCode(code)) {
      problems.push({
        code: "UNKNOWN_PERMISSION",
        permission: code,
        message: `A permissão “${code}” não existe.`
      });
    }
  }
  if (!canEditRolePermissions(input.actorRole, input.targetRole)) {
    problems.push({
      code: "ROLE_NOT_MANAGEABLE",
      message: `Você não pode alterar as permissões do perfil ${roleLabels[input.targetRole]}.`
    });
  }
  for (const code of next) {
    if (!current.has(code) && isPermissionCode(code) && !input.actorPermissions.includes(code)) {
      problems.push({
        code: "CANNOT_GRANT_UNHELD",
        permission: code,
        message: `Você não pode conceder a permissão “${permissionLabel(code)}” porque ela não faz parte do seu acesso.`
      });
    }
  }
  for (const code of protectedPermissions[input.targetRole]) {
    if (!next.has(code)) {
      problems.push({
        code: "PROTECTED_PERMISSION",
        permission: code,
        message: `A permissão “${permissionLabel(code)}” não pode ser retirada do perfil ${roleLabels[input.targetRole]}.`
      });
    }
  }
  return problems;
}
