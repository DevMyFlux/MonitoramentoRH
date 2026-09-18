import type { AuthenticatedUser, Role, UserScope } from "@my-flux/types";
import type { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { hashToken } from "../auth/token-service.js";

const userSelect = {
  id: true,
  isActive: true,
  status: true,
  email: true,
  name: true,
  passwordHash: true,
  role: {
    select: {
      id: true,
      name: true
    }
  },
  scopes: {
    where: {
      status: "ACTIVE"
    },
    select: {
      companyId: true,
      operationId: true,
      unitId: true,
      isGlobal: true
    }
  }
} satisfies Prisma.UserSelect;

type UserWithAuth = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export type CreateUserData = {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  scopes: UserScope[];
  actorId: string;
};

export type CreateInvitationData = {
  email: string;
  name: string;
  role: Role;
  scopes: UserScope[];
  tokenHash: string;
  expiresAt: Date;
  actorId: string;
};

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByEmail(email: string): Promise<(AuthenticatedUser & { passwordHash: string }) | null> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: userSelect
    });

    return user?.isActive && user.status === "ACTIVE" ? mapUserWithPassword(user) : null;
  }

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.db.user.findUnique({
      where: { id },
      select: userSelect
    });

    return user?.isActive && user.status === "ACTIVE" ? mapAuthenticatedUser(user) : null;
  }

  async createUser(data: CreateUserData): Promise<AuthenticatedUser> {
    const role = await this.db.role.findUnique({
      where: { name: data.role }
    });

    if (!role) {
      throw new HttpError(500, "ROLE_NOT_CONFIGURED", "Perfil nao configurado.");
    }

    const created = await this.db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        roleId: role.id,
        createdBy: data.actorId,
        scopes: {
          create: data.scopes.map((scope) => ({
            companyId: scope.companyId,
            operationId: scope.operationId,
            unitId: scope.unitId,
            isGlobal: scope.isGlobal,
            createdBy: data.actorId
          }))
        }
      },
      select: userSelect
    });

    await this.db.auditLog.create({
      data: {
        userId: data.actorId,
        action: "CREATE",
        entity: "User",
        entityId: created.id,
        after: {
          email: created.email,
          role: created.role.name
        },
        origin: "api"
      }
    });

    return mapAuthenticatedUser(created);
  }

  async createInvitation(data: CreateInvitationData): Promise<{ id: string; email: string }> {
    const role = await this.db.role.findUnique({
      where: { name: data.role }
    });

    if (!role) {
      throw new HttpError(500, "ROLE_NOT_CONFIGURED", "Perfil nao configurado.");
    }

    const invitation = await this.db.userInvitation.create({
      data: {
        email: data.email,
        name: data.name,
        roleId: role.id,
        scopes: normalizeScopes(data.scopes) as Prisma.InputJsonValue,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        createdById: data.actorId
      },
      select: {
        id: true,
        email: true
      }
    });

    await this.db.auditLog.create({
      data: {
        userId: data.actorId,
        action: "USER_INVITE",
        entity: "UserInvitation",
        entityId: invitation.id,
        after: {
          email: data.email,
          role: data.role
        },
        origin: "api"
      }
    });

    return invitation;
  }

  async createRefreshSession(userId: string, refreshToken: string): Promise<void> {
    await this.db.refreshSession.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });
  }

  async revokeRefreshSession(refreshToken: string): Promise<void> {
    await this.db.refreshSession.updateMany({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        status: "ARCHIVED"
      }
    });
  }

  async findUserByRefreshToken(refreshToken: string): Promise<AuthenticatedUser | null> {
    const session = await this.db.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: {
        expiresAt: true,
        revokedAt: true,
        user: {
          select: userSelect
        }
      }
    });

    if (!session || !session.user.isActive || session.user.status !== "ACTIVE" || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    return mapAuthenticatedUser(session.user);
  }

  async createPasswordReset(email: string, tokenHashValue: string): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (!user) {
      return;
    }

    await this.db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHashValue,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30)
      }
    });
  }

  async resetPassword(token: string, passwordHash: string): Promise<void> {
    const tokenHashValue = hashToken(token);
    const resetToken = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: tokenHashValue },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true
      }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new HttpError(400, "INVALID_RESET_TOKEN", "Token de redefinicao invalido.");
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      this.db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date(), status: "ARCHIVED" }
      })
    ]);
  }

  async acceptInvitation(token: string, passwordHash: string): Promise<AuthenticatedUser> {
    const tokenHashValue = hashToken(token);
    const invitation = await this.db.userInvitation.findUnique({
      where: { tokenHash: tokenHashValue },
      select: {
        id: true,
        email: true,
        name: true,
        scopes: true,
        acceptedAt: true,
        expiresAt: true,
        createdById: true,
        role: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
      throw new HttpError(400, "INVALID_INVITATION", "Convite invalido.");
    }

    const scopes = parseScopes(invitation.scopes);

    const [created] = await this.db.$transaction([
      this.db.user.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          passwordHash,
          roleId: invitation.role.id,
          createdBy: invitation.createdById,
          scopes: {
            create: scopes.map((scope) => ({
              companyId: scope.companyId,
              operationId: scope.operationId,
              unitId: scope.unitId,
              isGlobal: scope.isGlobal,
              createdBy: invitation.createdById
            }))
          }
        },
        select: userSelect
      }),
      this.db.userInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
          status: "ARCHIVED"
        }
      })
    ]);

    return mapAuthenticatedUser(created);
  }
}

function mapUserWithPassword(user: UserWithAuth): AuthenticatedUser & { passwordHash: string } {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    role: user.role.name,
    scopes: user.scopes
  };
}

function mapAuthenticatedUser(user: UserWithAuth): AuthenticatedUser {
  const userWithPassword = mapUserWithPassword(user);
  const { passwordHash, ...safeUser } = userWithPassword;
  void passwordHash;

  return safeUser;
}

function parseScopes(value: Prisma.JsonValue): UserScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonRecord).map((scope) => ({
    companyId: typeof scope.companyId === "string" ? scope.companyId : null,
    operationId: typeof scope.operationId === "string" ? scope.operationId : null,
    unitId: typeof scope.unitId === "string" ? scope.unitId : null,
    isGlobal: scope.isGlobal === true
  }));
}

function normalizeScopes(scopes: UserScope[]): Array<Record<string, string | boolean | null>> {
  return scopes.map((scope) => ({
    companyId: scope.companyId ?? null,
    operationId: scope.operationId ?? null,
    unitId: scope.unitId ?? null,
    isGlobal: scope.isGlobal
  }));
}

function isJsonRecord(value: Prisma.JsonValue): value is Record<string, Prisma.JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
