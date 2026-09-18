import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type EmployeeStatus, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";

type EmployeeInput = {
  operationId: string;
  functionId?: string | null | undefined;
  name: string;
  identifier: string;
  employmentType?: string | null | undefined;
  jobTitle?: string | null | undefined;
  admissionDate?: string | null | undefined;
  status: EmployeeStatus;
  workRegime?: string | null | undefined;
  shift?: string | null | undefined;
  team?: string | null | undefined;
  notes?: string | null | undefined;
};

type UpdateEmployeeInput = {
  operationId?: string | undefined;
  functionId?: string | null | undefined;
  name?: string | undefined;
  identifier?: string | undefined;
  employmentType?: string | null | undefined;
  jobTitle?: string | null | undefined;
  admissionDate?: string | null | undefined;
  status?: EmployeeStatus | undefined;
  workRegime?: string | null | undefined;
  shift?: string | null | undefined;
  team?: string | null | undefined;
  notes?: string | null | undefined;
};

export class EmployeeRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(user: AuthenticatedUser) {
    return this.db.employee.findMany({
      where: {
        recordStatus: "ACTIVE",
        operation: operationScopeWhere(user)
      },
      include: {
        operation: { select: { id: true, name: true, companyId: true, unitId: true } },
        function: { select: { id: true, name: true } }
      },
      orderBy: { name: "asc" }
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    const employee = await this.db.employee.findUnique({
      where: { id },
      include: {
        operation: { select: { id: true, name: true, companyId: true, unitId: true } },
        function: { select: { id: true, name: true } },
        history: { orderBy: { createdAt: "desc" } },
        assignments: { orderBy: { startsAt: "desc" } }
      }
    });

    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Colaborador nao encontrado.");
    }

    assertScoped(user, {
      companyId: employee.operation.companyId,
      operationId: employee.operationId,
      unitId: employee.operation.unitId
    });

    return employee;
  }

  async create(user: AuthenticatedUser, data: EmployeeInput) {
    await this.assertOperationScope(user, data.operationId);
    const created = await this.db.employee.create({
      data: {
        operationId: data.operationId,
        functionId: data.functionId ?? null,
        name: data.name,
        identifier: data.identifier,
        employmentType: data.employmentType ?? null,
        jobTitle: data.jobTitle ?? null,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : null,
        status: data.status,
        workRegime: data.workRegime ?? null,
        shift: data.shift ?? null,
        team: data.team ?? null,
        notes: data.notes ?? null,
        createdBy: user.id,
        history: {
          create: {
            action: "CREATE",
            after: toJson(data),
            createdBy: user.id
          }
        }
      }
    });

    await this.audit(user, "CREATE", created.id, null, created);
    return created;
  }

  async update(user: AuthenticatedUser, id: string, data: UpdateEmployeeInput) {
    const before = await this.get(user, id);
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }

    const updateData: Prisma.EmployeeUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "operationId", data.operationId);
    applyDefined(updateData, "functionId", data.functionId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "identifier", data.identifier);
    applyDefined(updateData, "employmentType", data.employmentType);
    applyDefined(updateData, "jobTitle", data.jobTitle);
    applyDefined(
      updateData,
      "admissionDate",
      data.admissionDate ? new Date(data.admissionDate) : data.admissionDate
    );
    applyDefined(updateData, "status", data.status);
    applyDefined(updateData, "workRegime", data.workRegime);
    applyDefined(updateData, "shift", data.shift);
    applyDefined(updateData, "team", data.team);
    applyDefined(updateData, "notes", data.notes);

    const updated = await this.db.employee.update({
      where: { id },
      data: {
        ...updateData,
        history: {
          create: {
            action: "UPDATE",
            before: toJson(before),
            after: toJson(data),
            createdBy: user.id
          }
        }
      }
    });

    await this.audit(user, "UPDATE", id, before, updated);
    return updated;
  }

  async archive(user: AuthenticatedUser, id: string) {
    const before = await this.get(user, id);
    const updated = await this.db.employee.update({
      where: { id },
      data: {
        recordStatus: "ARCHIVED",
        archivedAt: new Date(),
        updatedBy: user.id,
        history: {
          create: {
            action: "ARCHIVE",
            before: toJson(before),
            createdBy: user.id
          }
        }
      }
    });
    await this.audit(user, "ARCHIVE", id, before, updated);
    return updated;
  }

  private async assertOperationScope(user: AuthenticatedUser, operationId: string): Promise<void> {
    const operation = await this.db.operation.findUnique({
      where: { id: operationId },
      select: { companyId: true, unitId: true }
    });

    if (!operation) {
      throw new HttpError(404, "OPERATION_NOT_FOUND", "Operacao nao encontrada.");
    }

    assertScoped(user, { companyId: operation.companyId, operationId, unitId: operation.unitId });
  }

  private async audit(
    user: AuthenticatedUser,
    action: "CREATE" | "UPDATE" | "ARCHIVE",
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action,
        entity: "Employee",
        entityId,
        before: before === null ? Prisma.JsonNull : toJson(before),
        after: toJson(after),
        origin: "api"
      }
    });
  }
}

function assertScoped(
  user: AuthenticatedUser,
  resource: { companyId?: string | null; operationId?: string | null; unitId?: string | null }
) {
  if (user.role === "DEV" || canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Colaborador fora do escopo permitido.");
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

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function applyDefined<TTarget extends object, TKey extends keyof TTarget>(
  target: TTarget,
  key: TKey,
  value: TTarget[TKey] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
