// Assistente de suporte — as consultas de dados que ele pode fazer.
//
// Princípios:
//  1. A IA só ESCOLHE o nome de uma consulta (lista fechada em ia-contrato). Quem executa é esta
//     API, com a MESMA regra de escopo do resto do sistema (operationWhere): o RH só enxerga as
//     operações do escopo dele; o DEV, todas.
//  2. Só ADMIN, RH e DEV recebem dados de pessoas. Para os demais perfis a consulta nem é executada: o
//     motor responde com a mensagem de limitação (o modelo nunca vê o dado).
//  3. Só leitura, só o necessário: nome, função, operação e datas. Nada de saúde, documento, salário
//     ou contato. Quantidade máxima por consulta; resultado enxuto (vai para a IA como contexto).
import type { ConsultaDoSuporte } from "../leadership-lab/ia/ia-contrato.js";
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { operationWhere } from "../identity/access.js";

/** Os perfis que podem pedir dados de pessoas ao assistente. */
export const PERFIS_COM_DADOS = ["DEV", "ADMIN", "RH"] as const;

export function podeConsultarDados(perfil: string): boolean {
  return (PERFIS_COM_DADOS as readonly string[]).includes(perfil);
}

export const MENSAGEM_DE_LIMITACAO =
  "Não posso responder a essa pergunta devido às limitações da sua conta. Informações sobre colaboradores só ficam disponíveis para administradores e responsáveis do RH. Posso ajudar com dúvidas sobre como usar o sistema.";

export const LIMITE_PADRAO = 5;
export const LIMITE_MAXIMO = 10;

type Dados = Record<string, unknown>;
type Db = Pick<
  PrismaClient,
  "employee" | "calendarEvent" | "scheduleVersion" | "jobFunction" | "operation"
>;

const dia = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/** Os nomes que o assistente usa no lugar dos códigos do banco. */
const SITUACAO: Record<string, string> = {
  ACTIVE: "ativos",
  ON_LEAVE: "afastados",
  VACATION: "em_ferias",
  SCHEDULED_ADMISSION: "admissao_agendada",
  INACTIVE: "inativos",
  TERMINATED: "desligados"
};

const SITUACAO_DA_ESCALA: Record<string, string> = {
  DRAFT: "rascunho",
  IN_REVIEW: "em_aprovacao",
  APPROVED: "aprovada",
  PUBLISHED: "publicada",
  ARCHIVED: "arquivada"
};

