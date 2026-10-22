import {
  developmentPlanInputSchema,
  employeeEvaluationInputSchema,
  evaluationCriterionInputSchema,
  evaluationTransitionInputSchema,
  idParamsSchema
} from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import type { EvaluationRepository } from "./evaluation-repository.js";

export async function registerEvaluationRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: EvaluationRepository
): Promise<void> {
  app.get("/evaluation-criteria", async (request) => {
    await authenticateRequest(request, users); // dado de referência, mas só para quem está logado
    return { data: await repository.listCriteria() };
  });

  app.post("/evaluation-criteria", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEvaluations(user.role);
    return {
      data: await repository.createCriterion(
        user,
        evaluationCriterionInputSchema.parse(request.body)
      )
    };
  });

  app.delete("/evaluation-criteria/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEvaluations(user.role);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveCriterion(user, params.id) };
  });

  app.get("/evaluations", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listEvaluations(user) };
  });

  app.post("/evaluations", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEvaluations(user.role);
    return {
      data: await repository.createEvaluation(
        user,
        employeeEvaluationInputSchema.parse(request.body)
      )
    };
  });

  app.patch("/evaluations/:id/status", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEvaluations(user.role);
    const params = idParamsSchema.parse(request.params);
    const payload = evaluationTransitionInputSchema.parse(request.body);
    return {
      data: await repository.transitionEvaluation(user, params.id, payload.status, payload.reason)
    };
  });

  app.get("/development-plans", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listDevelopmentPlans(user) };
  });

  app.post("/development-plans", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageEvaluations(user.role);
    return {
      data: await repository.createDevelopmentPlan(
        user,
        developmentPlanInputSchema.parse(request.body)
      )
    };
  });
}

function assertCanManageEvaluations(role: string) {
  if (role === "DEV" || role === "ADMIN" || role === "RH") {
    return;
  }

  throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para gerenciar avaliacoes.");
}
