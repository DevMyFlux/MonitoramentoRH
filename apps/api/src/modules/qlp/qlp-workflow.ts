import type { WorkflowStatus } from "@prisma/client";

/** `canManage` vem da permissão `qlp:manage`: aprovar e arquivar um QLP é de quem gerencia o QLP. */
export function canApproveQlp(canManage: boolean): boolean {
  return canManage;
}

export function canTransitionQlp(
  status: WorkflowStatus,
  next: WorkflowStatus,
  canManage: boolean
): boolean {
  if (next === "IN_REVIEW") {
    return status === "DRAFT";
  }

  if (next === "APPROVED") {
    return status === "IN_REVIEW" && canApproveQlp(canManage);
  }

  if (next === "ARCHIVED") {
    return canManage;
  }

  return false;
}
