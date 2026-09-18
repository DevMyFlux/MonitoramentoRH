import type { AuthenticatedUser } from "@my-flux/types";
import {
  Prisma,
  type AuditAction,
  type CalendarEventCategory,
  type PrismaClient
} from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";
import { calculateAvailability } from "./availability-service.js";

type EventTypeInput = {
  code: string;
  name: string;
  category: CalendarEventCategory;
  blocksAvailability: boolean;
  requiresApproval: boolean;
};

type CalendarEventInput = {
  typeId: string;
  employeeId?: string | null | undefined;
  operationId?: string | null | undefined;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  notes?: string | null | undefined;
};

export class CalendarRepository {
  constructor(private readonly db: PrismaClient) {}

  async listEventTypes() {
    return this.db.eventType.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" }
    });
  }

  async createEventType(user: AuthenticatedUser, data: EventTypeInput) {
    const created = await this.db.eventType.create({
      data: { ...data, createdBy: user.id }
    });
    await this.audit(user, "CREATE", "EventType", created.id, null, created);
    return created;
  }

  async archiveEventType(user: AuthenticatedUser, id: string) {
    const before = await this.db.eventType.findUniqueOrThrow({ where: { id } });
    const updated = await this.db.eventType.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "EventType", id, before, updated);
    return updated;
  }

  async listEvents(user: AuthenticatedUser) {
    return this.db.calendarEvent.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { operation: operationScopeWhere(user) },
          { employee: { operation: operationScopeWhere(user) } }
        ]
      },
      include: { type: true, employee: true, operation: true },
      orderBy: { startsAt: "asc" }
    });
  }

  async createEvent(user: AuthenticatedUser, data: CalendarEventInput) {
    if (!data.employeeId && !data.operationId) {
      throw new HttpError(
        400,
        "EVENT_SCOPE_REQUIRED",
        "Evento precisa de colaborador ou operacao."
      );
    }
    if (data.employeeId) {
      await this.assertEmployeeScope(user, data.employeeId);
    }
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }

    const created = await this.db.calendarEvent.create({
      data: {
        typeId: data.typeId,
        employeeId: data.employeeId ?? null,
        operationId: data.operationId ?? null,
        title: data.title,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        allDay: data.allDay,
        notes: data.notes ?? null,
        createdBy: user.id
      },
      include: { type: true }
    });
    await this.audit(user, "CREATE", "CalendarEvent", created.id, null, created);
    return created;
  }

  async archiveEvent(user: AuthenticatedUser, id: string) {
    const before = await this.db.calendarEvent.findUnique({
      where: { id },
      include: { employee: { include: { operation: true } }, operation: true }
    });
    if (!before) {
      throw new HttpError(404, "EVENT_NOT_FOUND", "Evento nao encontrado.");
    }
    if (before.employee) {
      assertScoped(user, {
        companyId: before.employee.operation.companyId,
        operationId: before.employee.operationId,
        unitId: before.employee.operation.unitId
      });
    }
    if (before.operation) {
      assertScoped(user, {
        companyId: before.operation.companyId,
        operationId: before.operation.id,
        unitId: before.operation.unitId
      });
    }

    const updated = await this.db.calendarEvent.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "CalendarEvent", id, before, updated);
    return updated;
  }

  async employeeAvailability(
    user: AuthenticatedUser,
    employeeId: string,
    interval: { startsAt: string; endsAt: string }
  ) {
    const employee = await this.db.employee.findUnique({
      where: { id: employeeId },
      include: { operation: true }
    });
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Colaborador nao encontrado.");
    }
    assertScoped(user, {
      companyId: employee.operation.companyId,
      operationId: employee.operationId,
      unitId: employee.operation.unitId
    });

    const startsAt = new Date(interval.startsAt);
    const endsAt = new Date(interval.endsAt);
    const events = await this.db.calendarEvent.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ employeeId }, { operationId: employee.operationId }],
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt }
      },
      include: { type: true }
    });

    return {
      employeeId,
      ...calculateAvailability(events, { startsAt, endsAt })
    };
  }

  private async assertEmployeeScope(user: AuthenticatedUser, employeeId: string) {
    const employee = await this.db.employee.findUnique({
      where: { id: employeeId },
      include: { operation: true }
    });
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Colaborador nao encontrado.");
    }
    assertScoped(user, {
      companyId: employee.operation.companyId,
      operationId: employee.operationId,
      unitId: employee.operation.unitId
    });
  }

  private async assertOperationScope(user: AuthenticatedUser, operationId: string) {
    const operation = await this.db.operation.findUnique({ where: { id: operationId } });
    if (!operation) {
      throw new HttpError(404, "OPERATION_NOT_FOUND", "Operacao nao encontrada.");
    }
    assertScoped(user, { companyId: operation.companyId, operationId, unitId: operation.unitId });
  }

  private async audit(
    user: AuthenticatedUser,
    action: AuditAction,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action,
        entity,
        entityId,
        before: before === null ? Prisma.JsonNull : toJson(before),
        after: toJson(after),
        origin: "api"
      }
    });
  }
}

function operationScopeWhere(user: AuthenticatedUser): Record<string, unknown> {
  if (user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal)) {
    return {};
  }

  return {
    OR: user.scopes.map((scope) => ({
      companyId: scope.companyId ?? undefined,
      id: scope.operationId ?? undefined,
      unitId: scope.unitId ?? undefined
    }))
  };
}

function assertScoped(
  user: AuthenticatedUser,
  resource: { companyId?: string | null; operationId?: string | null; unitId?: string | null }
): void {
  if (user.role === "DEV" || canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Evento fora do escopo permitido.");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
