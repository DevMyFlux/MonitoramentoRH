// Leadership Lab — as visões da curadoria. Cada campo é copiado de propósito: o que não está aqui
// não sai. O participante nunca recebe quem decidiu a contestação dele; o curador nunca recebe o
// que o serviço de IA devolveu (só a avaliação já gravada, e só na ficha de um teste concluído).
import {
  type LabAlertaCor,
  type LabAlertaDoCurador,
  type LabAlertaStatus,
  type LabContestacaoDoCurador,
  type LabContestacaoPropria,
  type LabContestacaoStatus,
  type LabContribuicaoDoCurador,
  type LabContribuicaoStatus,
  type LabParticipanteResumido,
  type LabStatusValidacao,
  labAlertaCores,
  labAlertaStatus,
  labContestacaoStatus,
  labContribuicaoStatus,
  labStatusValidacao
} from "@my-flux/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** O banco já recusa valor fora da lista (CHECK); isto só estreita o tipo e falha alto se mudar. */
export function dentroDe<T extends string>(
  valores: readonly T[],
  valor: string,
  rotulo: string
): T {
  if (!(valores as readonly string[]).includes(valor)) {
    throw new Error(`${rotulo} desconhecido: ${valor}`);
  }
  return valor as T;
}

export const statusDeValidacao = (v: string): LabStatusValidacao =>
  dentroDe(labStatusValidacao, v, "Status de validação");

// ---------------------------------------------------------------------------
// Participante
// ---------------------------------------------------------------------------

/** O participante no que o curador precisa para reconhecê-lo, e a operação (para auditoria). */
export const selecaoDoParticipanteResumido = {
  id: true,
  employee: {
    select: {
      name: true,
      identifier: true,
      function: { select: { name: true } },
      operation: { select: { id: true, name: true, companyId: true, unitId: true } }
    }
  }
} satisfies Prisma.LabParticipanteSelect;
export type ParticipanteResumidoLido = Prisma.LabParticipanteGetPayload<{
  select: typeof selecaoDoParticipanteResumido;
}>;

export function participanteResumido(p: ParticipanteResumidoLido): LabParticipanteResumido {
  return {
    id: p.id,
    nome: p.employee.name,
    identificador: p.employee.identifier,
    cargo: p.employee.function?.name ?? null,
    operacao: p.employee.operation.name
  };
}

// ---------------------------------------------------------------------------
// Nomes de quem decidiu (o curador vê; o participante nunca)
// ---------------------------------------------------------------------------

export async function carregarNomes(
  db: Db,
  ids: ReadonlyArray<string | null>
): Promise<ReadonlyMap<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unicos.length === 0) return new Map();
  const linhas = await db.user.findMany({
    where: { id: { in: unicos } },
    select: { id: true, name: true }
  });
  return new Map(linhas.map((u) => [u.id, u.name]));
}

const nomeDe = (nomes: ReadonlyMap<string, string>, id: string | null) =>
  id === null ? null : (nomes.get(id) ?? null);

// ---------------------------------------------------------------------------
// Alerta
// ---------------------------------------------------------------------------

export const selecaoDoAlerta = {
  id: true,
  cor: true,
  status: true,
  criadoEm: true,
  tratadoEm: true,
  tratadoPor: true,
  nota: true,
  skill: { select: { nome: true } },
  turno: { select: { numero: true } },
  sessao: {
    select: {
      id: true,
      status: true,
      participante: { select: selecaoDoParticipanteResumido },
      resultado: { select: { id: true } }
    }
  }
} satisfies Prisma.LabAlertaSelect;
export type AlertaLido = Prisma.LabAlertaGetPayload<{ select: typeof selecaoDoAlerta }>;

export function visaoDoAlerta(
  a: AlertaLido,
  nomes: ReadonlyMap<string, string>
): LabAlertaDoCurador {
  return {
    id: a.id,
    cor: dentroDe<LabAlertaCor>(labAlertaCores, a.cor, "Cor de alerta"),
    status: dentroDe<LabAlertaStatus>(labAlertaStatus, a.status, "Status de alerta"),
    criadoEm: a.criadoEm.toISOString(),
    skillNome: a.skill?.nome ?? null,
    situacao: a.turno?.numero ?? null,
    participante: participanteResumido(a.sessao.participante),
    sessaoId: a.sessao.id,
    resultadoId: a.sessao.resultado?.id ?? null,
    testeConcluido: a.sessao.status === "concluida",
    tratadoEm: a.tratadoEm?.toISOString() ?? null,
    tratadoPor: nomeDe(nomes, a.tratadoPor),
    nota: a.nota
  };
}

