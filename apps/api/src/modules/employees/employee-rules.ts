import type { EmployeeStatus } from "@prisma/client";

export function countsAsCurrentHeadcount(
  status: EmployeeStatus,
  admissionDate: Date | null,
  today: Date
): boolean {
  if (status !== "ACTIVE") {
    return false;
  }

  if (admissionDate && admissionDate > today) {
    return false;
  }

  return true;
}
