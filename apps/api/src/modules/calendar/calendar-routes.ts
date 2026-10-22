import {
  availabilityQuerySchema,
  calendarEventInputSchema,
  calendarEventUpdateSchema,
  eventTypeInputSchema,
  idParamsSchema
} from "@my-flux/validation";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import { requirePermission } from "../identity/authorization.js";
import { leaveDate } from "../scheduling/substitution-context.js";
import { reconcileLeaveChange } from "../scheduling/substitution-service.js";
import type { CalendarRepository } from "./calendar-repository.js";

export async function registerCalendarRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: CalendarRepository,
  db: PrismaClient
): Promise<void> {
  app.get("/event-types", async (request) => {
    await authenticateRequest(request, users); // dado de referência, mas só para quem está logado
    return { data: await repository.listEventTypes() };
  });

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

  /**
   * Altera as datas (ou título/observação) de um afastamento. Se ele tem substituição, as coberturas são recalculadas
   * e as escalas já geradas são atualizadas; `substitutionSync` na resposta diz o que aconteceu em cada mês.
   */
  app.patch("/calendar/events/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "leaves:manage");
    const params = idParamsSchema.parse(request.params);
    const { applyToLockedSchedules, ...changes } = calendarEventUpdateSchema.parse(request.body);
    const { before, updated } = await repository.updateEvent(user, params.id, changes);
    const range = (event: { startsAt: Date; endsAt: Date }) => ({
      from: leaveDate(event.startsAt),
      to: leaveDate(event.endsAt)
    });
    const moved =
      before.startsAt.getTime() !== updated.startsAt.getTime() ||
      before.endsAt.getTime() !== updated.endsAt.getTime();
    const sync =
      moved && before.employee
        ? await reconcileLeaveChange(
            db,
            user,
            {
              leaveEventId: updated.id,
              operationId: before.employee.operationId,
              titularId: before.employee.id,
              before: range(before),
              after: range(updated)
            },
            {
              applyToLockedSchedules,
              onError: (error) => request.log.error({ err: error }, "substitution sync failed")
            }
          )
        : null;
    return {
      data: { ...updated, ...(sync?.substitutions.length ? { substitutionSync: sync } : {}) }
    };
  });

  app.delete("/calendar/events/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "leaves:manage");
    const params = idParamsSchema.parse(request.params);
    const { applyToLockedSchedules } = z
      .object({ applyToLockedSchedules: z.enum(["true", "false"]).optional() })
      .parse(request.query);
    const archived = await repository.archiveEvent(user, params.id);
    // Cancelar o afastamento encerra as substituições dele e desfaz as coberturas nas escalas.
    const employee = archived.employeeId
      ? await db.employee.findUnique({
          where: { id: archived.employeeId },
          select: { id: true, operationId: true }
        })
      : null;
    const sync = employee
      ? await reconcileLeaveChange(
          db,
          user,
          {
            leaveEventId: archived.id,
            operationId: employee.operationId,
            titularId: employee.id,
            before: { from: leaveDate(archived.startsAt), to: leaveDate(archived.endsAt) },
            after: null
          },
          {
            applyToLockedSchedules: applyToLockedSchedules === "true",
            onError: (error) => request.log.error({ err: error }, "substitution sync failed")
          }
        )
      : null;
    return {
      data: { ...archived, ...(sync?.substitutions.length ? { substitutionSync: sync } : {}) }
    };
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
