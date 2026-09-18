import type { RoleName, WorkflowStatus } from "@prisma/client";

export function canTransitionSchedule(
  current: WorkflowStatus,
  next: WorkflowStatus,
  role: RoleName,
  hasOverride: boolean
): boolean {
  if (current === "PUBLISHED" || current === "ARCHIVED") {
    return next === "ARCHIVED" && (role === "ADMIN" || role === "DEV");
  }

  void hasOverride;

  if (next === "IN_REVIEW") {
    return current === "DRAFT" && (role === "RH" || role === "ADMIN" || role === "DEV");
  }

  if (next === "APPROVED") {
    return current === "IN_REVIEW" && (role === "ADMIN" || role === "DEV");
  }

  if (next === "PUBLISHED") {
    return current === "APPROVED" && (role === "ADMIN" || role === "DEV");
  }

  if (next === "ARCHIVED") {
    return role === "ADMIN" || role === "DEV";
  }

  return false;
}
