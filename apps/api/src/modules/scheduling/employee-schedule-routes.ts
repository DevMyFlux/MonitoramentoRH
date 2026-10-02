import { getScheduleTemplate, scheduleCodeMap, scheduleTemplates } from "@my-flux/shared";
import { scheduleDayOverrideInputSchema } from "@my-flux/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import { assertRole, json, scopedOperation } from "../identity/access.js";
import { generateEmployeeSchedule } from "./employee-schedule-service.js";
import { ScheduleDayOverrideRepository } from "./schedule-day-override-repository.js";
import { renderScheduleWorkbook, scheduleFileName, type ScheduleGridData } from "./xlsx-renderer.js";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM.");
const idSchema = z.object({ id: z.string().uuid() });

export async function registerEmployeeScheduleRoutes(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
): Promise<void> {
  const overrides = new ScheduleDayOverrideRepository(db);

  app.post("/employee-schedules/generate", async (request) => {
    const user = await authenticateRequest(request, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const input = z.object({ operationId: z.string().uuid(), month: monthSchema }).parse(request.body);
    return { data: await generateEmployeeSchedule(db, user, input.operationId, input.month) };
  });

  app.get("/employee-schedules/:id/export", async (request, reply) => {
    const user = await authenticateRequest(request, users);
    const { id } = idSchema.parse(request.params);
    const version = await db.scheduleVersion.findUnique({ where: { id }, include: { operation: true } });
    if (!version || version.archivedAt) {
      throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versão de escala não encontrada.");
    }
    await scopedOperation(db, user, version.operationId);
    const result = version.generatedResult as { grid?: ScheduleGridData } | null;
    if (!result?.grid) {
      throw new HttpError(
        409,
        "SCHEDULE_NOT_EXPORTABLE",
        "Esta versão não foi gerada pelo fluxo de Colaboradores; não é possível exportar."
      );
    }
    const code = version.operation.code;
    if (!code || !(code in scheduleTemplates)) {
      throw new HttpError(
        409,
        "UNIT_TEMPLATE_NOT_CONFIGURED",
        code
          ? `Nenhum template de escala configurado para o código de unidade "${code}".`
          : "A operação não tem um código de unidade definido; configure-o para exportar."
      );
    }
    const template = getScheduleTemplate(code);
    const buffer = await renderScheduleWorkbook(result.grid, template);
    const fileName = scheduleFileName(template, version.month.getUTCMonth() + 1);
    reply.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
    return reply.send(buffer);
  });

  /**
   * "Excluir escala" (history screen). Soft delete, matching how this codebase
   * removes everything else (employees, functions, events: archivedAt + an
   * ARCHIVE audit entry): the ScheduleVersion row, its history and its audit
   * trail are kept — only this one version disappears from listings, exports
   * and workflow transitions. Deliberately untouched: employees and their
   * history, other versions (other months and other units), and the manual
   * day overrides, which belong to unit+month rather than to one version and
   * keep applying to the next generation.
   */
  app.delete("/employee-schedules/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const { id } = idSchema.parse(request.params);
    const version = await db.scheduleVersion.findUnique({ where: { id } });
    if (!version || version.archivedAt) {
      throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Versão de escala não encontrada.");
    }
    const operation = await scopedOperation(db, user, version.operationId);
    const snapshot = json({
      version: version.version,
      month: version.month.toISOString().slice(0, 7),
      status: version.status,
      operationId: version.operationId
    });

    await db.$transaction([
      db.scheduleVersion.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          updatedBy: user.id,
          history: {
            create: {
              action: "DELETE",
              before: snapshot,
              reason: "Exclusão solicitada na tela de Escalas.",
              createdBy: user.id
            }
          }
        }
      }),
      db.auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: "ARCHIVE",
          entity: "ScheduleVersion",
          entityId: id,
          companyId: operation.companyId,
          unitId: operation.unitId,
          operationId: version.operationId,
          before: snapshot,
          origin: "api"
        }
      })
    ]);
    return { data: { id, deleted: true } };
  });

  app.get("/schedule-day-overrides", async (request) => {
    const user = await authenticateRequest(request, users);
    const query = z
      .object({ operationId: z.string().uuid(), month: monthSchema })
      .parse(request.query);
    return { data: await overrides.list(user, query.operationId, query.month) };
  });

  app.post("/schedule-day-overrides", async (request) => {
    const user = await authenticateRequest(request, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const input = scheduleDayOverrideInputSchema.parse(request.body);
    if (!(input.code in scheduleCodeMap)) {
      throw new HttpError(400, "UNKNOWN_SCHEDULE_CODE", "Código de escala desconhecido.");
    }
    return { data: await overrides.set(user, input) };
  });

  app.delete("/schedule-day-overrides/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const { id } = idSchema.parse(request.params);
    return { data: await overrides.remove(user, id) };
  });
}

async function authenticateRequest(request: FastifyRequest, users: UserRepository) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Autenticacao obrigatoria.");
  }

  const payload = verifyAccessToken(authorization.slice("Bearer ".length));

  if (!payload) {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Token invalido.");
  }

  const user = await users.findById(payload.sub);

  if (!user) {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Usuario da sessao nao encontrado.");
  }

  return user;
}
