import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type AuditAction, type EvaluationStatus, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";
import { canTransitionEvaluation } from "./evaluation-workflow.js";

type CriterionInput = {
  code: string;
  name: string;
  description?: string | null | undefined;
  weight: number;
};

type ScoreInput = {
  criterionId: string;
  score: number;
  comment?: string | null | undefined;
};

type EvaluationInput = {
  employeeId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  notes?: string | null | undefined;
  scores: ScoreInput[];
};

type DevelopmentPlanInput = {
  employeeId: string;
  evaluationId?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
  dueAt?: string | null | undefined;
  items: Array<{
    action: string;
    owner?: string | null | undefined;
    dueAt?: string | null | undefined;
    completedAt?: string | null | undefined;
  }>;
};

export class EvaluationRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCriteria() {
    return this.db.evaluationCriterion.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" }
    });
  }

  async createCriterion(user: AuthenticatedUser, data: CriterionInput) {
    const created = await this.db.evaluationCriterion.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        weight: data.weight,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "EvaluationCriterion", created.id, null, created);
    return created;
  }

  async archiveCriterion(user: AuthenticatedUser, id: string) {
    const before = await this.db.evaluationCriterion.findUniqueOrThrow({ where: { id } });
    const updated = await this.db.evaluationCriterion.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "EvaluationCriterion", id, before, updated);
    return updated;
  }

  async listEvaluations(user: AuthenticatedUser) {
    return this.db.employeeEvaluation.findMany({
      where: { employee: { operation: operationScopeWhere(user) } },
      include: { scores: true, developmentPlans: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createEvaluation(user: AuthenticatedUser, data: EvaluationInput) {
    await this.assertEmployeeScope(user, data.employeeId);
    const created = await this.db.employeeEvaluation.create({
      data: {
        employeeId: data.employeeId,
        title: data.title,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        notes: data.notes ?? null,
        createdBy: user.id,
        scores: {
          create: data.scores.map((score) => ({
            criterionId: score.criterionId,
            score: score.score,
            comment: score.comment ?? null,
            createdBy: user.id
          }))
        },
        history: {
          create: {
            action: "CREATE",
            after: toJson(data),
            createdBy: user.id
          }
        }
      },
      include: { scores: true, history: true }
    });
    await this.audit(user, "CREATE", "EmployeeEvaluation", created.id, null, created);
    return created;
  }

  async transitionEvaluation(
    user: AuthenticatedUser,
    id: string,
    status: EvaluationStatus,
    reason?: string | null
  ) {
    const before = await this.db.employeeEvaluation.findUnique({
      where: { id },
      include: { employee: { include: { operation: true } } }
    });
    if (!before) {
      throw new HttpError(404, "EVALUATION_NOT_FOUND", "Avaliacao nao encontrada.");
    }
    assertScoped(user, {
      companyId: before.employee.operation.companyId,
      operationId: before.employee.operationId,
      unitId: before.employee.operation.unitId
    });
    if (!canTransitionEvaluation(before.status, status, user.role)) {
      throw new HttpError(
        403,
        "EVALUATION_WORKFLOW_FORBIDDEN",
        "Transicao de avaliacao nao permitida."
      );
    }

    const updateData: Prisma.EmployeeEvaluationUpdateInput = {
      status,
      updatedBy: user.id,
      history: {
        create: {
          action: status,
          before: toJson(before),
          after: toJson({ status }),
          reason: reason ?? null,
          createdBy: user.id
        }
      }
    };
    if (status === "IN_RH_REVIEW") {
      updateData.submittedAt = new Date();
    }
    if (status === "APPROVED" || status === "REJECTED") {
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = user.id;
    }

    const updated = await this.db.employeeEvaluation.update({
      where: { id },
      data: updateData,
      include: { scores: true, history: true }
    });
    await this.audit(
      user,
      status === "APPROVED" ? "APPROVE" : "UPDATE",
      "EmployeeEvaluation",
      id,
      before,
      updated
    );
    return updated;
  }

  async createDevelopmentPlan(user: AuthenticatedUser, data: DevelopmentPlanInput) {
    await this.assertEmployeeScope(user, data.employeeId);
    const created = await this.db.developmentPlan.create({
      data: {
        employeeId: data.employeeId,
        evaluationId: data.evaluationId ?? null,
        title: data.title,
        description: data.description ?? null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        createdBy: user.id,
        items: {
          create: data.items.map((item) => ({
            action: item.action,
            owner: item.owner ?? null,
            dueAt: item.dueAt ? new Date(item.dueAt) : null,
            completedAt: item.completedAt ? new Date(item.completedAt) : null,
            createdBy: user.id
          }))
        }
      },
      include: { items: true }
    });
    await this.audit(user, "CREATE", "DevelopmentPlan", created.id, null, created);
    return created;
  }

  async listDevelopmentPlans(user: AuthenticatedUser) {
    return this.db.developmentPlan.findMany({
      where: { employee: { operation: operationScopeWhere(user) } },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });
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

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Avaliacao fora do escopo permitido.");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
