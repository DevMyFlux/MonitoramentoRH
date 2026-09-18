import { registerRecruitmentRoutes } from "./modules/recruitment/recruitment-routes.js";
import { registerWorkspaceRoutes } from "./modules/operations/workspace-routes.js";
import cors from "@fastify/cors";
import { apiPrefix } from "@my-flux/config";
import type { ApiErrorShape, HealthStatus } from "@my-flux/types";
import { healthStatusSchema } from "@my-flux/validation";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "./lib/http-error.js";
import { prisma } from "./lib/prisma.js";
import { AptitudeRepository } from "./modules/aptitude/aptitude-repository.js";
import { registerAptitudeRoutes } from "./modules/aptitude/aptitude-routes.js";
import { AuditRepository } from "./modules/audit/audit-repository.js";
import { registerAuditRoutes } from "./modules/audit/audit-routes.js";
import { registerAuthRoutes } from "./modules/auth/auth-routes.js";
import { registerBettingRoutes } from "./modules/betting/odds-routes.js";
import { CalendarRepository } from "./modules/calendar/calendar-repository.js";
import { registerCalendarRoutes } from "./modules/calendar/calendar-routes.js";
import { DashboardRepository } from "./modules/dashboard/dashboard-repository.js";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard-routes.js";
import { EmployeeRepository } from "./modules/employees/employee-repository.js";
import { registerEmployeeRoutes } from "./modules/employees/employee-routes.js";
import { EvaluationRepository } from "./modules/evaluations/evaluation-repository.js";
import { registerEvaluationRoutes } from "./modules/evaluations/evaluation-routes.js";
import { ImportRepository } from "./modules/imports/import-repository.js";
import { registerImportRoutes } from "./modules/imports/import-routes.js";
import { OperationalRepository } from "./modules/operations/operational-repository.js";
import { registerOperationalRoutes } from "./modules/operations/operational-routes.js";
import { QlpRepository } from "./modules/qlp/qlp-repository.js";
import { registerQlpRoutes } from "./modules/qlp/qlp-routes.js";
import { ReportRepository } from "./modules/reports/report-repository.js";
import { registerReportRoutes } from "./modules/reports/report-routes.js";
import { ScheduleRepository } from "./modules/scheduling/schedule-repository.js";
import { registerScheduleRoutes } from "./modules/scheduling/schedule-routes.js";
import { UserRepository } from "./modules/users/user-repository.js";

const version = "0.0.0";

function getErrorStatusCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;

    if (typeof statusCode === "number") {
      return statusCode;
    }
  }

  return 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Requisicao invalida.";
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { redact: ["req.headers.authorization", "req.headers.cookie"] }
  });

  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5175",
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    return payload;
  });

  app.setErrorHandler((error, _request, reply) => {
    if (typeof error === 'object' && error && 'code' in error && ['P2002','P2003','P2025','P2034','P2004'].includes(String(error.code))) return reply.status(409).send({code:'DATA_CONFLICT',message:'Conflito de dados, vínculo ou atualização simultânea. Recarregue e verifique o registro.'});
    if (error instanceof HttpError) {
      const payload: ApiErrorShape = {
        code: error.code,
        message: error.message,
        details: error.details
      };

      return reply.status(error.statusCode).send(payload);
    }

    if (error instanceof ZodError) {
      const payload: ApiErrorShape = {
        code: "VALIDATION_ERROR",
        message: "Payload invalido.",
        details: { issues: error.issues }
      };

      return reply.status(400).send(payload);
    }

    const statusCode = getErrorStatusCode(error);
    const payload: ApiErrorShape = {
      code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: statusCode >= 500 ? "Erro interno do servidor." : getErrorMessage(error),
      details: {}
    };

    return reply.status(statusCode).send(payload);
  });

  app.get(`${apiPrefix}/health`, async () => {
    const health: HealthStatus = {
      service: "my-flux-api",
      status: "ok",
      version
    };

    return healthStatusSchema.parse(health);
  });

  const attempts = new Map<string, {count:number; reset:number}>();
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith(`${apiPrefix}/auth/`) && request.method === 'POST') {
      const now=Date.now(); const key=request.ip; const previous=attempts.get(key);
      const entry=previous && previous.reset>now ? previous : {count:0,reset:now+60000};
      entry.count++; attempts.set(key,entry);
      if (attempts.size > 10000) for(const [k,v] of attempts) if(v.reset<now)attempts.delete(k);
      if(entry.count>30)return reply.status(429).send({code:'RATE_LIMITED',message:'Muitas tentativas. Aguarde um minuto.'});
    }
  });
  const userRepository = new UserRepository(prisma);
  const operationalRepository = new OperationalRepository(prisma);
  const employeeRepository = new EmployeeRepository(prisma);
  const importRepository = new ImportRepository(prisma, employeeRepository);
  const qlpRepository = new QlpRepository(prisma);
  const aptitudeRepository = new AptitudeRepository(prisma);
  const evaluationRepository = new EvaluationRepository(prisma);
  const calendarRepository = new CalendarRepository(prisma);
  const scheduleRepository = new ScheduleRepository(prisma);
  const dashboardRepository = new DashboardRepository(prisma);
  const reportRepository = new ReportRepository(prisma);
  const auditRepository = new AuditRepository(prisma);
  await app.register(async (versionedApp) => registerAuthRoutes(versionedApp, userRepository), {
    prefix: apiPrefix
  });
  await app.register(async (versionedApp) => registerBettingRoutes(versionedApp), {
    prefix: apiPrefix
  });
  await app.register(
    async (versionedApp) =>
      registerOperationalRoutes(versionedApp, userRepository, operationalRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) => registerImportRoutes(versionedApp, userRepository, importRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) =>
      registerEmployeeRoutes(versionedApp, userRepository, employeeRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) => registerQlpRoutes(versionedApp, userRepository, qlpRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) =>
      registerAptitudeRoutes(versionedApp, userRepository, aptitudeRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) =>
      registerEvaluationRoutes(versionedApp, userRepository, evaluationRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) =>
      registerCalendarRoutes(versionedApp, userRepository, calendarRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) =>
      registerScheduleRoutes(versionedApp, userRepository, scheduleRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) =>
      registerDashboardRoutes(versionedApp, userRepository, dashboardRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) => registerReportRoutes(versionedApp, userRepository, reportRepository),
    {
      prefix: apiPrefix
    }
  );
  await app.register(
    async (versionedApp) => registerAuditRoutes(versionedApp, userRepository, auditRepository),
    {
      prefix: apiPrefix
    }
  );

  await app.register(async a => registerRecruitmentRoutes(a, userRepository, prisma), { prefix: apiPrefix });
  await app.register(async a => registerWorkspaceRoutes(a, userRepository, prisma), { prefix: apiPrefix });
  return app;
}
