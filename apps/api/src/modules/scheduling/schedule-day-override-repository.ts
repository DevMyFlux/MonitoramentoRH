import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { json, scopedOperation } from "../identity/access.js";

type OverrideInput = {
  operationId: string;
  employeeId: string;
  date: string;
  code: string;
  reason?: string | null | undefined;
};

export class ScheduleDayOverrideRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(user: AuthenticatedUser, operationId: string, month: string) {
    await scopedOperation(this.db, user, operationId);
    const first = new Date(`${month}-01T00:00:00Z`);
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 23, 59, 59));
    return this.db.scheduleDayOverride.findMany({
      where: { operationId, status: "ACTIVE", date: { gte: first, lte: last } },
      orderBy: [{ employeeId: "asc" }, { date: "asc" }]
    });
  }

  /** One override per (operação, colaborador, dia) — set replaces whatever was there before. */
  async set(user: AuthenticatedUser, data: OverrideInput) {
    const op = await scopedOperation(this.db, user, data.operationId);
    const employee = await this.db.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee || employee.operationId !== data.operationId) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Colaborador não encontrado nesta unidade.");
    }
    const date = new Date(`${data.date}T00:00:00Z`);

    return this.db.$transaction(async (tx) => {
      const before = await tx.scheduleDayOverride.findUnique({
        where: { operationId_employeeId_date: { operationId: data.operationId, employeeId: data.employeeId, date } }
      });
      const row = await tx.scheduleDayOverride.upsert({
        where: { operationId_employeeId_date: { operationId: data.operationId, employeeId: data.employeeId, date } },
        update: { code: data.code, reason: data.reason ?? null, status: "ACTIVE", updatedBy: user.id, archivedAt: null },
        create: {
          operationId: data.operationId,
          employeeId: data.employeeId,
          date,
          code: data.code,
          reason: data.reason ?? null,
          createdBy: user.id
        }
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: before ? "UPDATE" : "CREATE",
          entity: "ScheduleDayOverride",
          entityId: row.id,
          operationId: op.id,
          companyId: op.companyId,
          unitId: op.unitId,
          before: before ? json(before) : Prisma.JsonNull,
          after: json(row),
          origin: "api"
        }
      });
      return row;
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const before = await this.db.scheduleDayOverride.findUnique({ where: { id } });
    if (!before) {
      throw new HttpError(404, "OVERRIDE_NOT_FOUND", "Ajuste manual não encontrado.");
    }
    const op = await scopedOperation(this.db, user, before.operationId);
    const updated = await this.db.scheduleDayOverride.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action: "ARCHIVE",
        entity: "ScheduleDayOverride",
        entityId: id,
        operationId: op.id,
        companyId: op.companyId,
        unitId: op.unitId,
        before: json(before),
        after: json(updated),
        origin: "api"
      }
    });
    return updated;
  }
}
