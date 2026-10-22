import {
  availabilityQuerySchema,
  calendarEventInputSchema,
  eventTypeInputSchema,
  idParamsSchema
} from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import { requirePermission } from "../identity/authorization.js";
import type { CalendarRepository } from "./calendar-repository.js";

export async function registerCalendarRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: CalendarRepository
): Promise<void> {
  app.get("/event-types", async () => ({ data: await repository.listEventTypes() }));

  app.post("/event-types", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "leaves:manage");
    return {
      data: await repository.createEventType(user, eventTypeInputSchema.parse(request.body))
    };
  });

  app.delete("/event-types/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "leaves:manage");
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveEventType(user, params.id) };
  });

  app.get("/calendar/events", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listEvents(user) };
  });

  app.post("/calendar/events", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "leaves:manage");
    return {
      data: await repository.createEvent(user, calendarEventInputSchema.parse(request.body))
    };
  });

  app.delete("/calendar/events/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "leaves:manage");
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
