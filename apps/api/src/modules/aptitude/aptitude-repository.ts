import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type AuditAction, type PrismaClient, type RequirementKind } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";
import { calculateAptitude } from "./aptitude-service.js";

type RequirementInput = {
  operationId?: string | null | undefined;
  functionId?: string | null | undefined;
  kind: RequirementKind;
  code: string;
  name: string;
  description?: string | null | undefined;
  validityDays?: number | null | undefined;
  warningDays: number;
  required: boolean;
};

type UpdateRequirementInput = {
  operationId?: string | null | undefined;
  functionId?: string | null | undefined;
  kind?: RequirementKind | undefined;
  code?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  validityDays?: number | null | undefined;
  warningDays?: number | undefined;
  required?: boolean | undefined;
};

type DocumentInput = {
  employeeId: string;
  requirementId: string;
  issuedAt?: string | null | undefined;
  expiresAt?: string | null | undefined;
  fileName?: string | null | undefined;
  fileUrl?: string | null | undefined;
  notes?: string | null | undefined;
};

type MatrixInput = {
  operationId?: string | null | undefined;
  functionId: string;
  competencyCode: string;
  competencyName: string;
  requiredLevel: number;
  validityDays?: number | null | undefined;
  warningDays: number;
  required: boolean;
};

type EmployeeCompetencyInput = {
  employeeId: string;
  competencyCode: string;
  competencyName: string;
  level: number;
  achievedAt?: string | null | undefined;
  expiresAt?: string | null | undefined;
  notes?: string | null | undefined;
};

export class AptitudeRepository {
  constructor(private readonly db: PrismaClient) {}

  async listRequirements(user: AuthenticatedUser) {
    return this.db.complianceRequirement.findMany({
      where: { status: "ACTIVE", ...requirementScopeWhere(user) },
      orderBy: [{ kind: "asc" }, { name: "asc" }]
    });
  }

  async createRequirement(user: AuthenticatedUser, data: RequirementInput) {
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }

    const created = await this.db.complianceRequirement.create({
      data: {
        operationId: data.operationId ?? null,
        functionId: data.functionId ?? null,
        kind: data.kind,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        validityDays: data.validityDays ?? null,
        warningDays: data.warningDays,
        required: data.required,
        createdBy: user.id
      }
    });

