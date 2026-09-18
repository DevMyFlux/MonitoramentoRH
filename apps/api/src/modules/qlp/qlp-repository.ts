import { assertRole } from "../identity/access.js";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type AuditAction, type PrismaClient, type WorkflowStatus } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { countsAsCurrentHeadcount } from "../employees/employee-rules.js";
import { canAccessScope } from "../identity/scope-policy.js";
import { calculateQlpCoverage } from "./qlp-calculator.js";
import { canTransitionQlp } from "./qlp-workflow.js";

type RequirementInput = {
  functionId: string;
  workRegime?: string | null | undefined;
  shift?: string | null | undefined;
  parity?: string | null | undefined;
  team?: string | null | undefined;
  quantity: number;
  criticality?: string | null | undefined;
};

type QlpInput = {
  operationId: string;
  kind: "CONTRACTUAL" | "OPERATIONAL";
  validFrom: string;
  validTo?: string | null | undefined;
  reason: string;
  requirements: RequirementInput[];
};

type PositionInput = {
  operationId: string;
  functionId: string;
  workRegime?: string | null | undefined;
  shift?: string | null | undefined;
  parity?: string | null | undefined;
  team?: string | null | undefined;
  criticality?: string | null | undefined;
  validFrom: string;
  validTo?: string | null | undefined;
};

export class QlpRepository {
  constructor(private readonly db: PrismaClient) {}

  async listVersions(user: AuthenticatedUser) {
    return this.db.qLPVersion.findMany({
      where: { operation: operationScopeWhere(user) },
      include: { requirements: true },
      orderBy: [{ operationId: "asc" }, { version: "desc" }]
    });
  }

  async createVersion(user: AuthenticatedUser, data: QlpInput) {
    assertRole(user, ["DEV", "ADMIN"]);
    await this.assertOperationScope(user, data.operationId);
    const last = await this.db.qLPVersion.findFirst({
      where: { operationId: data.operationId, kind: data.kind },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    for (const requirement of data.requirements) {
      const fn = await this.db.jobFunction.findUnique({ where: { id: requirement.functionId } });
      if (!fn || (fn.operationId && fn.operationId !== data.operationId)) throw new HttpError(400, "FUNCTION_SCOPE_MISMATCH", "Função não pertence à operação.");
    }
    const created = await this.db.qLPVersion.create({
      data: {
        operationId: data.operationId,
        kind: data.kind,
        version: (last?.version ?? 0) + 1,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : null,
        reason: data.reason,
        createdBy: user.id,
        requirements: {
          create: data.requirements.map((requirement) => ({
            functionId: requirement.functionId,
            workRegime: requirement.workRegime ?? null,
            shift: requirement.shift ?? null,
            parity: requirement.parity ?? null,
            team: requirement.team ?? null,
            quantity: requirement.quantity,
            criticality: requirement.criticality ?? null,
            createdBy: user.id
          }))
        }
      },
      include: { requirements: true }
    });

    await this.audit(user, "CREATE", "QLPVersion", created.id, null, created);
    return created;
  }

  async transition(user: AuthenticatedUser, id: string, next: WorkflowStatus) {
    const before = await this.db.qLPVersion.findUnique({
      where: { id },
      include: { operation: true }
    });

    if (!before) {
      throw new HttpError(404, "QLP_VERSION_NOT_FOUND", "Versao de QLP nao encontrada.");
    }

    assertScoped(user, {
      companyId: before.operation.companyId,
      operationId: before.operationId,
      unitId: before.operation.unitId
    });

    if (!canTransitionQlp(before.status, next, user.role)) {
      throw new HttpError(403, "QLP_WORKFLOW_FORBIDDEN", "Transicao de QLP nao permitida.");
    }

    const updateData: Prisma.QLPVersionUpdateInput = {
      status: next,
      updatedBy: user.id
    };
    if (next === "APPROVED") {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
    }

    const updated = await this.db.$transaction(async tx => {
      const updated = await tx.qLPVersion.update({ where: { id, status: before.status, updatedAt: before.updatedAt }, data: updateData });
      if (next === "APPROVED") {
        const requirements = await tx.qLPRequirement.findMany({ where: { versionId: id } });
        if (before.kind === "OPERATIONAL") for (const requirement of requirements) {
          for (let i = 0; i < requirement.quantity; i++) await tx.position.create({ data: {
            qlpVersionId: id, operationId: before.operationId, functionId: requirement.functionId,
            shift: requirement.shift, team: requirement.team, parity: requirement.parity,
            workRegime: requirement.workRegime, criticality: requirement.criticality,
            validFrom: before.validFrom, validTo: before.validTo, createdBy: user.id
          } });
        }
      }
      await tx.auditLog.create({ data: { userId: user.id, userRole: user.role, action: next === "APPROVED" ? "APPROVE" : "UPDATE", entity: "QLPVersion", entityId: id, operationId: before.operationId, companyId: before.operation.companyId, unitId: before.operation.unitId, before: toJson(before), after: toJson(updated), origin: "api" } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return updated;
  }

  async coverage(user: AuthenticatedUser, id: string) {
    const version = await this.db.qLPVersion.findUnique({
      where: { id },
      include: { requirements: true, operation: true }
    });

    if (!version) {
      throw new HttpError(404, "QLP_VERSION_NOT_FOUND", "Versao de QLP nao encontrada.");
    }

    assertScoped(user, {
      companyId: version.operation.companyId,
      operationId: version.operationId,
      unitId: version.operation.unitId
    });

    const employees = await this.db.employee.findMany({
      where: { operationId: version.operationId, recordStatus: "ACTIVE" }
    });
    const today = new Date();

    return calculateQlpCoverage(
      version.requirements.map((requirement) => ({
        functionId: requirement.functionId,
        shift: requirement.shift,
        team: requirement.team,
        quantity: requirement.quantity
      })),
      employees.map((employee) => ({
        functionId: employee.functionId,
        shift: employee.shift,
        team: employee.team,
        isCurrent: countsAsCurrentHeadcount(employee.status, employee.admissionDate, today),
        isProjected:
          employee.status === "SCHEDULED_ADMISSION" ||
          Boolean(employee.admissionDate && employee.admissionDate > today)
      }))
    );
  }

  async listPositions(user: AuthenticatedUser) {
    return this.db.position.findMany({
      where: { status: "ACTIVE", operation: operationScopeWhere(user) },
      include: { function: true, assignments: { where: { status: "ACTIVE" }, include: { employee: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPosition(user: AuthenticatedUser, data: PositionInput) {
    assertRole(user, ["DEV", "ADMIN"]);
    await this.assertOperationScope(user, data.operationId);
    throw new HttpError(409, "QLP_ORIGIN_REQUIRED", "Posições são materializadas pela aprovação do QLP operacional.");
    /* legacy manual creation disabled
    const created = await this.db.position.create({
      data: {
        operationId: data.operationId,
        functionId: data.functionId,
        workRegime: data.workRegime ?? null,
        shift: data.shift ?? null,
        parity: data.parity ?? null,
        team: data.team ?? null,
        criticality: data.criticality ?? null,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Position", created.id, null, created);
    return created; */
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

function assertScoped(
  user: AuthenticatedUser,
  resource: { companyId?: string | null; operationId?: string | null; unitId?: string | null }
) {
  if (user.role === "DEV" || canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "QLP fora do escopo permitido.");
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
