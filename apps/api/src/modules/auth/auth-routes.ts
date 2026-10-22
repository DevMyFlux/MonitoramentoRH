import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createUserRequestSchema,
  acceptInvitationRequestSchema,
  forgotPasswordRequestSchema,
  invitationRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  resetPasswordRequestSchema
} from "@my-flux/validation";
import { assertDelegatedScopes } from "../identity/access.js";
import { requirePermission } from "../identity/authorization.js";
import type { UserScope } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";
import { assertCanCreateRole } from "../identity/role-policy.js";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
export { authenticateRequest };
import { hashPassword, verifyPassword } from "./password-service.js";
import { createAccessToken, createOpaqueToken, hashToken } from "./token-service.js";

let cachedDummyHash: string | undefined;
/** Hash de uma senha qualquer, calculado uma vez: serve só para gastar o mesmo tempo quando o e-mail não existe. */
function dummyPasswordHash(): string {
  cachedDummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return cachedDummyHash;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  users: UserRepository
): Promise<void> {
  app.post("/auth/login", async (request) => {
    const payload = loginRequestSchema.parse(request.body);
    const candidate = await users.findLoginCandidate(payload.email);

    // Sempre confere uma senha — mesmo sem usuário — para o tempo de resposta não revelar se o e-mail existe.
    const passwordOk = verifyPassword(payload.password, candidate?.user.passwordHash ?? dummyPasswordHash());
    const now = new Date();
    const stillLocked = Boolean(candidate?.lockedUntil && candidate.lockedUntil > now);

    if (!candidate || !passwordOk) {
      // Só conta falha de conta ativa e não bloqueada (a conta bloqueada não tem o bloqueio prorrogado por tentativas).
      if (candidate?.isActive && !stillLocked) await users.registerLoginFailure(candidate.user.id, now);
      throw new HttpError(401, "INVALID_CREDENTIALS", "Credenciais invalidas.");
    }
    // Daqui em diante a senha está correta: já é seguro dizer o que há de errado com a conta.
    if (!candidate.isActive) {
      throw new HttpError(403, "ACCOUNT_DISABLED", "Conta desativada.");
    }
    if (stillLocked && candidate.lockedUntil) {
      const retryAfterSeconds = Math.ceil((candidate.lockedUntil.getTime() - now.getTime()) / 1000);
      throw new HttpError(423, "ACCOUNT_LOCKED", "Conta bloqueada temporariamente.", {
        retryAfterSeconds,
        lockedUntil: candidate.lockedUntil.toISOString()
      });
    }

    const user = candidate.user;
    await users.registerLoginSuccess(user.id);
    const accessToken = createAccessToken(user);
    const refreshToken = createOpaqueToken();
    await users.createRefreshSession(user.id, refreshToken);

    return {
      data: {
        accessToken,
        refreshToken,
        user: withoutPassword(user)
      }
    };
  });

  app.post("/auth/logout", async (request) => {
    const payload = refreshRequestSchema.parse(request.body);
    await users.revokeRefreshSession(payload.refreshToken);

    return { data: { ok: true } };
  });

  app.post("/auth/refresh", async (request) => {
    const payload = refreshRequestSchema.parse(request.body);
    const user = await users.findUserByRefreshToken(payload.refreshToken);

    if (!user) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Sessao invalida.");
    }

    return {
      data: {
        accessToken: createAccessToken(user),
        user
      }
    };
  });

  app.post("/auth/forgot-password", async (request) => {
    const payload = forgotPasswordRequestSchema.parse(request.body);
    const token = createOpaqueToken();
    await users.createPasswordReset(payload.email, hashToken(token));

    return {
      data: {
        ok: true
      }
    };
  });

  app.post("/auth/reset-password", async (request) => {
    const payload = resetPasswordRequestSchema.parse(request.body);
    await users.resetPassword(payload.token, hashPassword(payload.password));

    return { data: { ok: true } };
  });

  app.post("/auth/accept-invitation", async (request) => {
    const payload = acceptInvitationRequestSchema.parse(request.body);
    const user = await users.acceptInvitation(payload.token, hashPassword(payload.password));

    return { data: { user } };
  });

  app.get("/auth/me", async (request) => {
    const currentUser = await authenticateRequest(request, users);

    return { data: { user: currentUser } };
  });

  app.post("/users", async (request) => {
    const actor = await authenticateRequest(request, users);
    requirePermission(actor, "users:create");
    const payload = createUserRequestSchema.parse(request.body);
    assertCanCreateRole(actor.role, payload.role);
    const scopes = normalizeScopeInput(payload.scopes);
    if (payload.role === "DEV" && !scopes.some((scope) => scope.isGlobal)) {
      throw new HttpError(400, "DEV_GLOBAL_SCOPE_REQUIRED", "Todo DEV precisa possuir escopo global.");
    }
    assertDelegatedScopes(actor, scopes);

    const created = await users.createUser({
      email: payload.email,
      name: payload.name,
      passwordHash: hashPassword(payload.password),
      role: payload.role,
      scopes,
      actorId: actor.id
    });

    return { data: { user: created } };
  });

  app.post("/users/invitations", async (request) => {
    const actor = await authenticateRequest(request, users);
    requirePermission(actor, "users:invite");
    const payload = invitationRequestSchema.parse(request.body);
    assertCanCreateRole(actor.role, payload.role);
    assertDelegatedScopes(actor, normalizeScopeInput(payload.scopes));

    const token = createOpaqueToken();
    const invitation = await users.createInvitation({
      email: payload.email,
      name: payload.name,
      role: payload.role,
      scopes: normalizeScopeInput(payload.scopes),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      actorId: actor.id
    });

    return {
      data: {
        invitation,
        inviteToken: token
      }
    };
  });
}

function withoutPassword<TUser extends { passwordHash: string }>(
  user: TUser
): Omit<TUser, "passwordHash"> {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;

  return safeUser;
}

type RawScopeInput = {
  companyId?: string | null | undefined;
  operationId?: string | null | undefined;
  unitId?: string | null | undefined;
  isGlobal: boolean;
};

function normalizeScopeInput(scopes: RawScopeInput[]): UserScope[] {
  return scopes.map((scope) => ({
    companyId: scope.companyId ?? null,
    operationId: scope.operationId ?? null,
    unitId: scope.unitId ?? null,
    isGlobal: scope.isGlobal
  }));
}
