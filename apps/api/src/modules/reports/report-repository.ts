import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { buildXlsxBase64 } from "./report-service.js";

export class ReportRepository {
  constructor(private readonly db: PrismaClient) {}

  async inconsistencies(user: AuthenticatedUser) {
    const operationWhere = operationScopeWhere(user);
    const [importIssues, scheduleDrafts] = await Promise.all([
      this.db.importIssue.findMany({
        include: { batch: true },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      this.db.scheduleVersion.findMany({
        where: { operation: operationWhere, status: { in: ["DRAFT", "IN_REVIEW"] } },
        orderBy: { createdAt: "desc" },
        take: 500
      })
    ]);

    const rows = [
      ...importIssues.map((issue) => ({
        origem: "importacao",
        codigo: issue.code,
        severidade: issue.severity,
        detalhe: issue.message,
        referencia: issue.batch.fileName
      })),
      ...scheduleDrafts.map((schedule) => ({
        origem: "escala",
        codigo: "SCHEDULE_REVIEW_PENDING",
        severidade: "WARNING",
        detalhe: `Escala ${schedule.version} aguardando tratamento de conflitos/pendencias.`,
        referencia: schedule.id
      }))
    ];

    return {
      fileName: "relatorio-inconsistencias.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contentBase64: buildXlsxBase64([{ name: "Inconsistencias", rows }])
    };
  }

  async gaps(user: AuthenticatedUser) {
    const operationWhere = operationScopeWhere(user);
    const [positions, employees] = await Promise.all([
      this.db.position.findMany({
        where: { status: "ACTIVE", operation: operationWhere },
        include: { operation: true, function: true }
      }),
      this.db.employee.findMany({
        where: { recordStatus: "ACTIVE", operation: operationWhere },
        include: { operation: true, function: true }
      })
    ]);

    const rows = positions
      .map((position) => {
        const occupied = employees.filter(
          (employee) =>
            employee.operationId === position.operationId &&
            employee.functionId === position.functionId &&
            nullableMatches(employee.shift, position.shift) &&
            nullableMatches(employee.team, position.team)
        ).length;

        return {
          operacao: position.operation.name,
          funcao: position.function.name,
          turno: position.shift ?? "",
          equipe: position.team ?? "",
          requerido: 1,
          ocupado: occupied,
          lacuna: Math.max(1 - occupied, 0)
        };
      })
      .filter((row) => row.lacuna > 0);

    return {
      fileName: "relatorio-lacunas.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contentBase64: buildXlsxBase64([{ name: "Lacunas", rows }])
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

function nullableMatches(left: string | null, right: string | null): boolean {
  return right === null || left === right;
}
