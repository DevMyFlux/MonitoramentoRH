import type { FastifyInstance, FastifyRequest } from "fastify";
import { idParamsSchema, importPreviewRequestSchema } from "@my-flux/validation";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";
import { assertCanImport } from "./import-policy.js";
import { parseImportFile } from "./import-parser.js";
import type { ImportRepository } from "./import-repository.js";

export async function registerImportRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: ImportRepository
): Promise<void> {
  app.get("/imports", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.list(user) };
  });

  app.post("/imports", async (request) => {
    const user = await authenticateRequest(request, users);
    const payload = importPreviewRequestSchema.parse(request.body);
    assertCanImport(user, payload.type);
    const parsed = parseImportFile(
      payload.type,
      payload.fileName,
      payload.contentBase64,
      payload.mapping
    );

    return {
      data: await repository.create(user, {
        type: payload.type,
        fileName: payload.fileName,
        fileSize: parsed.fileSize,
        checksum: parsed.checksum,
        rows: parsed.rows,
        issues: parsed.issues
      })
    };
  });

  app.get("/imports/:id", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.get(params.id, user) };
  });

  app.get("/imports/:id/issues", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.issues(params.id, user) };
  });

  app.post("/imports/:id/commit", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.commit(user, params.id) };
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
