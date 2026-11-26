import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { camposFaltando } from "@my-flux/shared";
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
    if (!row || row.archivedAt) throw new HttpError(404, "NOT_FOUND", "Escala não encontrada.");
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
  app.get("/users", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const apenasPendentes =
      z.object({ pendentes: z.enum(["0", "1"]).optional() }).parse(req.query).pendentes === "1";
    const lista = await db.user.findMany({
      where: user.role === "DEV" ? {} : { createdBy: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        cargo: true,
        nivelGovernanca: true,
        area: { select: { id: true, nome: true } },
        role: { select: { name: true } },
        scopes: { select: { companyId: true, operationId: true, unitId: true, isGlobal: true } }
      },
      orderBy: { name: "asc" }
    });
    // Contas antigas ficam sem cargo, nível e área: `cadastroIncompleto` lista o que falta.
    const comPendencias = lista.map((conta) => ({
      ...conta,
      cadastroIncompleto: camposFaltando({
        cargo: conta.cargo,
        nivelGovernanca: conta.nivelGovernanca,
        areaId: conta.area?.id
      })
    }));
    return {
      data: apenasPendentes
        ? comPendencias.filter((c) => c.cadastroIncompleto.length > 0)
        : comPendencias
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
