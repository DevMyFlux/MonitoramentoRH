import { reportKindSchema } from "@my-flux/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { UserRepository } from "../users/user-repository.js";
import { authenticateRequest } from "../auth/authenticate.js";
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
