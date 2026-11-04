// Leadership Lab — as visões dos cadastros. Cada campo é copiado de propósito: o que não está aqui
// não sai. Nenhuma visão traz resultado de teste, e-mail de quem não é o próprio participante nem
// dado do colaborador além de nome, matrícula, cargo e operação.
import {
  type LabColaboradorDoCadastro,
  type LabMoldeNivel,
  type LabParticipanteDoCadastro,
  labMoldeNiveis
} from "@my-flux/shared";
import type { Prisma } from "@prisma/client";

const niveisConhecidos: readonly string[] = labMoldeNiveis;

/** O banco já recusa nível desconhecido (CHECK); isto só estreita o tipo e falha alto se mudar. */
export function nivelDoMolde(valor: string): LabMoldeNivel {
  if (!niveisConhecidos.includes(valor)) throw new Error(`Nível de molde desconhecido: ${valor}`);
  return valor as LabMoldeNivel;
}

/** O que se lê do colaborador para montar a visão (e para o escopo: a operação). */
export const selecaoDoColaborador = {
  id: true,
  name: true,
  identifier: true,
  operation: { select: { id: true, name: true, companyId: true, unitId: true } },
  function: {
    select: {
      name: true,
      labMolde: {
        select: { molde: { select: { nivel: true, nome: true, ativo: true, tempoLimiteS: true } } }
      }
    }
  }
} satisfies Prisma.EmployeeSelect;
export type ColaboradorLido = Prisma.EmployeeGetPayload<{ select: typeof selecaoDoColaborador }>;

export const selecaoDoParticipante = {
  id: true,
  ativo: true,
  criadoEm: true,
  user: { select: { id: true, name: true, email: true } },
  employee: { select: selecaoDoColaborador }
} satisfies Prisma.LabParticipanteSelect;
export type ParticipanteLido = Prisma.LabParticipanteGetPayload<{
  select: typeof selecaoDoParticipante;
}>;

export function visaoDoColaborador(c: ColaboradorLido): LabColaboradorDoCadastro {
  const molde = c.function?.labMolde?.molde ?? null;
  return {
    id: c.id,
    nome: c.name,
    identificador: c.identifier,
    cargo: c.function?.name ?? null,
    operacao: c.operation.name,
    molde:
      molde === null
        ? null
        : {
            nivel: nivelDoMolde(molde.nivel),
            nome: molde.nome,
            // Liberado = ativo e com tempo: o banco recusa um sem o outro, e a tela diz o mesmo.
            liberado: molde.ativo && molde.tempoLimiteS !== null
          }
  };
}

export function visaoDoParticipante(p: ParticipanteLido): LabParticipanteDoCadastro {
  return {
    id: p.id,
    ativo: p.ativo,
    vinculadoEm: p.criadoEm.toISOString(),
    colaborador: visaoDoColaborador(p.employee),
    usuario: { id: p.user.id, nome: p.user.name, email: p.user.email }
  };
}
