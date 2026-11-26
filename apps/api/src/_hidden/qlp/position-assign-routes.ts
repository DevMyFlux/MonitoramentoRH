// Posições do QLP (módulo OCULTO): alocar um colaborador a uma posição de QLP aprovado. Saiu de
// workspace-routes.ts junto com o resto do QLP (veja docs/modulos-ocultos.md). Só é registrada
// quando o módulo "qlp" está ativo em packages/shared/src/modules.ts.
import { AptitudeRepository } from "../../modules/aptitude/aptitude-repository.js";
import { authenticateRequest } from "../../modules/auth/auth-routes.js";
import { assertRole, json, scopedOperation } from "../../modules/identity/access.js";
import type { UserRepository } from "../../modules/users/user-repository.js";
import { HttpError } from "../../lib/http-error.js";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function registerPositionAssignRoutes(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
) {
  const ids = z.object({ id: z.string().uuid() });
  app.post("/positions/:id/assign", async (req) => {
    const user = await authenticateRequest(req, users);
    assertRole(user, ["DEV", "ADMIN", "RH"]);
    const { id } = ids.parse(req.params);
    const input = z
      .object({
        employeeId: z.string().uuid(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime().optional()
      })
      .parse(req.body);
    const position = await db.position.findUnique({ where: { id }, include: { qlpVersion: true } });
    if (!position || position.qlpVersion?.status !== "APPROVED")
      throw new HttpError(
        409,
        "APPROVED_POSITION_REQUIRED",
        "Posição precisa pertencer a um QLP aprovado."
      );
    const op = await scopedOperation(db, user, position.operationId);
    const employee = await db.employee.findUnique({ where: { id: input.employeeId } });
    if (
      !employee ||
      employee.operationId !== op.id ||
      employee.functionId !== position.functionId ||
      employee.status !== "ACTIVE" ||
      !employee.admissionDate ||
      employee.admissionDate > new Date(input.startsAt)
    )
      throw new HttpError(
        409,
        "EMPLOYEE_INELIGIBLE",
        "Colaborador incompatível ou não ativo na vigência."
      );
    if (input.endsAt && input.endsAt <= input.startsAt)
      throw new HttpError(400, "INVALID_INTERVAL", "Fim deve ser posterior ao início.");
    const aptitude = await new AptitudeRepository(db).getEmployeeAptitude(user, employee.id);
    if (aptitude.status === "RED")
      throw new HttpError(409, "APTITUDE_BLOCKED", "Requisito crítico não atendido.", {
        reasonCodes: aptitude.reasonCodes
      });
    return {
      data: await db.$transaction(async (tx) => {
        const row = await tx.employeeAssignment.create({
          data: {
            positionId: id,
            employeeId: employee.id,
            startsAt: new Date(input.startsAt),
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            createdBy: user.id
          }
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            userRole: user.role,
            action: "CREATE",
            entity: "EmployeeAssignment",
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
}
