import { idParamsSchema, userRoleChangeSchema } from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../auth/authenticate.js";
import { requirePermission } from "../identity/authorization.js";
import type { UserAdminRepository } from "./user-admin-repository.js";
import type { UserRepository } from "./user-repository.js";

const statusSchema = z.object({ isActive: z.boolean() });

export async function registerUserAdminRoutes(
  app: FastifyInstance,
  users: UserRepository,
  admin: UserAdminRepository
): Promise<void> {
  app.get("/users", async (request) => {
    const actor = await authenticateRequest(request, users);
    requirePermission(actor, "users:manage");
    return { data: await admin.list(actor) };
  });

  app.patch("/users/:id/status", async (request) => {
    const actor = await authenticateRequest(request, users);
    requirePermission(actor, "users:manage");
    const { id } = idParamsSchema.parse(request.params);
    const { isActive } = statusSchema.parse(request.body);
    return { data: await admin.setActive(actor, id, isActive) };
  });

  app.patch("/users/:id/role", async (request) => {
    const actor = await authenticateRequest(request, users);
    requirePermission(actor, "users:manage");
    const { id } = idParamsSchema.parse(request.params);
    const body = userRoleChangeSchema.parse(request.body);
    return { data: await admin.changeRole(actor, id, body.role, body.justification) };
  });

  app.post("/users/:id/unlock", async (request) => {
    const actor = await authenticateRequest(request, users);
    requirePermission(actor, "users:manage");
    const { id } = idParamsSchema.parse(request.params);
    return { data: await admin.unlock(actor, id) };
  });
}