export async function consultarDados(
  db: Db,
  user: AuthenticatedUser,
  consulta: ConsultaDoSuporte,
  limitePedido: number | null | undefined,
  agora: Date = new Date()
): Promise<Dados> {
  const limite = Math.min(LIMITE_MAXIMO, Math.max(1, limitePedido ?? LIMITE_PADRAO));
  const doEscopo = { recordStatus: "ACTIVE" as const, operation: operationWhere(user) };

  switch (consulta) {
    case "resumo_colaboradores": {
      const [porSituacao, vinculados] = await Promise.all([
        db.employee.groupBy({ by: ["status"], where: doEscopo, _count: { _all: true } }),
        db.employee.findMany({
          where: { ...doEscopo, status: { in: ["ACTIVE", "ON_LEAVE", "VACATION"] } },
          select: { operationId: true, functionId: true, shift: true }
        })
      ]);
      const situacoes: Record<string, number> = {};
      for (const linha of porSituacao)
        situacoes[SITUACAO[linha.status] ?? linha.status] = linha._count._all;
      const contar = <T extends string | null>(chaves: T[]) => {
        const mapa = new Map<T, number>();
        for (const c of chaves) mapa.set(c, (mapa.get(c) ?? 0) + 1);
        return mapa;
      };
      const [operacoes, funcoes] = await Promise.all([
        db.operation.findMany({
          where: { id: { in: [...new Set(vinculados.map((v) => v.operationId))] } },
          select: { id: true, name: true }
        }),
        db.jobFunction.findMany({
          where: { id: { in: vinculados.flatMap((v) => (v.functionId ? [v.functionId] : [])) } },
          select: { id: true, name: true }
        })
      ]);
      const nomeDaOperacao = new Map(operacoes.map((o) => [o.id, o.name]));
      const nomeDaFuncao = new Map(funcoes.map((f) => [f.id, f.name]));
      const ordenar = (mapa: Map<string | null, number>, nome: (k: string | null) => string) =>
        [...mapa.entries()]
          .map(([k, n]) => ({ nome: nome(k), colaboradores: n }))
          .sort((a, b) => b.colaboradores - a.colaboradores)
          .slice(0, LIMITE_MAXIMO);
      return {
        // "Quantos funcionários temos": quem está vinculado e trabalhando (ativo, afastado ou de férias).
        colaboradores_vinculados: vinculados.length,
        por_situacao: situacoes,
        por_operacao: ordenar(
          contar(vinculados.map((v) => v.operationId)),
          (k) => nomeDaOperacao.get(k ?? "") ?? "—"
        ),
        por_funcao: ordenar(contar(vinculados.map((v) => v.functionId)), (k) =>
          k ? (nomeDaFuncao.get(k) ?? "—") : "Sem função"
        ),
        por_turno: ordenar(contar(vinculados.map((v) => v.shift ?? null)), (k) => k ?? "Sem turno"),
        observacao:
          "colaboradores_vinculados soma ativos, afastados e em férias; desligados, inativos e admissões agendadas ficam fora."
      };
    }

    case "desligados_recentes": {
      const [total, itens] = await Promise.all([
        db.employee.count({ where: { ...doEscopo, status: "TERMINATED" } }),
        db.employee.findMany({
          where: { ...doEscopo, status: "TERMINATED" },
          orderBy: [{ terminationDate: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
          take: limite,
          select: {
            name: true,
            terminationDate: true,
            function: { select: { name: true } },
            operation: { select: { name: true } }
          }
        })
      ]);
      return {
        total_de_desligados_no_cadastro: total,
        itens: itens.map((e) => ({
          nome: e.name,
          funcao: e.function?.name ?? null,
          operacao: e.operation.name,
          ultimo_dia_de_trabalho: dia(e.terminationDate)
        })),
        observacao:
          "Do mais recente para o mais antigo. Sem data, o cadastro não registra o último dia."
      };
    }

    case "admissoes_recentes": {
      const itens = await db.employee.findMany({
        where: { ...doEscopo, admissionDate: { not: null } },
        orderBy: { admissionDate: "desc" },
        take: limite,
        select: {
          name: true,
          admissionDate: true,
          status: true,
          function: { select: { name: true } },
          operation: { select: { name: true } }
        }
      });
      return {
        itens: itens.map((e) => ({
          nome: e.name,
          funcao: e.function?.name ?? null,
          operacao: e.operation.name,
          data_de_admissao: dia(e.admissionDate),
          situacao: SITUACAO[e.status] ?? e.status
        })),
        observacao:
          "Da admissão mais recente para a mais antiga (inclui admissões futuras já agendadas)."
      };
    }

    case "afastamentos_atuais": {
      const onde = {
        status: "ACTIVE" as const,
        startsAt: { lte: agora },
        endsAt: { gte: agora },
        employee: { is: doEscopo }
      };
      const [total, itens] = await Promise.all([
        db.calendarEvent.count({ where: onde }),
        db.calendarEvent.findMany({
          where: onde,
          orderBy: { endsAt: "asc" },
          take: limite,
          select: {
            title: true,
            startsAt: true,
            endsAt: true,
            employee: { select: { name: true, operation: { select: { name: true } } } }
          }
        })
      ]);
      return {
        total_de_afastamentos_em_curso: total,
        itens: itens.map((e) => ({
          nome: e.employee?.name ?? null,
          operacao: e.employee?.operation.name ?? null,
          motivo: e.title,
          de: dia(e.startsAt),
          ate: dia(e.endsAt)
        })),
        observacao: "Os que terminam primeiro vêm antes."
      };
    }

    case "escalas_recentes": {
      const versoes = await db.scheduleVersion.findMany({
        where: { operation: operationWhere(user), archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: Math.min(limite, 5),
        select: {
          version: true,
          month: true,
          status: true,
          createdAt: true,
          operation: { select: { name: true } }
        }
      });
      return {
        itens: versoes.map((v) => {
          return {
            operacao: v.operation.name,
            mes: v.month.toISOString().slice(0, 7),
            versao: v.version,
            situacao: SITUACAO_DA_ESCALA[v.status] ?? v.status,
            gerada_em: dia(v.createdAt)
          };
        })
      };
    }
  }
}
