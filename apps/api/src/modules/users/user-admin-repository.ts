import { roleLabels, type Role } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { hasGlobalScope } from "../identity/authorization.js";
import { assertCanCreateRole, canManageRole } from "../identity/role-policy.js";

const forbidden = () => new HttpError(403, "FORBIDDEN", "Não é permitido gerenciar este usuário.");

/**
 * Gestão de contas por quem tem `users:manage`. Além da permissão, valem as regras de hierarquia (ninguém gerencia
 * um perfil acima do seu) e de escopo (quem não tem acesso global só gerencia o que criou).
 */
export class UserAdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(actor: AuthenticatedUser, now: Date = new Date()) {
    const rows = await this.db.user.findMany({
      where: hasGlobalScope(actor) ? {} : { createdBy: actor.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        role: { select: { name: true } },
        scopes: { select: { companyId: true, operationId: true, unitId: true, isGlobal: true } }
      },
      orderBy: { name: "asc" }
    });
    return rows.map((row) => ({
      ...row,
      isLocked: Boolean(row.lockedUntil && row.lockedUntil > now)
    }));
  }

  async setActive(actor: AuthenticatedUser, id: string, isActive: boolean) {
    return this.db.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id }, include: { role: true } });
        if (!target) throw new HttpError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
        if (!isActive && target.id === actor.id) {
          throw new HttpError(
            409,
            "CANNOT_DISABLE_SELF",
            "Você não pode desativar a própria conta."
          );
        }
        this.assertCanManage(actor, target);
        if (
          !isActive &&
          target.role.name === "DEV" &&
          (await tx.user.count({ where: { isActive: true, role: { name: "DEV" } } })) <= 1
        ) {
          throw new HttpError(409, "LAST_DEV", "O último DEV ativo deve ser preservado.");
        }
        await tx.user.update({ where: { id }, data: { isActive, updatedBy: actor.id } });
        await tx.refreshSession.updateMany({
          where: { userId: id },
          data: { revokedAt: new Date(), status: "ARCHIVED" }
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            userRole: actor.role,
            action: "USER_DISABLE",
            entity: "User",
            entityId: id,
            after: { isActive },
            origin: "api"
          }
        });
        return { id, isActive };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /** Troca o perfil de um usuário. Revoga as sessões abertas: a pessoa entra de novo já com o perfil novo. */
  async changeRole(
    actor: AuthenticatedUser,
    id: string,
    role: Role,
    justification?: string | null
  ) {
    return this.db.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          include: { role: true, scopes: { where: { status: "ACTIVE" } } }
        });
        if (!target) throw new HttpError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
        if (target.id === actor.id) {
          throw new HttpError(
            409,
            "CANNOT_CHANGE_OWN_ROLE",
            "Você não pode alterar o próprio perfil."
          );
        }
        this.assertCanManage(actor, target);
        assertCanCreateRole(actor.role, role); // não se atribui um perfil igual ou acima do seu
        const before = target.role.name;
        if (before === role) return { id, role, changed: false };

        if (
          before === "DEV" &&
          (await tx.user.count({ where: { isActive: true, role: { name: "DEV" } } })) <= 1
        ) {
          throw new HttpError(409, "LAST_DEV", "O último DEV ativo deve ser preservado.");
        }
        const newRole = await tx.role.findUnique({ where: { name: role } });
        if (!newRole) throw new HttpError(500, "ROLE_NOT_CONFIGURED", "Perfil nao configurado.");

        await tx.user.update({ where: { id }, data: { roleId: newRole.id, updatedBy: actor.id } });
        // Todo DEV precisa de acesso global (regra de criação); ao promover, garante o escopo.
        if (role === "DEV" && !target.scopes.some((scope) => scope.isGlobal)) {
          await tx.userScope.create({ data: { userId: id, isGlobal: true, createdBy: actor.id } });
        }
        await tx.refreshSession.updateMany({
          where: { userId: id },
          data: { revokedAt: new Date(), status: "ARCHIVED" }
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            userRole: actor.role,
            action: "ROLE_CHANGE",
            entity: "User",
            entityId: id,
            before: { role: before },
            after: { role },
            justification: justification ?? null,
            origin: "api"
          }
        });
        return { id, role, changed: true, previousRole: before, label: roleLabels[role] };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async unlock(actor: AuthenticatedUser, id: string) {
    return this.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, include: { role: true } });
      if (!target) throw new HttpError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
      this.assertCanManage(actor, target);
      await tx.user.update({
        where: { id },
        data: { lockedUntil: null, failedLoginAttempts: 0, updatedBy: actor.id }
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userRole: actor.role,
          action: "UPDATE",
          entity: "User",
          entityId: id,
          after: { lockedUntil: null },
          justification: "Conta desbloqueada por um administrador.",
          origin: "api"
        }
      });
      return { id, unlocked: true };
    });
  }

  private assertCanManage(
    actor: AuthenticatedUser,
    target: { createdBy: string | null; role: { name: Role } }
  ): void {
    if (!canManageRole(actor.role, target.role.name)) throw forbidden();
    if (!hasGlobalScope(actor) && target.createdBy !== actor.id) throw forbidden();
  }
}
