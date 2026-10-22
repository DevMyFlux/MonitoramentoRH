import type { FastifyInstance } from "fastify";
import { idParamsSchema, positionInputSchema, qlpVersionInputSchema } from "@my-flux/validation";
import { z } from "zod";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
import type { QlpRepository } from "./qlp-repository.js";

const transitionSchema = z.object({
  status: z.enum(["IN_REVIEW", "APPROVED", "ARCHIVED"])
});

export async function registerQlpRoutes(
  app: FastifyInstance,
  users: UserRepository,
  repository: QlpRepository
): Promise<void> {
  app.get("/qlp/versions", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listVersions(user) };
  });

  app.post("/qlp/versions", async (request) => {
    const user = await authenticateRequest(request, users);
    return {
      data: await repository.createVersion(user, qlpVersionInputSchema.parse(request.body))
    };
  });

  app.patch("/qlp/versions/:id/status", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    const payload = transitionSchema.parse(request.body);
    return { data: await repository.transition(user, params.id, payload.status) };
  });

  app.get("/qlp/versions/:id/coverage", async (request) => {
    const user = await authenticateRequest(request, users);
    const params = idParamsSchema.parse(request.params);
    return { data: await repository.coverage(user, params.id) };
  });

  app.get("/positions", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.listPositions(user) };
  });

  app.post("/positions", async (request) => {
    const user = await authenticateRequest(request, users);
    return { data: await repository.createPosition(user, positionInputSchema.parse(request.body)) };
  });
}