    await this.audit(user, "CREATE", "ComplianceRequirement", created.id, null, created);
    return created;
  }

  async updateRequirement(user: AuthenticatedUser, id: string, data: UpdateRequirementInput) {
    const before = await this.getRequirementForWrite(user, id);
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }

    const updateData: Prisma.ComplianceRequirementUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "operationId", data.operationId);
    applyDefined(updateData, "functionId", data.functionId);
    applyDefined(updateData, "kind", data.kind);
    applyDefined(updateData, "code", data.code);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "description", data.description);
    applyDefined(updateData, "validityDays", data.validityDays);
    applyDefined(updateData, "warningDays", data.warningDays);
    applyDefined(updateData, "required", data.required);

    const updated = await this.db.complianceRequirement.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "ComplianceRequirement", id, before, updated);
    return updated;
  }

  async archiveRequirement(user: AuthenticatedUser, id: string) {
    const before = await this.getRequirementForWrite(user, id);
    const updated = await this.db.complianceRequirement.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "ComplianceRequirement", id, before, updated);
    return updated;
  }

  async listDocuments(user: AuthenticatedUser, employeeId?: string) {
    if (employeeId) {
      await this.assertEmployeeScope(user, employeeId);
    }

    const where: Prisma.EmployeeDocumentWhereInput = {
      status: "ACTIVE",
      employee: { operation: operationScopeWhere(user) }
    };
    if (employeeId !== undefined) {
      where.employeeId = employeeId;
    }

    return this.db.employeeDocument.findMany({
      where,
      include: { requirement: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createDocument(user: AuthenticatedUser, data: DocumentInput) {
    await this.assertEmployeeScope(user, data.employeeId);
    await this.assertRequirementScope(user, data.requirementId);
    const created = await this.db.employeeDocument.create({
      data: {
        employeeId: data.employeeId,
        requirementId: data.requirementId,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        fileName: data.fileName ?? null,
        fileUrl: data.fileUrl ?? null,
        notes: data.notes ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "EmployeeDocument", created.id, null, created);
    return created;
  }

  async archiveDocument(user: AuthenticatedUser, id: string) {
    const before = await this.db.employeeDocument.findUnique({
      where: { id },
      include: { employee: { include: { operation: true } } }
    });
    if (!before) {
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Documento nao encontrado.");
    }
    assertScoped(user, {
      companyId: before.employee.operation.companyId,
      operationId: before.employee.operationId,
      unitId: before.employee.operation.unitId
    });

    const updated = await this.db.employeeDocument.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "EmployeeDocument", id, before, updated);
    return updated;
  }

  async listMatrix(user: AuthenticatedUser) {
    return this.db.competencyMatrixItem.findMany({
      where: { status: "ACTIVE", ...matrixScopeWhere(user) },
      orderBy: [{ competencyName: "asc" }]
    });
  }

  async createMatrixItem(user: AuthenticatedUser, data: MatrixInput) {
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }
    const created = await this.db.competencyMatrixItem.create({
      data: {
        operationId: data.operationId ?? null,
        functionId: data.functionId,
        competencyCode: data.competencyCode,
        competencyName: data.competencyName,
        requiredLevel: data.requiredLevel,
        validityDays: data.validityDays ?? null,
        warningDays: data.warningDays,
        required: data.required,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "CompetencyMatrixItem", created.id, null, created);
    return created;
  }

  async archiveMatrixItem(user: AuthenticatedUser, id: string) {
    const before = await this.db.competencyMatrixItem.findUnique({ where: { id } });
    if (!before) {
      throw new HttpError(
        404,
        "COMPETENCY_MATRIX_ITEM_NOT_FOUND",
        "Item da matriz nao encontrado."
      );
    }
    if (before.operationId) {
      await this.assertOperationScope(user, before.operationId);
    }
    const updated = await this.db.competencyMatrixItem.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "CompetencyMatrixItem", id, before, updated);
    return updated;
  }

  async listEmployeeCompetencies(user: AuthenticatedUser, employeeId?: string) {
    if (employeeId) {
      await this.assertEmployeeScope(user, employeeId);
    }

    const where: Prisma.EmployeeCompetencyWhereInput = {
      status: "ACTIVE",
      employee: { operation: operationScopeWhere(user) }
    };
    if (employeeId !== undefined) {
      where.employeeId = employeeId;
    }

    return this.db.employeeCompetency.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });
  }

  async createEmployeeCompetency(user: AuthenticatedUser, data: EmployeeCompetencyInput) {
    await this.assertEmployeeScope(user, data.employeeId);
    const created = await this.db.employeeCompetency.create({
      data: {
        employeeId: data.employeeId,
        competencyCode: data.competencyCode,
        competencyName: data.competencyName,
        level: data.level,
        achievedAt: data.achievedAt ? new Date(data.achievedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        notes: data.notes ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "EmployeeCompetency", created.id, null, created);
    return created;
  }

  async archiveEmployeeCompetency(user: AuthenticatedUser, id: string) {
    const before = await this.db.employeeCompetency.findUnique({
      where: { id },
      include: { employee: { include: { operation: true } } }
    });
    if (!before) {
      throw new HttpError(404, "EMPLOYEE_COMPETENCY_NOT_FOUND", "Competencia nao encontrada.");
    }
    assertScoped(user, {
      companyId: before.employee.operation.companyId,
      operationId: before.employee.operationId,
      unitId: before.employee.operation.unitId
    });
    const updated = await this.db.employeeCompetency.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "EmployeeCompetency", id, before, updated);
    return updated;
  }

  async getEmployeeAptitude(user: AuthenticatedUser, employeeId: string) {
    const employee = await this.db.employee.findUnique({
      where: { id: employeeId },
      include: {
        operation: true,
        documents: { where: { status: "ACTIVE" } },
        competencies: { where: { status: "ACTIVE" } }
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

    const functionFilter =
      employee.functionId === null
        ? [{ functionId: null }]
        : [{ functionId: null }, { functionId: employee.functionId }];

    const documentRequirements = await this.db.complianceRequirement.findMany({
      where: {
        status: "ACTIVE",
        kind: "DOCUMENT",
        required: true,
        AND: [
          { OR: [{ operationId: null }, { operationId: employee.operationId }] },
          { OR: functionFilter }
        ]
      }
    });

    const competencyRequirements =
      employee.functionId === null
        ? []
        : await this.db.competencyMatrixItem.findMany({
            where: {
              status: "ACTIVE",
              required: true,
              functionId: employee.functionId,
              OR: [{ operationId: null }, { operationId: employee.operationId }]
            }
          });

    const result = calculateAptitude({
      documentRequirements: documentRequirements.map((requirement) => ({
        code: requirement.code,
        name: requirement.name,
        warningDays: requirement.warningDays,
        required: requirement.required,
        documents: employee.documents
          .filter((document) => document.requirementId === requirement.id)
          .map((document) => ({ expiresAt: document.expiresAt, status: document.status }))
      })),
      competencyRequirements: competencyRequirements.map((requirement) => ({
        competencyCode: requirement.competencyCode,
        competencyName: requirement.competencyName,
        requiredLevel: requirement.requiredLevel,
        warningDays: requirement.warningDays,
        required: requirement.required,
        competencies: employee.competencies
          .filter((competency) => competency.competencyCode === requirement.competencyCode)
          .map((competency) => ({
            level: competency.level,
            expiresAt: competency.expiresAt,
            status: competency.status
          }))
      }))
    });

    return {
      employeeId,
      status: result.status,
      reasonCodes: result.reasonCodes,
      reasons: result.reasons
    };
  }

  private async getRequirementForWrite(user: AuthenticatedUser, id: string) {
    const requirement = await this.db.complianceRequirement.findUnique({ where: { id } });
    if (!requirement) {
      throw new HttpError(404, "REQUIREMENT_NOT_FOUND", "Requisito nao encontrado.");
    }
    if (requirement.operationId) {
      await this.assertOperationScope(user, requirement.operationId);
    }

    return requirement;
  }

  private async assertRequirementScope(user: AuthenticatedUser, requirementId: string) {
    const requirement = await this.db.complianceRequirement.findUnique({
      where: { id: requirementId }
    });
    if (!requirement) {
      throw new HttpError(404, "REQUIREMENT_NOT_FOUND", "Requisito nao encontrado.");
    }
    if (requirement.operationId) {
      await this.assertOperationScope(user, requirement.operationId);
    }
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

function requirementScopeWhere(user: AuthenticatedUser): Record<string, unknown> {
  if (user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal)) {
    return {};
  }

  return {
    OR: [
      { operationId: null },
      ...user.scopes.map((scope) => ({ operationId: scope.operationId ?? undefined }))
    ]
  };
}

function matrixScopeWhere(user: AuthenticatedUser): Record<string, unknown> {
  if (user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal)) {
    return {};
  }

  return {
    OR: [
      { operationId: null },
      ...user.scopes.map((scope) => ({ operationId: scope.operationId ?? undefined }))
    ]
  };
}

function assertScoped(
  user: AuthenticatedUser,
  resource: { companyId?: string | null; operationId?: string | null; unitId?: string | null }
): void {
  if (user.role === "DEV" || canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Recurso fora do escopo permitido.");
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

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
