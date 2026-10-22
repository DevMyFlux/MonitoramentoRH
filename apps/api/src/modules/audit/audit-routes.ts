import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import { requirePermission } from "../identity/authorization.js";
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
    requirePermission(user, "audit:read");
    return { data: await repository.list(auditQuerySchema.parse(request.query)) };
  });
}
