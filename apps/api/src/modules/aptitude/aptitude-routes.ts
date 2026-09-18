import {
  competencyMatrixItemInputSchema,
  complianceRequirementInputSchema,
  employeeCompetencyInputSchema,
  employeeDocumentInputSchema,
  idParamsSchema
} from "@my-flux/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import type { AptitudeRepository } from "./aptitude-repository.js";

const employeeQuerySchema = z.object({
  employeeId: z.string().uuid().optional()
});

export async function registerAptitudeRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: AptitudeRepository
): Promise<void> {
  app.get("/requirements", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listRequirements(user) };
  });

  app.post("/requirements", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    return {
      data: await repository.createRequirement(
        user,
        complianceRequirementInputSchema.parse(request.body)
      )
    };
  });

  app.patch("/requirements/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateRequirement(
        user,
        params.id,
        complianceRequirementInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/requirements/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveRequirement(user, params.id) };
  });

  app.get("/documents", async (request) => {
    const user = await authenticateRequest(request, users);
    const query = employeeQuerySchema.parse(request.query);
    return { data: await repository.listDocuments(user, query.employeeId) };
  });

  app.post("/documents", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    return {
      data: await repository.createDocument(user, employeeDocumentInputSchema.parse(request.body))
    };
  });

  app.delete("/documents/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveDocument(user, params.id) };
  });

  app.get("/competency-matrix", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listMatrix(user) };
  });

  app.post("/competency-matrix", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    return {
      data: await repository.createMatrixItem(
        user,
        competencyMatrixItemInputSchema.parse(request.body)
      )
    };
  });

  app.delete("/competency-matrix/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveMatrixItem(user, params.id) };
  });

  app.get("/employee-competencies", async (request) => {
    const user = await authenticateRequest(request, users);
    const query = employeeQuerySchema.parse(request.query);
    return { data: await repository.listEmployeeCompetencies(user, query.employeeId) };
  });

  app.post("/employee-competencies", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    return {
      data: await repository.createEmployeeCompetency(
        user,
        employeeCompetencyInputSchema.parse(request.body)
      )
    };
  });

  app.delete("/employee-competencies/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageAptitude(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveEmployeeCompetency(user, params.id) };
  });

  app.get("/employees/:id/aptitude", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.getEmployeeAptitude(user, params.id) };
  });
}

function assertCanManageAptitude(role: string) {
  if (role === "DEV" || role === "ADMIN" || role === "RH") {
    return;
  }

  throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para gerenciar aptidao.");
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
