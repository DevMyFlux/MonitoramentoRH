import type { WorkflowStatus } from "@prisma/client";

/**
 * Quem pode mudar a escala de uma situação para outra. A decisão é por PERMISSÃO, não pelo nome do perfil:
 *
 *   DRAFT      → IN_REVIEW   schedules:submit   (RH envia para aprovação)
 *   IN_REVIEW  → APPROVED    schedules:approve  (Aprovador)
 *   APPROVED   → PUBLISHED   schedules:publish  (só depois de aprovada)
 *   qualquer   → ARCHIVED    schedules:archive
 *
 * Não existe publicação "excepcional" que pule a aprovação: o antigo override de DEV nunca foi implementado e foi removido.
 */
export function canTransitionSchedule(
  current: WorkflowStatus,
  next: WorkflowStatus,
  permissions: readonly string[]
): boolean {
  const has = (code: string) => permissions.includes(code);

  if (current === "PUBLISHED" || current === "ARCHIVED") {
    return next === "ARCHIVED" && has("schedules:archive");
  }
  if (next === "IN_REVIEW") return current === "DRAFT" && has("schedules:submit");
  if (next === "APPROVED") return current === "IN_REVIEW" && has("schedules:approve");
  if (next === "PUBLISHED") return current === "APPROVED" && has("schedules:publish");
  if (next === "ARCHIVED") return has("schedules:archive");
  return false;
}
