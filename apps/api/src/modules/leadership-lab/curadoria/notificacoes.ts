// Leadership Lab — notificações do curador.
//
// Nada novo é gravado a cada evento: a lista é montada, a cada consulta, do que JÁ espera decisão do
// curador (as mesmas quatro filas das abas), só dos participantes das turmas dele (o DEV vê todos).
// Isso evita duplicar dados e garante que tratar o item na sua tela o tira daqui. A única coisa
// guardada é a leitura (notificacao_leitura), por usuário e pela chave estável do item, com
// inserção idempotente: marcar duas vezes, ou em duas abas, não duplica.
import {
  type LabAtor,
  type LabNotificacao,
  type LabNotificacoes,
  labLimiteDeNotificacoes,
  labMarcarLeituraEntradaSchema
} from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { selecaoDoParticipanteResumido } from "./visoes.js";

type Candidato = Omit<LabNotificacao, "lida">;

const dePessoa = (p: {
  employee: { name: string; operation: { name: string } };
}): Candidato["origem"] => ({ participante: p.employee.name, operacao: p.employee.operation.name });

export class NotificacoesDoLab {
  constructor(private readonly db: PrismaClient) {}

  /** Tudo o que espera o curador, do mais recente ao mais antigo. */
  private async candidatos(user: AuthenticatedUser, ator: LabAtor): Promise<Candidato[]> {
    assertAcesso(ator, "revisao:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id, user.role))];
    const doParticipante = { participanteId: { in: participantes } };
    const participante = { select: selecaoDoParticipanteResumido };
    const limite = labLimiteDeNotificacoes;

    const [resultados, alertas, contestacoes, contribuicoes] = await Promise.all([
      this.db.labResultado.findMany({
        where: {
          statusValidacao: "aguardando_validacao",
          sessao: { status: "concluida", origem: "participante", ...doParticipante }
        },
        select: {
          id: true,
          experimental: true,
          sessao: { select: { concluidaEm: true, molde: { select: { nome: true } }, participante } }
        },
        orderBy: { sessao: { concluidaEm: "desc" } },
        take: limite
      }),
      this.db.labAlerta.findMany({
        where: { status: "aberto", sessao: doParticipante },
        select: { id: true, cor: true, criadoEm: true, sessao: { select: { participante } } },
        orderBy: { criadoEm: "desc" },
        take: limite
      }),
      this.db.labContestacao.findMany({
        where: { status: "pendente", resultado: { sessao: doParticipante } },
        select: {
          id: true,
          ponto: true,
          criadoEm: true,
          resultado: { select: { sessao: { select: { participante } } } }
        },
        orderBy: { criadoEm: "desc" },
        take: limite
      }),
      this.db.labContribuicao.findMany({
        where: { status: "pendente", sessao: doParticipante },
        select: { id: true, criadoEm: true, sessao: { select: { participante } } },
        orderBy: { criadoEm: "desc" },
        take: limite
      })
    ]);

    const itens: Candidato[] = [
      ...resultados.flatMap((r): Candidato[] =>
        r.sessao.concluidaEm === null
          ? []
          : [
              {
                chave: `resultado:${r.id}`,
                tipo: "resultado",
                prioridade: "normal",
                titulo: "Resultado aguardando validação",
                descricao: `Teste ${r.sessao.molde.nome} concluído${r.experimental ? " (experimental)" : ""}.`,
                origem: dePessoa(r.sessao.participante),
                criadoEm: r.sessao.concluidaEm.toISOString(),
                destino: `/lab/rh/revisao/${r.id}`
              }
            ]
      ),
      ...alertas.map((a): Candidato => ({
        chave: `alerta:${a.id}`,
        tipo: "alerta",
        prioridade: a.cor === "vermelho" ? "urgente" : "normal",
        titulo: a.cor === "vermelho" ? "Alerta pedagógico vermelho" : "Alerta pedagógico amarelo",
        descricao: "Pede uma conversa de desenvolvimento com o participante.",
        origem: dePessoa(a.sessao.participante),
        criadoEm: a.criadoEm.toISOString(),
        destino: "/lab/rh/alertas"
      })),
      ...contestacoes.map((c): Candidato => ({
        chave: `contestacao:${c.id}`,
        tipo: "contestacao",
        prioridade: "normal",
        titulo: "Contestação para analisar",
        descricao: `Ponto contestado: ${c.ponto}`,
        origem: dePessoa(c.resultado.sessao.participante),
        criadoEm: c.criadoEm.toISOString(),
        destino: "/lab/rh/contestacoes"
      })),
      ...contribuicoes.map((c): Candidato => ({
        chave: `contribuicao:${c.id}`,
        tipo: "contribuicao",
        prioridade: "normal",
        titulo: "Nova contribuição",
        descricao: "Uma ideia de situação enviada por um participante.",
        origem: dePessoa(c.sessao.participante),
        criadoEm: c.criadoEm.toISOString(),
        destino: "/lab/rh/contribuicoes"
      }))
    ];
    return itens.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  async listar(user: AuthenticatedUser, ator: LabAtor): Promise<LabNotificacoes> {
    const todos = await this.candidatos(user, ator);
    const recentes = todos.slice(0, labLimiteDeNotificacoes);
    const lidas = new Set(
      (
        await this.db.labNotificacaoLeitura.findMany({
          where: { userId: user.id, chave: { in: recentes.map((i) => i.chave) } },
          select: { chave: true }
        })
      ).map((l) => l.chave)
    );
    const itens = recentes.map((i) => ({ ...i, lida: lidas.has(i.chave) }));
    return {
      itens,
      naoLidas: itens.filter((i) => !i.lida).length,
      totalPendente: todos.length
    };
  }

  /**
   * Marca como lidas. Só vale para chaves que o próprio usuário enxerga agora (uma chave de fora do
   * escopo dele é ignorada, sem erro e sem revelar que existe). Idempotente.
   */
  async marcarComoLidas(
    user: AuthenticatedUser,
    ator: LabAtor,
    entradaBruta: unknown
  ): Promise<LabNotificacoes> {
    const entrada = labMarcarLeituraEntradaSchema.parse(entradaBruta);
    const visiveis = new Set(
      (await this.candidatos(user, ator)).slice(0, labLimiteDeNotificacoes).map((i) => i.chave)
    );
    const chaves =
      "todas" in entrada ? [...visiveis] : entrada.chaves.filter((c) => visiveis.has(c));
    if (chaves.length > 0) {
      await this.db.labNotificacaoLeitura.createMany({
        data: chaves.map((chave) => ({ userId: user.id, chave })),
        skipDuplicates: true
      });
    }
    return this.listar(user, ator);
  }
}
