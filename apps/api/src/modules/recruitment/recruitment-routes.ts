import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { assertRole, json, operationWhere, scopedOperation } from "../identity/access.js";
import { assertAdmissionTransition } from "./recruitment-workflow.js";

const idSchema = z.object({ id: z.string().uuid() });
const requestSchema = z.object({
  positionId: z.string().uuid(),
  reason: z.string().min(5).max(1000),
  desiredDate: z.string().datetime()
});
const candidateSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().min(2).max(180),
  email: z.string().email().optional()
});
const transitionSchema = z.object({
  stage: z.enum([
    "RECRUITING",
    "SELECTED",
    "DOCUMENTATION",
    "MEDICAL_EXAM",
    "ADMISSION_SCHEDULED",
    "ADMITTED",
    "WITHDRAWN",
    "CANCELLED"
  ]),
  revision: z.number().int().positive(),
  reason: z.string().min(5).max(1000),
  admissionDate: z.string().datetime().optional(),
  documentsChecked: z.boolean().optional(),
  medicalCleared: z.boolean().optional(),
  identifier: z.string().min(1).max(80).optional()
});

export async function registerRecruitmentRoutes(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
) {
  app.get("/recruitment/requests", async (req) => {
    const user = await authenticateRequest(req, users);
    return {
      data: await db.recruitmentRequest.findMany({
        where: { position: { operation: operationWhere(user) } },
        include: {
          position: { include: { function: true } },
          applications: { include: { history: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    };
  });
  app.post("/recruitment/requests", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const input = requestSchema.parse(req.body);
    return {
      data: await db.$transaction(
        async (tx) => {
          const position = await tx.position.findUnique({
            where: { id: input.positionId },
            include: { qlpVersion: true }
          });
          if (
            !position ||
            position.status !== "ACTIVE" ||
            position.qlpVersion?.status !== "APPROVED"
          )
            throw new HttpError(
              409,
              "APPROVED_POSITION_REQUIRED",
              "Selecione uma posição de QLP aprovado."
            );
          const op = await scopedOperation(tx, user, position.operationId);
          if (
            await tx.recruitmentRequest.count({
              where: { positionId: position.id, status: { in: ["REQUESTED", "RECRUITING"] } }
            })
          )
            throw new HttpError(
              409,
              "REQUEST_EXISTS",
              "Já existe recrutamento aberto para esta posição."
            );
          const row = await tx.recruitmentRequest.create({
            data: { ...input, desiredDate: new Date(input.desiredDate), createdBy: user.id }
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              userRole: user.role,
              action: "CREATE",
              entity: "RecruitmentRequest",
              entityId: row.id,
              operationId: op.id,
              companyId: op.companyId,
              unitId: op.unitId,
              after: json(row),
              origin: "api"
            }
          });
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    };
  });
  app.post("/recruitment/candidates", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const input = candidateSchema.parse(req.body);
    const request = await db.recruitmentRequest.findUnique({
      where: { id: input.requestId },
      include: { position: true }
    });
    if (!request || !["REQUESTED", "RECRUITING"].includes(request.status))
      throw new HttpError(409, "REQUEST_CLOSED", "Requisição inexistente ou encerrada.");
    const op = await scopedOperation(db, user, request.position.operationId);
    return {
      data: await db.$transaction(async (tx) => {
        const row = await tx.candidateApplication.create({
          data: {
            requestId: input.requestId,
            name: input.name,
            email: input.email ?? null,
            createdBy: user.id,
            history: {
              create: { toStage: "REQUESTED", reason: "Candidatura registrada", createdBy: user.id }
            }
          }
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            userRole: user.role,
            action: "CREATE",
            entity: "CandidateApplication",
            entityId: row.id,
            operationId: op.id,
            companyId: op.companyId,
            unitId: op.unitId,
            after: json(row),
            origin: "api"
          }
        });
        return row;
      })
    };
  });
  app.post("/recruitment/candidates/:id/transition", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const { id } = idSchema.parse(req.params);
    const input = transitionSchema.parse(req.body);
    return {
      data: await db.$transaction(
        async (tx) => {
          const before = await tx.candidateApplication.findUnique({
            where: { id },
            include: { request: { include: { position: true } } }
          });
          if (!before)
            throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidatura não encontrada.");
          const position = before.request.position;
          const op = await scopedOperation(tx, user, position.operationId);
          if (before.revision !== input.revision)
            throw new HttpError(
              409,
              "STALE_VERSION",
              "Processo alterado por outra pessoa. Recarregue."
            );
          const date = input.admissionDate ? new Date(input.admissionDate) : before.admissionDate;
          const documents = input.documentsChecked ?? before.documentsChecked;
          const medical = input.medicalCleared ?? before.medicalCleared;
          assertAdmissionTransition(before.stage, input.stage, documents, medical, date);
          let employeeId = before.employeeId;
          if (input.stage === "ADMITTED") {
            if (!input.identifier || !date)
              throw new HttpError(
                400,
                "IDENTIFIER_REQUIRED",
                "Informe a matrícula para efetivar a admissão."
              );
            if (
              await tx.employeeAssignment.count({
                where: {
                  positionId: position.id,
                  status: "ACTIVE",
                  OR: [{ endsAt: null }, { endsAt: { gt: date } }]
                }
              })
            )
              throw new HttpError(
                409,
                "POSITION_OCCUPIED",
                "A posição já possui titular nesta vigência."
              );
            const employee = await tx.employee.create({
              data: {
                operationId: op.id,
                functionId: position.functionId,
                name: before.name,
                identifier: input.identifier,
                admissionDate: date,
                shift: position.shift,
                team: position.team,
                workRegime: position.workRegime,
                createdBy: user.id,
                assignments: {
                  create: { positionId: position.id, startsAt: date, createdBy: user.id }
                },
                history: {
                  create: {
                    action: "ADMITTED",
                    after: json({
                      candidateId: id,
                      requestId: before.requestId,
                      positionId: position.id
                    }),
                    createdBy: user.id
                  }
                }
              }
            });
            employeeId = employee.id;
            await tx.recruitmentRequest.update({
              where: { id: before.requestId },
              data: { status: "FILLED" }
            });
          }
          const row = await tx.candidateApplication.update({
            where: { id, revision: input.revision },
            data: {
              stage: input.stage,
              revision: { increment: 1 },
              admissionDate: date,
              documentsChecked: documents,
              medicalCleared: medical,
              employeeId,
              history: {
                create: {
                  fromStage: before.stage,
                  toStage: input.stage,
                  reason: input.reason,
                  createdBy: user.id
                }
              }
            }
          });
          if (input.stage === "RECRUITING")
            await tx.recruitmentRequest.update({
              where: { id: before.requestId },
              data: { status: "RECRUITING" }
            });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              userRole: user.role,
              action: "UPDATE",
              entity: "CandidateApplication",
              entityId: id,
              operationId: op.id,
              companyId: op.companyId,
              unitId: op.unitId,
              before: json(before),
              after: json(row),
              justification: input.reason,
              origin: "api"
            }
          });
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    };
  });
}
