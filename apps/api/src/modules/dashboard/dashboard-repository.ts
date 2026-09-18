import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";

export class DashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  async summary(user: AuthenticatedUser) {
    const operationWhere = operationScopeWhere(user);
    const [
      qlpCount,
      positionCount,
      employeeCount,
      documentCriticalCount,
      conflictCount,
      pendingCount
    ] = await Promise.all([
      this.db.qLPVersion.count({ where: { operation: operationWhere } }),
      this.db.position.count({ where: { status: "ACTIVE", operation: operationWhere } }),
      this.db.employee.count({ where: { recordStatus: "ACTIVE", operation: operationWhere } }),
      this.db.employeeDocument.count({
        where: {
          status: "ACTIVE",
          expiresAt: { lte: addDays(new Date(), 30) },
          employee: { operation: operationWhere }
        }
      }),
      this.db.scheduleVersion.count({
        where: {
          status: { in: ["DRAFT", "IN_REVIEW"] },
          operation: operationWhere,
          generatedResult: { path: ["conflicts"], not: [] }
        }
      }),
      this.db.employeeEvaluation.count({
        where: { status: "IN_RH_REVIEW", employee: { operation: operationWhere } }
      })
    ]);

    const vacancies = Math.max(positionCount - employeeCount, 0);
    const surplus = Math.max(employeeCount - positionCount, 0);

    return {
      qlp: qlpCount,
      occupied: Math.min(positionCount, employeeCount),
      vacancies,
      surplus,
      coveragePercent:
        positionCount === 0 ? 100 : Math.round((employeeCount / positionCount) * 100),
      criticalDocuments: documentCriticalCount,
      conflicts: conflictCount,
      pending: pendingCount
    };
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

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
