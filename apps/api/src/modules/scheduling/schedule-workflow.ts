import type { WorkflowStatus } from "@prisma/client";

/**
 * Quem pode mudar a escala de uma situação para outra. A decisão é por PERMISSÃO, não pelo nome do perfil:
 *
 *   DRAFT | REJECTED → IN_REVIEW   schedules:submit   (RH envia, ou reenvia depois de corrigir)
 *   IN_REVIEW        → APPROVED    schedules:approve  (Aprovador)
 *   IN_REVIEW        → REJECTED    schedules:reject   (Aprovador, com motivo obrigatório)
 *   APPROVED         → PUBLISHED   schedules:publish  (só depois de aprovada)
 *   qualquer         → ARCHIVED    schedules:archive
 *
 * Uma escala reprovada volta a ser editável na mesma versão e pode ser reenviada. Não existe publicação que pule a
 * aprovação: o antigo override de DEV nunca foi implementado e foi removido.
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
  if (next === "IN_REVIEW") {
    return (current === "DRAFT" || current === "REJECTED") && has("schedules:submit");
  }
  if (next === "APPROVED") return current === "IN_REVIEW" && has("schedules:approve");
  if (next === "REJECTED") return current === "IN_REVIEW" && has("schedules:reject");
  if (next === "PUBLISHED") return current === "APPROVED" && has("schedules:publish");
  if (next === "ARCHIVED") return has("schedules:archive");
  return false;
}

/** Situações em que o conteúdo da escala ainda pode ser editado na própria versão. */
export function isEditableInPlace(status: WorkflowStatus): boolean {
  return status === "DRAFT" || status === "REJECTED";
}
