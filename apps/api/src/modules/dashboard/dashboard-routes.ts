import type { FastifyInstance } from "fastify";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
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
