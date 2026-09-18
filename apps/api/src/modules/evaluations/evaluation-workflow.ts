import type { EvaluationStatus, RoleName } from "@prisma/client";

const rhWorkflowRoles: RoleName[] = ["DEV", "ADMIN", "RH"];

export function canTransitionEvaluation(
  current: EvaluationStatus,
  next: EvaluationStatus,
  role: RoleName
): boolean {
  if (current === "ARCHIVED") {
    return false;
  }

  if (next === "IN_RH_REVIEW") {
    return current === "DRAFT" && rhWorkflowRoles.includes(role);
  }

  if (next === "APPROVED" || next === "REJECTED") {
    return current === "IN_RH_REVIEW" && rhWorkflowRoles.includes(role);
  }

  if (next === "ARCHIVED") {
    return rhWorkflowRoles.includes(role);
  }

  return false;
}
