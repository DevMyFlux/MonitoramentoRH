import { reportKindSchema } from "@my-flux/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import type { ReportRepository } from "./report-repository.js";

const reportParamsSchema = z.object({
  kind: reportKindSchema
});

export async function registerReportRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: ReportRepository
): Promise<void> {
  app.get("/reports/:kind.xlsx", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = reportParamsSchema.parse(request.params);
    const report =
      params.kind === "INCONSISTENCIES"
        ? await repository.inconsistencies(user)
        : await repository.gaps(user);

    return { data: report };
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
