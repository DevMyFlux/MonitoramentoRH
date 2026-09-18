import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import type { AuditRepository } from "./audit-repository.js";

const auditQuerySchema = z.object({
  entity: z.string().optional(),
  action: z
    .enum([
      "CREATE",
      "UPDATE",
      "ARCHIVE",
      "RESTORE",
      "APPROVE",
      "REJECT",
      "PUBLISH",
      "UNPUBLISH",
      "OVERRIDE",
      "ROLE_CHANGE",
      "PERMISSION_CHANGE",
      "USER_INVITE",
      "USER_DISABLE"
    ])
    .optional(),
  q: z.string().optional()
});

export async function registerAuditRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: AuditRepository
): Promise<void> {
  app.get("/audit/logs", async (request) => {
    const user = await authenticateRequest(request, users);
    if (user.role !== "DEV" && user.role !== "ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para consultar auditoria.");
    }
    return { data: await repository.list(auditQuerySchema.parse(request.query)) };
  });
}

async function authenticateRequest(request: FastifyRequest, users: UserRepository) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Autenticacao obrigatoria.");
  }

  const payload = verifyAccessToken(authorization.slice("Bearer ".length));

  if (!payload) {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Token invalido.");
  }

  const user = await users.findById(payload.sub);

  if (!user) {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Usuario da sessao nao encontrado.");
  }

  return user;
}
