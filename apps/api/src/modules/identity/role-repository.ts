import { validatePermissionChange, type Role } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";

export type RoleSummary = {
  name: Role;
  level: number;
  description: string;
  permissions: string[];
  activeUsers: number;
};

/** Matriz de permissões por perfil (o que cada perfil pode acessar). Só quem tem `permissions:manage` chega aqui. */
export class RoleRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<RoleSummary[]> {
    const roles = await this.db.role.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ level: "desc" }, { name: "asc" }],
      select: {
        name: true,
        level: true,
        description: true,
        permissions: {
          where: { permission: { status: "ACTIVE" } },
          select: { permission: { select: { code: true } } }
        },
        _count: { select: { users: { where: { isActive: true, status: "ACTIVE" } } } }
      }
    });
    return roles.map((role) => ({
      name: role.name,
      level: role.level,
      description: role.description,
      permissions: role.permissions.map((entry) => entry.permission.code).sort(),
      activeUsers: role._count.users
    }));
  }

  /**
   * Substitui as permissões de um perfil. As regras (só perfis abaixo do seu, não conceder o que não possui, não retirar
   * o que é protegido) estão em `validatePermissionChange` e valem aqui, no servidor — esconder o botão não basta.
   */
  async setPermissions(
    actor: AuthenticatedUser,
    roleName: Role,
    nextPermissions: string[],
    justification?: string | null
  ): Promise<RoleSummary> {
    const next = [...new Set(nextPermissions)].sort();

    await this.db.$transaction(
      async (tx) => {
        const role = await tx.role.findUnique({
          where: { name: roleName },
          select: {
            id: true,
            permissions: { select: { permission: { select: { id: true, code: true } } } }
          }
        });
        if (!role) throw new HttpError(404, "ROLE_NOT_FOUND", "Perfil não encontrado.");

        const current = role.permissions.map((entry) => entry.permission.code).sort();
        const problems = validatePermissionChange({
          actorRole: actor.role,
          actorPermissions: actor.permissions,
          targetRole: roleName,
          currentPermissions: current,
          nextPermissions: next
        });
        if (problems.length) {
          throw new HttpError(
            403,
            "PERMISSION_CHANGE_FORBIDDEN",
            problems.map((problem) => problem.message).join(" "),
            { problems }
          );
        }

        const currentSet = new Set(current);
        const nextSet = new Set(next);
        const toRemove = role.permissions
          .filter((entry) => !nextSet.has(entry.permission.code))
          .map((entry) => entry.permission.id);
        const toAdd = next.filter((code) => !currentSet.has(code));

        if (toRemove.length) {
          await tx.rolePermission.deleteMany({
            where: { roleId: role.id, permissionId: { in: toRemove } }
          });
        }
        if (toAdd.length) {
          const permissions = await tx.permission.findMany({
            where: { code: { in: toAdd }, status: "ACTIVE" },
            select: { id: true }
          });
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              roleId: role.id,
              permissionId: permission.id
            })),
            skipDuplicates: true
          });
        }
        if (toRemove.length || toAdd.length) {
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              userRole: actor.role,
              action: "PERMISSION_CHANGE",
              entity: "Role",
              entityId: role.id,
              before: { role: roleName, permissions: current },
              after: { role: roleName, permissions: next },
              justification: justification ?? null,
              origin: "api"
            }
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const updated = (await this.list()).find((role) => role.name === roleName);
    if (!updated) throw new HttpError(404, "ROLE_NOT_FOUND", "Perfil não encontrado.");
    return updated;
  }
}
