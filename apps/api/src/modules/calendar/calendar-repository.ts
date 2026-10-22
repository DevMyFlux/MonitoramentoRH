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
    // See the matching comment in operational-repository.ts#listJobFunctions: Prisma drops an
    // empty relation filter (what operationScopeWhere returns for DEV/global users) when it is
    // used as an OR branch, instead of treating it as "always true" — that silently hid every
    // event from unrestricted users. Skip the OR entirely for them.
    const unrestricted = user.scopes.some((scope) => scope.isGlobal);
    return this.db.calendarEvent.findMany({
      where: {
        status: "ACTIVE",
        ...(unrestricted
          ? {}
          : {
              OR: [
                { operation: operationScopeWhere(user) },
                { employee: { operation: operationScopeWhere(user) } }
              ]
            })
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

  /** Carrega um afastamento/evento e confere que está dentro do escopo do usuário. */
  private async loadScopedEvent(user: AuthenticatedUser, id: string) {
    const event = await this.db.calendarEvent.findUnique({
      where: { id },
      include: { employee: { include: { operation: true } }, operation: true }
    });
    if (!event) {
      throw new HttpError(404, "EVENT_NOT_FOUND", "Evento nao encontrado.");
    }
    if (event.employee) {
      assertScoped(user, {
        companyId: event.employee.operation.companyId,
        operationId: event.employee.operationId,
        unitId: event.employee.operation.unitId
      });
    }
    if (event.operation) {
      assertScoped(user, {
        companyId: event.operation.companyId,
        operationId: event.operation.id,
        unitId: event.operation.unitId
      });
    }
    return event;
  }

  async archiveEvent(user: AuthenticatedUser, id: string) {
    const before = await this.loadScopedEvent(user, id);

    const updated = await this.db.calendarEvent.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "CalendarEvent", id, before, updated);
    return updated;
  }

  /** Altera título, datas ou observação de um afastamento ativo. O tipo e o colaborador não mudam. */
  async updateEvent(
    user: AuthenticatedUser,
    id: string,
    data: {
      title?: string | undefined;
      startsAt?: string | undefined;
      endsAt?: string | undefined;
      notes?: string | null | undefined;
    }
  ) {
    const before = await this.loadScopedEvent(user, id);
    if (before.status !== "ACTIVE") {
      throw new HttpError(404, "EVENT_NOT_FOUND", "Evento nao encontrado.");
    }
    const startsAt = data.startsAt ? new Date(data.startsAt) : before.startsAt;
    const endsAt = data.endsAt ? new Date(data.endsAt) : before.endsAt;
    if (endsAt < startsAt) {
      throw new HttpError(
        400,
        "EVENT_DATES_INVALID",
        "A data final do afastamento nao pode ser anterior a data inicial."
      );
    }
    const updated = await this.db.calendarEvent.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        startsAt,
        endsAt,
        updatedBy: user.id
      },
      include: { type: true }
    });
    await this.audit(user, "UPDATE", "CalendarEvent", id, before, updated);
    return { before, updated };
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
  if (user.scopes.some((scope) => scope.isGlobal)) {
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
  if (canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Evento fora do escopo permitido.");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
