// Leadership Lab — trilha de auditoria dos cadastros, no AuditLog do sistema de RH (a mesma tabela
// e o mesmo formato dos demais módulos). Gravada na MESMA transação da mudança: se a mudança
// desfaz, o registro desfaz junto, e nenhuma mudança fica sem registro.
import type { AuditAction, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";

export type RegistroDeAuditoria = {
  acao: AuditAction;
  /** Ex.: "LabParticipante", "LabTurma", "LabMolde". */
  entidade: string;
  entidadeId: string;
  /** A operação do colaborador, quando a mudança é sobre uma pessoa. */
  operacao?: { id: string; companyId: string; unitId: string } | undefined;
  antes?: unknown;
  depois?: unknown;
  /** A justificativa dada por quem decidiu, quando a decisão exige uma (AuditLog.justification). */
  justificativa?: string | undefined;
};

function json(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

export async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  user: AuthenticatedUser,
  registro: RegistroDeAuditoria
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: user.id,
      userRole: user.role,
      action: registro.acao,
      entity: registro.entidade,
      entityId: registro.entidadeId,
      ...(registro.operacao
        ? {
            operationId: registro.operacao.id,
            companyId: registro.operacao.companyId,
            unitId: registro.operacao.unitId
          }
        : {}),
      ...(registro.antes !== undefined ? { before: json(registro.antes) } : {}),
      ...(registro.depois !== undefined ? { after: json(registro.depois) } : {}),
      ...(registro.justificativa !== undefined ? { justification: registro.justificativa } : {}),
      origin: "api"
    }
  });
}
