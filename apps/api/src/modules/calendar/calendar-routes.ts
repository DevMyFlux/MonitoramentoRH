import {
  availabilityQuerySchema,
  calendarEventInputSchema,
  eventTypeInputSchema,
  idParamsSchema
} from "@my-flux/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import type { CalendarRepository } from "./calendar-repository.js";

export async function registerCalendarRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: CalendarRepository
): Promise<void> {
  app.get("/event-types", async () => ({ data: await repository.listEventTypes() }));

  app.post("/event-types", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageCalendar(user.role);
    return {
      data: await repository.createEventType(user, eventTypeInputSchema.parse(request.body))
    };
  });

  app.delete("/event-types/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageCalendar(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveEventType(user, params.id) };
  });

  app.get("/calendar/events", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listEvents(user) };
  });

  app.post("/calendar/events", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageCalendar(user.role);
    return {
      data: await repository.createEvent(user, calendarEventInputSchema.parse(request.body))
    };
  });

  app.delete("/calendar/events/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageCalendar(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveEvent(user, params.id) };
  });

  app.get("/availability", async (request) => {
    const user = await authenticateRequest(request, users);
    const query = availabilityQuerySchema.parse(request.query);
    return {
      data: await repository.employeeAvailability(user, query.employeeId, {
        startsAt: query.startsAt,
        endsAt: query.endsAt
      })
    };
  });
}

function assertCanManageCalendar(role: string) {
  if (role === "DEV" || role === "ADMIN" || role === "RH") {
    return;
  }

  throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para gerenciar calendario.");
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
