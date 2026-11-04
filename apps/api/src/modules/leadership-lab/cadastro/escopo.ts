// Leadership Lab — o escopo do RH nos cadastros.
//
// A pergunta é "esta pessoa está numa operação que o RH enxerga?", e a resposta é a MESMA do resto
// do sistema: UserScope (empresa, operação, unidade), como na tela de colaboradores. Nada novo foi
// inventado aqui; só se reaproveitam `operationWhere` e `canAccessScope`.
//
// Falha fechado: RH sem nenhum escopo não enxerga ninguém.
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { operationWhere } from "../../identity/access.js";
import { canAccessScope } from "../../identity/scope-policy.js";

/** A operação do colaborador, no que o escopo precisa saber. */
export type OperacaoDoColaborador = { id: string; companyId: string; unitId: string };

/** Operações do escopo, ativas ou não: quem já é participante continua visível ao RH. */
export function operacoesDoEscopo(user: AuthenticatedUser): Prisma.OperationWhereInput {
  const escopo = { ...operationWhere(user) };
  delete escopo.status;
  return escopo;
}

/** Operações ATIVAS do escopo: é de onde sai quem pode ser cadastrado como participante. */
export function operacoesAtivasDoEscopo(user: AuthenticatedUser): Prisma.OperationWhereInput {
  return operationWhere(user);
}

/** O colaborador de uma operação do escopo? Vira o `dentroDoEscopoDoRh` da matriz. */
export function colaboradorNoEscopo(
  user: AuthenticatedUser,
  operacao: OperacaoDoColaborador
): boolean {
  return canAccessScope(user.scopes, {
    companyId: operacao.companyId,
    operationId: operacao.id,
    unitId: operacao.unitId
  });
}