// ---------------------------------------------------------------------------
// Contribuição
// ---------------------------------------------------------------------------

export const selecaoDaContribuicao = {
  id: true,
  texto: true,
  status: true,
  criadoEm: true,
  decididoEm: true,
  decididoPor: true,
  turno: { select: { numero: true } },
  sessao: {
    select: {
      id: true,
      status: true,
      participante: { select: selecaoDoParticipanteResumido },
      resultado: { select: { id: true } }
    }
  }
} satisfies Prisma.LabContribuicaoSelect;
export type ContribuicaoLida = Prisma.LabContribuicaoGetPayload<{
  select: typeof selecaoDaContribuicao;
}>;

export function visaoDaContribuicao(
  c: ContribuicaoLida,
  nomes: ReadonlyMap<string, string>
): LabContribuicaoDoCurador {
  return {
    id: c.id,
    texto: c.texto,
    status: dentroDe<LabContribuicaoStatus>(
      labContribuicaoStatus,
      c.status,
      "Status de contribuição"
    ),
    criadoEm: c.criadoEm.toISOString(),
    situacao: c.turno.numero,
    participante: participanteResumido(c.sessao.participante),
    sessaoId: c.sessao.id,
    resultadoId: c.sessao.resultado?.id ?? null,
    testeConcluido: c.sessao.status === "concluida",
    decididoEm: c.decididoEm?.toISOString() ?? null,
    decididoPor: nomeDe(nomes, c.decididoPor)
  };
}

// ---------------------------------------------------------------------------
// Contestação
// ---------------------------------------------------------------------------

export const selecaoDaContestacao = {
  id: true,
  ponto: true,
  motivo: true,
  status: true,
  criadoEm: true,
  decididoEm: true,
  decididoPor: true,
  notaDecisao: true,
  resultado: {
    select: {
      id: true,
      statusValidacao: true,
      sessao: { select: { id: true, participante: { select: selecaoDoParticipanteResumido } } }
    }
  }
} satisfies Prisma.LabContestacaoSelect;
export type ContestacaoLida = Prisma.LabContestacaoGetPayload<{
  select: typeof selecaoDaContestacao;
}>;

export function visaoDaContestacao(
  c: ContestacaoLida,
  nomes: ReadonlyMap<string, string>
): LabContestacaoDoCurador {
  return {
    id: c.id,
    ponto: c.ponto,
    motivo: c.motivo,
    status: dentroDe<LabContestacaoStatus>(labContestacaoStatus, c.status, "Status de contestação"),
    criadoEm: c.criadoEm.toISOString(),
    participante: participanteResumido(c.resultado.sessao.participante),
    resultadoId: c.resultado.id,
    sessaoId: c.resultado.sessao.id,
    statusValidacao: statusDeValidacao(c.resultado.statusValidacao),
    decididoEm: c.decididoEm?.toISOString() ?? null,
    decididoPor: nomeDe(nomes, c.decididoPor),
    nota: c.notaDecisao
  };
}

/** O que o participante vê da própria contestação: nunca quem a decidiu. */
export function visaoDaContestacaoPropria(
  c: Pick<
    Prisma.LabContestacaoGetPayload<object>,
    "id" | "ponto" | "motivo" | "status" | "criadoEm" | "decididoEm" | "notaDecisao"
  >
): LabContestacaoPropria {
  return {
    id: c.id,
    ponto: c.ponto,
    motivo: c.motivo,
    status: dentroDe<LabContestacaoStatus>(labContestacaoStatus, c.status, "Status de contestação"),
    criadoEm: c.criadoEm.toISOString(),
    decididoEm: c.decididoEm?.toISOString() ?? null,
    nota: c.notaDecisao
  };
}
