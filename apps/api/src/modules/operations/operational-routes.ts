import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  clientInputSchema,
  companyInputSchema,
  contractInputSchema,
  idParamsSchema,
  jobFunctionInputSchema,
  obligationInputSchema,
  operationInputSchema,
  serviceInputSchema,
  unitInputSchema
} from "@my-flux/validation";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import { assertCanManageMasterData } from "./master-data-policy.js";
import type { OperationalRepository } from "./operational-repository.js";

export async function registerOperationalRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: OperationalRepository
): Promise<void> {
  app.get("/companies", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listCompanies(user) };
  });

  app.post("/companies", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return { data: await repository.createCompany(user, companyInputSchema.parse(request.body)) };
  });

  app.patch("/companies/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateCompany(
        user,
        params.id,
        companyInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/companies/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveCompany(user, params.id) };
  });

  app.get("/clients", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listClients(user) };
  });

  app.post("/clients", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return { data: await repository.createClient(user, clientInputSchema.parse(request.body)) };
  });

  app.patch("/clients/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateClient(
        user,
        params.id,
        clientInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/clients/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveClient(user, params.id) };
  });

  app.get("/units", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listUnits(user) };
  });

  app.post("/units", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return { data: await repository.createUnit(user, unitInputSchema.parse(request.body)) };
  });

  app.patch("/units/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateUnit(
        user,
        params.id,
        unitInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/units/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveUnit(user, params.id) };
  });

  app.get("/contracts", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listContracts(user) };
  });

  app.post("/contracts", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return { data: await repository.createContract(user, contractInputSchema.parse(request.body)) };
  });

  app.patch("/contracts/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateContract(
        user,
        params.id,
        contractInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/contracts/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveContract(user, params.id) };
  });

  app.get("/operations", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listOperations(user) };
  });

  app.post("/operations", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return {
      data: await repository.createOperation(user, operationInputSchema.parse(request.body))
    };
  });

  app.patch("/operations/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateOperation(
        user,
        params.id,
        operationInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/operations/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveOperation(user, params.id) };
  });

  app.get("/services", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listServices(user) };
  });

  app.post("/services", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return { data: await repository.createService(user, serviceInputSchema.parse(request.body)) };
  });

  app.patch("/services/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateService(
        user,
        params.id,
        serviceInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/services/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveService(user, params.id) };
  });

  app.get("/obligations", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listObligations(user) };
  });

  app.post("/obligations", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return {
      data: await repository.createObligation(user, obligationInputSchema.parse(request.body))
    };
  });

  app.patch("/obligations/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateObligation(
        user,
        params.id,
        obligationInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/obligations/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveObligation(user, params.id) };
  });

  app.get("/functions", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listJobFunctions(user) };
  });

  app.post("/functions", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    return {
      data: await repository.createJobFunction(user, jobFunctionInputSchema.parse(request.body))
    };
  });

  app.patch("/functions/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return {
      data: await repository.updateJobFunction(
        user,
        params.id,
        jobFunctionInputSchema.partial().parse(request.body)
      )
    };
  });

  app.delete("/functions/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    assertCanManageMasterData(user);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.archiveJobFunction(user, params.id) };
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
