import {
  idParamsSchema,
  substitutionApplySchema,
  substitutionCancelSchema,
  substitutionCreateSchema,
  substitutionQuerySchema,
  substitutionUpdateSchema
} from "@my-flux/validation";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import { requirePermission } from "../identity/authorization.js";
import {
  applySubstitution,
  cancelSubstitution,
  createSubstitution,
  listSubstitutions,
  updateSubstitution
} from "./substitution-service.js";

/**
 * Substituição temporária durante afastamentos. Ler exige `schedules:read` (o Aprovador também vê quem cobre quem);
 * configurar, alterar, cancelar e aplicar exigem `substitutions:manage`. Tudo é conferido aqui, no servidor.
 */
export async function registerSubstitutionRoutes(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
): Promise<void> {
  app.get("/substitutions", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "schedules:read");
    const filter = substitutionQuerySchema.parse(request.query);
    return { data: await listSubstitutions(db, user, filter) };
  });

  /** `dryRun: true` só devolve o plano (o que seria coberto e os conflitos), sem gravar. */
  app.post("/substitutions", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "substitutions:manage");
    const input = substitutionCreateSchema.parse(request.body);
    return {
      data: await createSubstitution(db, user, input, {
        onError: (error) => request.log.error({ err: error }, "substitution sync failed")
      })
    };
  });

  app.patch("/substitutions/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "substitutions:manage");
    const { id } = idParamsSchema.parse(request.params);
    const input = substitutionUpdateSchema.parse(request.body);
    return {
      data: await updateSubstitution(db, user, id, input, {
        onError: (error) => request.log.error({ err: error }, "substitution sync failed")
      })
    };
  });

  app.post("/substitutions/:id/cancel", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "substitutions:manage");
    const { id } = idParamsSchema.parse(request.params);
    const input = substitutionCancelSchema.parse(request.body);
    return {
      data: await cancelSubstitution(db, user, id, input, {
        onError: (error) => request.log.error({ err: error }, "substitution sync failed")
      })
    };
  });

  /** Reaplica a configuração às escalas (idempotente). É também como se confirma criar nova versão nas escalas bloqueadas. */
  app.post("/substitutions/:id/apply", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "substitutions:manage");
    const { id } = idParamsSchema.parse(request.params);
    const input = substitutionApplySchema.parse(request.body ?? {});
    return {
      data: await applySubstitution(db, user, id, input, {
        onError: (error) => request.log.error({ err: error }, "substitution sync failed")
      })
    };
  });
}
