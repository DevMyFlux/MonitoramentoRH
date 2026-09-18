import type { AuthenticatedUser, UserScope } from "@my-flux/types";
import type { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "./scope-policy.js";

export function assertRole(user: AuthenticatedUser, roles: string[]) {
  if (!roles.includes(user.role))
    throw new HttpError(403, "FORBIDDEN", "Perfil sem permissão para esta ação.");
}
export function operationWhere(user: AuthenticatedUser): Prisma.OperationWhereInput {
  if (user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal)) return { status: "ACTIVE" };
  return {
    status: "ACTIVE",
    OR: user.scopes
      .filter((s) => !s.isGlobal && (s.companyId || s.operationId || s.unitId))
      .map((s) => ({
        ...(s.companyId ? { companyId: s.companyId } : {}),
        ...(s.operationId ? { id: s.operationId } : {}),
        ...(s.unitId ? { unitId: s.unitId } : {})
      }))
  };
}
export async function scopedOperation(
  db: PrismaClient | Prisma.TransactionClient,
  user: AuthenticatedUser,
  id: string
) {
  const operation = await db.operation.findUnique({ where: { id } });
  if (!operation || operation.status !== "ACTIVE")
    throw new HttpError(404, "OPERATION_NOT_FOUND", "Operação não encontrada.");
  if (
    user.role !== "DEV" &&
    !canAccessScope(user.scopes, {
      companyId: operation.companyId,
      operationId: id,
      unitId: operation.unitId
    })
  )
    throw new HttpError(403, "SCOPE_FORBIDDEN", "Operação fora do seu escopo.");
  return operation;
}
export function assertDelegatedScopes(actor: AuthenticatedUser, scopes: UserScope[]) {
  if (actor.role === "DEV") return;
  if (
    !scopes.length ||
    scopes.some(
      (scope) =>
        scope.isGlobal ||
        !actor.scopes.some(
          (parent) =>
            !parent.isGlobal &&
            Boolean(parent.companyId || parent.operationId || parent.unitId) &&
            (!parent.companyId || parent.companyId === scope.companyId) &&
            (!parent.operationId || parent.operationId === scope.operationId) &&
            (!parent.unitId || parent.unitId === scope.unitId)
        )
    )
  )
    throw new HttpError(
      403,
      "SCOPE_ESCALATION",
      "Só é permitido delegar escopos contidos no seu acesso."
    );
}
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
