import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type AuditAction, type PrismaClient, type WorkflowStatus } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";
import { generateSchedule, type ScheduleEngineInput } from "./schedule-engine.js";
import { canTransitionSchedule } from "./schedule-workflow.js";

type ScheduleVersionInput = {
  operationId: string;
  month: string;
  engineInput: ScheduleEngineInput;
  overrideJustification?: string | null | undefined;
};

export class ScheduleRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(user: AuthenticatedUser) {
    return this.db.scheduleVersion.findMany({
      // archivedAt is how an "Excluir escala" is recorded (see
      // employee-schedule-routes.ts): the row and its history stay for audit,
      // but a deleted schedule must disappear from every listing.
      where: { archivedAt: null, operation: operationScopeWhere(user) },
      include: { assignments: true },
      orderBy: [{ month: "desc" }, { version: "desc" }]
    });
  }

  async preview(user: AuthenticatedUser, operationId: string, input: ScheduleEngineInput) {
    await this.assertOperationScope(user, operationId);

    return generateSchedule(input);
  }

  async createVersion(user: AuthenticatedUser, data: ScheduleVersionInput) {
    await this.assertOperationScope(user, data.operationId);
    const month = new Date(data.month);
    const result = generateSchedule(data.engineInput);
    const last = await this.db.scheduleVersion.findFirst({
      where: { operationId: data.operationId, month },
      orderBy: { version: "desc" },
      select: { version: true }
    });

    const created = await this.db.scheduleVersion.create({
      data: {
        operationId: data.operationId,
        month,
        version: (last?.version ?? 0) + 1,
        generatedInput: toJson(data.engineInput),
        generatedResult: toJson(result),
        overrideJustification: data.overrideJustification ?? null,
        createdBy: user.id,
        assignments: {
          create: result.assignments.map((assignment) => ({
            positionId: assignment.positionId,
            employeeId: assignment.employeeId,
            createdBy: user.id
          }))
        },
        history: {
          create: {
            action: "CREATE",
            after: toJson(result),
            reason: data.overrideJustification ?? null,
            createdBy: user.id
          }
        }
      },
      include: { assignments: true, history: true }
    });

    await this.audit(user, "CREATE", "ScheduleVersion", created.id, null, created);
    return created;
  }

  async transition(
    user: AuthenticatedUser,
    id: string,
    status: WorkflowStatus,
    reason?: string | null,
    overrideJustification?: string | null
  ) {
    const before = await this.db.scheduleVersion.findUnique({
      where: { id },
      include: { operation: true }
    });
    if (!before || before.archivedAt) {
      throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versao de escala nao encontrada.");
    }
    assertScoped(user, {
      companyId: before.operation.companyId,
      operationId: before.operationId,
      unitId: before.operation.unitId
    });

    const hasOverride = Boolean(overrideJustification);
    if (!canTransitionSchedule(before.status, status, user.role, hasOverride)) {
      throw new HttpError(403, "SCHEDULE_WORKFLOW_FORBIDDEN", "Transicao de escala nao permitida.");
    }

    const updateData: Prisma.ScheduleVersionUpdateInput = {
      status,
      updatedBy: user.id,
      history: {
        create: {
          action: status,
          before: toJson(before),
          after: toJson({ status }),
          reason: overrideJustification ?? reason ?? null,
          createdBy: user.id
        }
      }
    };
    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = user.id;
    }
    if (status === "PUBLISHED") {
      updateData.publishedAt = new Date();
      updateData.publishedBy = user.id;
    }
    if (overrideJustification) {
      updateData.overrideJustification = overrideJustification;
    }
    if (status === "ARCHIVED") {
      updateData.archivedAt = new Date();
    }

    const updated = await this.db.scheduleVersion.update({
      where: { id },
      data: updateData,
      include: { assignments: true, history: true }
    });
    await this.audit(
      user,
      status === "APPROVED" ? "APPROVE" : "UPDATE",
      "ScheduleVersion",
      id,
      before,
      updated
    );
    return updated;
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

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Escala fora do escopo permitido.");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
