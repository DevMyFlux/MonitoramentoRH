import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { assertRole, json, operationWhere, scopedOperation } from "../identity/access.js";
import { HttpError } from "../../lib/http-error.js";
import {
  calendarConfigSchema,
  createMonthly,
  monthlySnapshot
} from "../scheduling/monthly-service.js";
import { AptitudeRepository } from "../aptitude/aptitude-repository.js";

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
) {
  const ids = z.object({ id: z.string().uuid() });
  app.get("/parameters", async (req) => {
    const user = await authenticateRequest(req, users);
    const ops = await db.operation.findMany({ where: operationWhere(user), select: { id: true } });
    return {
      data: await db.operationalParameter.findMany({
        where: { operationId: { in: ops.map((o) => o.id) }, status: "ACTIVE" }
      })
    };
  });
  app.post("/parameters", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN"]);
    const input = z
      .object({
        operationId: z.string().uuid(),
        code: z.string().min(1).max(80),
        name: z.string().min(2).max(180),
        configuration: calendarConfigSchema
      })
      .parse(req.body);
    const op = await scopedOperation(db, user, input.operationId);
    return {
      data: await db.$transaction(async (tx) => {
        const row = await tx.operationalParameter.create({
          data: {
            ...input,
            kind: "SHIFT",
            configuration: json(input.configuration),
            createdBy: user.id
          }
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            userRole: user.role,
            action: "CREATE",
            entity: "OperationalParameter",
            entityId: row.id,
            operationId: op.id,
            companyId: op.companyId,
            unitId: op.unitId,
            after: json(row),
            origin: "api"
          }
        });
        return row;
      })
    };
  });
  app.post("/schedules/generate", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN"]);
    const input = z
      .object({
        operationId: z.string().uuid(),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      })
      .parse(req.body);
    return { data: await createMonthly(db, user, input.operationId, input.month) };
  });
  app.get("/schedules/:id", async (req) => {
    const user = await authenticateRequest(req, users);
    const { id } = ids.parse(req.params);
    const row = await db.scheduleVersion.findUnique({
      where: { id },
      include: { history: { orderBy: { createdAt: "asc" } } }
    });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Escala não encontrada.");
    await scopedOperation(db, user, row.operationId);
    return { data: row };
  });
  app.post("/schedules/:id/validate", async (req) => {
    const user = await authenticateRequest(req, users);
    const { id } = ids.parse(req.params);
    const row = await db.scheduleVersion.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Escala não encontrada.");
    const live = await monthlySnapshot(
      db,
      user,
      row.operationId,
      row.month.toISOString().slice(0, 7)
    );
    const original = row.generatedInput as Record<string, unknown>;
    return { data: { changed: original.inputSnapshotHash !== live.hash, ...live.result } };
  });
  app.post("/positions/:id/assign", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const { id } = ids.parse(req.params);
    const input = z
      .object({
        employeeId: z.string().uuid(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime().optional()
      })
      .parse(req.body);
    const position = await db.position.findUnique({ where: { id }, include: { qlpVersion: true } });
    if (!position || position.qlpVersion?.status !== "APPROVED")
      throw new HttpError(
        409,
        "APPROVED_POSITION_REQUIRED",
        "Posição precisa pertencer a um QLP aprovado."
      );
    const op = await scopedOperation(db, user, position.operationId);
    const employee = await db.employee.findUnique({ where: { id: input.employeeId } });
    if (
      !employee ||
      employee.operationId !== op.id ||
      employee.functionId !== position.functionId ||
      employee.status !== "ACTIVE" ||
      !employee.admissionDate ||
      employee.admissionDate > new Date(input.startsAt)
    )
      throw new HttpError(
        409,
        "EMPLOYEE_INELIGIBLE",
        "Colaborador incompatível ou não ativo na vigência."
      );
    if (input.endsAt && input.endsAt <= input.startsAt)
      throw new HttpError(400, "INVALID_INTERVAL", "Fim deve ser posterior ao início.");
    const aptitude = await new AptitudeRepository(db).getEmployeeAptitude(user, employee.id);
    if (aptitude.status === "RED")
      throw new HttpError(409, "APTITUDE_BLOCKED", "Requisito crítico não atendido.", {
        reasonCodes: aptitude.reasonCodes
      });
    return {
      data: await db.$transaction(async (tx) => {
        const row = await tx.employeeAssignment.create({
          data: {
            positionId: id,
            employeeId: employee.id,
            startsAt: new Date(input.startsAt),
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            createdBy: user.id
          }
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            userRole: user.role,
            action: "CREATE",
            entity: "EmployeeAssignment",
            entityId: row.id,
            operationId: op.id,
            companyId: op.companyId,
            unitId: op.unitId,
            after: json(row),
            origin: "api"
          }
        });
        return row;
      })
    };
  });
  app.get("/users", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    return {
      data: await db.user.findMany({
        where: user.role === "DEV" ? {} : { createdBy: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          role: { select: { name: true } },
          scopes: { select: { companyId: true, operationId: true, unitId: true, isGlobal: true } }
        },
        orderBy: { name: "asc" }
      })
    };
  });
  app.patch("/users/:id/status", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const { id } = ids.parse(req.params);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    return {
      data: await db.$transaction(
        async (tx) => {
          const target = await tx.user.findUnique({ where: { id }, include: { role: true } });
          if (!target) throw new HttpError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
          const levels = { DEV: 4, ADMIN: 3, RH: 2, COMUM: 1 };
          if (
            user.role !== "DEV" &&
            (levels[target.role.name] >= levels[user.role] || target.createdBy !== user.id)
          )
            throw new HttpError(403, "FORBIDDEN", "Não é permitido gerenciar este usuário.");
          if (
            !isActive &&
            target.role.name === "DEV" &&
            (await tx.user.count({ where: { isActive: true, role: { name: "DEV" } } })) <= 1
          )
            throw new HttpError(409, "LAST_DEV", "O último DEV ativo deve ser preservado.");
          await tx.user.update({ where: { id }, data: { isActive, updatedBy: user.id } });
          await tx.refreshSession.updateMany({
            where: { userId: id },
            data: { revokedAt: new Date(), status: "ARCHIVED" }
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              userRole: user.role,
              action: "USER_DISABLE",
              entity: "User",
              entityId: id,
              after: { isActive },
              origin: "api"
            }
          });
          return { id, isActive };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    };
  });
}
