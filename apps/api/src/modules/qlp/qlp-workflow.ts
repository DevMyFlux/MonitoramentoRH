import type { Role } from "@my-flux/types";
import type { WorkflowStatus } from "@prisma/client";

export function canApproveQlp(role: Role): boolean {
  return role === "DEV" || role === "ADMIN";
}

export function canTransitionQlp(
  status: WorkflowStatus,
  next: WorkflowStatus,
  role: Role
): boolean {
  if (next === "IN_REVIEW") {
    return status === "DRAFT";
  }

  if (next === "APPROVED") {
    return status === "IN_REVIEW" && canApproveQlp(role);
  }

  if (next === "ARCHIVED") {
    return role === "DEV" || role === "ADMIN";
  }

  return false;
}
