import {
  competencyMatrixItemInputSchema,
  complianceRequirementInputSchema,
  employeeCompetencyInputSchema,
  employeeDocumentInputSchema,
  idParamsSchema
} from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import type { AptitudeRepository } from "./aptitude-repository.js";
import { requirePermission } from "../identity/authorization.js";

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
    requirePermission(user, "aptitude:manage");
    return {
      data: await repository.createRequirement(
        user,
        complianceRequirementInputSchema.parse(request.body)
      )
    };
  });

  app.patch("/requirements/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "aptitude:manage");
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
    requirePermission(user, "aptitude:manage");
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
    requirePermission(user, "aptitude:manage");
    return {
      data: await repository.createDocument(user, employeeDocumentInputSchema.parse(request.body))
    };
  });

  app.delete("/documents/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "aptitude:manage");
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveDocument(user, params.id) };
  });

  app.get("/competency-matrix", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listMatrix(user) };
  });

  app.post("/competency-matrix", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "aptitude:manage");
    return {
      data: await repository.createMatrixItem(
        user,
        competencyMatrixItemInputSchema.parse(request.body)
      )
    };
  });

  app.delete("/competency-matrix/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "aptitude:manage");
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
    requirePermission(user, "aptitude:manage");
    return {
      data: await repository.createEmployeeCompetency(
        user,
        employeeCompetencyInputSchema.parse(request.body)
      )
    };
  });

  app.delete("/employee-competencies/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    requirePermission(user, "aptitude:manage");
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveEmployeeCompetency(user, params.id) };
  });

  app.get("/employees/:id/aptitude", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.getEmployeeAptitude(user, params.id) };
  });
}

