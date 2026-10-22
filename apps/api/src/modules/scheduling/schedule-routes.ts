import {
  idParamsSchema,
  scheduleEngineInputSchema,
  scheduleTransitionInputSchema,
  scheduleVersionInputSchema
} from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import { requirePermission } from "../identity/authorization.js";
import type { ScheduleRepository } from "./schedule-repository.js";

export async function registerScheduleRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: ScheduleRepository
): Promise<void> {
  app.get("/schedules", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "schedules:read");
    return { data: await repository.list(user) };
  });

  /** Histórico de decisões da versão: quem enviou, aprovou, reprovou, publicou e o motivo. */
  app.get("/schedules/:id/history", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "schedules:read");
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.history(user, params.id) };
  });

  app.post("/schedule/preview", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "schedules:generate");
    const payload = scheduleEngineInputSchema.parse(request.body);
    return { data: await repository.preview(user, payload.operationId, payload) };
  });

  app.post("/schedules", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "schedules:generate");
    scheduleVersionInputSchema.parse(request.body);
    throw new HttpError(409, "SERVER_SNAPSHOT_REQUIRED", "Use /schedules/generate com operação e mês. A aptidão deve ser calculada no servidor.");
  });

  app.patch("/schedules/:id/status", async (request) => {
    const user = await authenticateRequest(request, users);
    // Quem pode fazer cada transição (enviar, aprovar, publicar...) é decidido por canTransitionSchedule.
    requirePermission(user, "schedules:read");
    const params = idParamsSchema.parse(request.params);
    const payload = scheduleTransitionInputSchema.parse(request.body);
    const updated = await repository.transition(
      user,
      params.id,
      payload.status,
      payload.reason,
      payload.expectedRevision
    );
    return {
      data: {
        id: updated.id,
        operationId: updated.operationId,
        version: updated.version,
        month: updated.month,
        status: updated.status,
        revision: updated.revision,
        rejectionReason: updated.rejectionReason,
        generatedResult: compactResult(updated.generatedResult)
      }
    };
  });
}

function compactResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const result = value as { metrics?: unknown };
  return { metrics: result.metrics ?? null };
}
