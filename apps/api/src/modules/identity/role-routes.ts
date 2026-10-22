import { permissionCatalog, roleLabels, type Role } from "@my-flux/shared";
import { rolePermissionsUpdateSchema, roleSchema } from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../auth/authenticate.js";
import type { UserRepository } from "../users/user-repository.js";
import { requirePermission } from "./authorization.js";
import type { RoleRepository } from "./role-repository.js";

const roleParamsSchema = z.object({ name: roleSchema });

export async function registerRoleRoutes(
  app: FastifyInstance,
  users: UserRepository,
  roles: RoleRepository
): Promise<void> {
  /** Perfis com suas permissões atuais, mais o catálogo para a tela montar a matriz. */
  app.get("/roles", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "permissions:manage");
    return {
      data: {
        roles: (await roles.list()).map((role) => ({ ...role, label: roleLabels[role.name] })),
        catalog: permissionCatalog
      }
    };
  });

  app.put("/roles/:name/permissions", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "permissions:manage");
    const { name } = roleParamsSchema.parse(request.params);
    const body = rolePermissionsUpdateSchema.parse(request.body);
    return {
      data: await roles.setPermissions(user, name as Role, body.permissions, body.justification)
    };
  });
}
