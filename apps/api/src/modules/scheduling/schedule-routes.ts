import {
  idParamsSchema,
  scheduleEngineInputSchema,
  scheduleTransitionInputSchema,
  scheduleVersionInputSchema
} from "@my-flux/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import type { ScheduleRepository } from "./schedule-repository.js";

export async function registerScheduleRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: ScheduleRepository
): Promise<void> {
  app.get("/schedules", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.list(user) };
  });

  app.post("/schedule/preview", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanPreviewSchedule(user.role);
    const payload = scheduleEngineInputSchema.parse(request.body);
    return { data: await repository.preview(user, payload.operationId, payload) };
  });

  app.post("/schedules", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanPreviewSchedule(user.role);
    scheduleVersionInputSchema.parse(request.body);
    throw new HttpError(409, "SERVER_SNAPSHOT_REQUIRED", "Use /schedules/generate com operação e mês. A aptidão deve ser calculada no servidor.");
  });

  app.patch("/schedules/:id/status", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanPreviewSchedule(user.role);
    const params = idParamsSchema.parse(request.params);
    const payload = scheduleTransitionInputSchema.parse(request.body);
    const updated = await repository.transition(
      user,
      params.id,
      payload.status,
      payload.reason,
      payload.overrideJustification
    );
    return {
      data: {
        id: updated.id,
        operationId: updated.operationId,
        version: updated.version,
        month: updated.month,
        status: updated.status,
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
function assertCanPreviewSchedule(role: string) {
  if (role === "DEV" || role === "ADMIN" || role === "RH") {
    return;
  }

  throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para gerar previa de escala.");
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
