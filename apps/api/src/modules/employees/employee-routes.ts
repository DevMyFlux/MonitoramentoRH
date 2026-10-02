import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { employeeInputSchema, idParamsSchema } from "@my-flux/validation";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import {
  attachmentHeader,
  buildEmployeeExportRows,
  employeeExportFileName,
  renderEmployeesWorkbook
} from "./employee-export.js";
import type { EmployeeRepository } from "./employee-repository.js";

const exportQuerySchema = z.object({ operationId: z.string().uuid().optional() });

export async function registerEmployeeRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: EmployeeRepository
): Promise<void> {
  app.get("/employees", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.list(user) };
  });

  // Registered before "/employees/:id" so "export" is never parsed as an id.
  app.get("/employees/export", async (request, reply) => {
    const user = await authenticateRequest(request, users);
    const { operationId } = exportQuerySchema.parse(request.query);
    const data = await repository.exportData(user, operationId);
    const rows = buildEmployeeExportRows(data.employees, data.shiftParameters, data.userNames);
    const buffer = await renderEmployeesWorkbook(rows);
    reply.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    reply.header("Content-Disposition", attachmentHeader(employeeExportFileName(data.unitName)));
    return reply.send(buffer);
  });

  app.get("/employees/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.get(user, params.id) };
  });

  app.post("/employees", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEmployees(user.role);
    return { data: await repository.create(user, employeeInputSchema.parse(request.body)) };
  });

  app.patch("/employees/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEmployees(user.role);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.update(
        user,
        params.id,
        employeeInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/employees/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEmployees(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archive(user, params.id) };
  });
}

function assertCanManageEmployees(role: string) {
  if (role === "DEV" || role === "ADMIN" || role === "RH") {
    return;
  }

  throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para gerenciar colaboradores.");
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
