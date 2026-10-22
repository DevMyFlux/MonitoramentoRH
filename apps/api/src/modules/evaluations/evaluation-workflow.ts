import type { EvaluationStatus } from "@prisma/client";

/**
 * Transições do fluxo de avaliação. `canManage` vem da permissão `evaluations:manage` (e não do nome do perfil):
 * quem a tem conduz a avaliação pelas etapas de análise do RH.
 */
export function canTransitionEvaluation(
  current: EvaluationStatus,
  next: EvaluationStatus,
  canManage: boolean
): boolean {
  if (current === "ARCHIVED") {
    return false;
  }

  if (next === "IN_RH_REVIEW") {
    return current === "DRAFT" && canManage;
  }

  if (next === "APPROVED" || next === "REJECTED") {
    return current === "IN_RH_REVIEW" && canManage;
  }

  if (next === "ARCHIVED") {
    return canManage;
  }

  return false;
}
