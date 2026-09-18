import type { FastifyInstance, FastifyRequest } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import type { DashboardRepository } from "./dashboard-repository.js";

export async function registerDashboardRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: DashboardRepository
): Promise<void> {
  app.get("/dashboard/summary", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.summary(user) };
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
