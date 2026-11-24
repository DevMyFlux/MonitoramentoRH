// Treinamentos Interativos — as regras do módulo no servidor. As rotas (treinamentos-routes.ts) só
// autenticam e delegam para cá.
//
// Princípios:
//  - A API decide: papel e escopo conferidos aqui (treinamentos-acesso.ts, em packages/shared).
//    Registro de outra pessoa ou de fora da turma do curador responde 404, igual a "não existe".
//  - O gabarito não sai antes da hora: antes de responder, o participante recebe a visão sem
//    `taken`, tom ou regras (visaoDoParticipante); depois de cada resposta, só a reação dela; o
//    desfecho completo só depois de concluir.
//  - O desfecho é calculado aqui, com o motor puro de packages/shared, e gravado como retrato.
//  - Auditoria (AuditLog) na MESMA transação de aprovar versão, atribuir, validar tentativa e
//    alterar cenário.
//  - Nenhuma IA e nenhuma chamada externa no caminho do participante.
import {
  acessoATentativa,
  evaluate,
  perfilPermite,
  reacaoDaAlternativa,
  takenFromPicks,
  temVinculo,
  TreinoErroDoMotor,
  treinoCenarioSchema,
  validarCenario,
  visaoDoParticipante,
  type TreinoAtor,
  type TreinoCenario,
  type TreinoDesfecho,
  type TreinoFiltrosDoRh,
  type TreinoPapel,
  type TreinoPerfil
} from "@my-flux/shared";
import { Prisma, type PrismaClient, type RoleName } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";

export type ConfigDosTreinamentos = {
  /** Tentativas que um participante pode iniciar por dia (fuso de São Paulo). null = sem limite. */
  limiteTentativasDia: number | null;
};

/** Lê a configuração do ambiente. Sem a variável, não há limite (decisão em aberto no jurídico). */
export function configDoAmbiente(env: NodeJS.ProcessEnv): ConfigDosTreinamentos {
  const bruto = env.TREINO_LIMITE_TENTATIVAS_DIA?.trim();
  if (!bruto) return { limiteTentativasDia: null };
  const limite = Number(bruto);
  if (!Number.isInteger(limite) || limite < 1)
    throw new Error("TREINO_LIMITE_TENTATIVAS_DIA deve ser um inteiro maior que zero.");
  return { limiteTentativasDia: limite };
}

const NAO_ENCONTRADO = () =>
  new HttpError(404, "TREINO_NAO_ENCONTRADO", "Registro não encontrado.");

const ehConflitoDeUnicidade = (erro: unknown) =>
  erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";

const json = (valor: unknown) => valor as Prisma.InputJsonValue;

/** Início do dia em São Paulo (sem horário de verão desde 2019: UTC-3 fixo). */
function inicioDoDiaEmSaoPaulo(agora: Date): Date {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(agora);
  return new Date(`${dia}T00:00:00-03:00`);
}

type Db = PrismaClient;

export class ServicoDeTreinamentos {
  constructor(
    private readonly db: Db,
    private readonly config: ConfigDosTreinamentos,
    private readonly agora: () => Date = () => new Date()
  ) {}

  // ---------------------------------------------------------------------------
  // Ator e papéis
  // ---------------------------------------------------------------------------

  async carregarAtor(user: { id: string; role: TreinoPerfil }): Promise<TreinoAtor> {
    const participante = await this.db.labParticipante.findUnique({
      where: { userId: user.id },
      select: { id: true, ativo: true }
    });
    return {
      userId: user.id,
      role: user.role,
      participanteId: participante?.ativo ? participante.id : null
    };
  }

  private exigirPapel(ator: TreinoAtor, papel: TreinoPapel): void {
    if (!perfilPermite(ator, papel))
      throw new HttpError(403, "TREINO_FORBIDDEN", "Seu perfil não tem permissão para esta ação.");
  }

  private exigirParticipante(
    ator: TreinoAtor
  ): asserts ator is TreinoAtor & { participanteId: string } {
    this.exigirPapel(ator, "participante");
    if (!temVinculo(ator))
      throw new HttpError(
        403,
        "TREINO_SEM_VINCULO",
        "Seu usuário ainda não está vinculado a um colaborador. Procure o RH."
      );
  }

  /** Lê e valida o conteúdo gravado de uma versão (gravado já validado; isto é defesa). */
  private cenarioDa(conteudo: Prisma.JsonValue): TreinoCenario {
    return treinoCenarioSchema.parse(conteudo);
  }

  // ---------------------------------------------------------------------------
  // Participante
  // ---------------------------------------------------------------------------

  /** As atribuições abertas das turmas ativas do participante e o histórico das concluídas. */
  async minhas(ator: TreinoAtor) {
    this.exigirParticipante(ator);
    const [atribuicoes, concluidas] = await Promise.all([
      this.db.treinoAtribuicao.findMany({
        where: {
          status: "aberta",
          turma: { ativa: true, participantes: { some: { participanteId: ator.participanteId } } }
        },
        orderBy: { criadoEm: "desc" },
        include: {
          turma: { select: { nome: true } },
          versao: { select: { conteudo: true, cenario: { select: { titulo: true, area: true } } } },
          tentativas: {
            where: { participanteId: ator.participanteId },
            select: { id: true, status: true, _count: { select: { respostas: true } } }
          }
        }
      }),
      this.db.treinoTentativa.findMany({
        where: { participanteId: ator.participanteId, status: "concluida" },
        orderBy: { concluidaEm: "desc" },
        take: 50,
        include: {
          atribuicao: { select: { versao: { select: { cenario: { select: { titulo: true } } } } } }
        }
      })
    ]);
    return {
      abertas: atribuicoes.map((a) => {
        const andamento = a.tentativas.find((t) => t.status === "em_andamento");
        return {
          atribuicaoId: a.id,
          titulo: a.versao.cenario.titulo,
          area: a.versao.cenario.area,
          exemplo: Boolean((a.versao.conteudo as { exemplo?: unknown } | null)?.exemplo),
          turma: a.turma.nome,
          prazo: a.prazo?.toISOString() ?? null,
          // Em andamento: só quantas respostas já foram dadas, nada do resultado.
          emAndamento: andamento
            ? { tentativaId: andamento.id, respondidas: andamento._count.respostas }
            : null,
          concluidas: a.tentativas.filter((t) => t.status === "concluida").length
        };
      }),
      historico: concluidas.map((t) => ({
        tentativaId: t.id,
        atribuicaoId: t.atribuicaoId,
        titulo: t.atribuicao.versao.cenario.titulo,
        concluidaEm: t.concluidaEm?.toISOString() ?? null,
        resultados: ((t.resultados as unknown as TreinoDesfecho | null)?.outcomes ?? []).map(
          (o) => ({
            id: o.id,
            label: o.label,
            nivel: o.nivel,
            texto: o.texto
          })
        ),
        validada: t.validadaEm !== null
      }))
    };
  }

  /** A atribuição, se for de uma turma ativa do participante e estiver aberta. Senão, 404. */
  private async atribuicaoDoParticipante(atribuicaoId: string, participanteId: string) {
    const atribuicao = await this.db.treinoAtribuicao.findFirst({
      where: {
        id: atribuicaoId,
        status: "aberta",
        turma: { ativa: true, participantes: { some: { participanteId } } }
      },
      include: {
        turma: { select: { nome: true } },
        versao: { select: { conteudo: true, cenario: { select: { titulo: true } } } }
      }
    });
    if (!atribuicao) throw NAO_ENCONTRADO();
    return atribuicao;
  }

  private async estadoDaAtribuicao(
    atribuicaoId: string,
    participanteId: string,
    retomada?: boolean
  ) {
    const atribuicao = await this.atribuicaoDoParticipante(atribuicaoId, participanteId);
    const cenario = this.cenarioDa(atribuicao.versao.conteudo);
    const tentativa = await this.db.treinoTentativa.findFirst({
      where: { atribuicaoId, participanteId, status: "em_andamento" },
      include: { respostas: { orderBy: { respondidaEm: "asc" } } }
    });
    return {
      atribuicao: {
        id: atribuicao.id,
        turma: atribuicao.turma.nome,
        prazo: atribuicao.prazo?.toISOString() ?? null
      },
      cenario: visaoDoParticipante(cenario),
      tentativa: tentativa
        ? {
            id: tentativa.id,
            iniciadaEm: tentativa.iniciadaEm.toISOString(),
            respostas: tentativa.respostas.map((r) => ({
              perguntaId: r.perguntaId,
              alternativa: r.alternativa,
              reacao: reacaoDaAlternativa(cenario, r.perguntaId, r.alternativa)
            }))
          }
        : null,
      ...(retomada === undefined ? {} : { retomada })
    };
  }

  /** Lê a atribuição e a tentativa em andamento, sem iniciar nada (abrir e recarregar só leem). */
  async lerAtribuicao(ator: TreinoAtor, atribuicaoId: string) {
    this.exigirParticipante(ator);
    return this.estadoDaAtribuicao(atribuicaoId, ator.participanteId);
  }

  /** Inicia a tentativa (o clique) ou retoma a que está em andamento. Idempotente. */
  async iniciar(ator: TreinoAtor, atribuicaoId: string) {
    this.exigirParticipante(ator);
    await this.atribuicaoDoParticipante(atribuicaoId, ator.participanteId);
    const existente = await this.db.treinoTentativa.findFirst({
      where: { atribuicaoId, participanteId: ator.participanteId, status: "em_andamento" },
      select: { id: true }
    });
    if (existente) return this.estadoDaAtribuicao(atribuicaoId, ator.participanteId, true);

    if (this.config.limiteTentativasDia !== null) {
      const hoje = await this.db.treinoTentativa.count({
        where: {
          participanteId: ator.participanteId,
          iniciadaEm: { gte: inicioDoDiaEmSaoPaulo(this.agora()) }
        }
      });
      if (hoje >= this.config.limiteTentativasDia)
        throw new HttpError(
          429,
          "TREINO_LIMITE_DIARIO",
          "Você atingiu o limite de tentativas de hoje. Tente de novo amanhã.",
          { limite: this.config.limiteTentativasDia }
        );
    }

    try {
      await this.db.treinoTentativa.create({
        data: { atribuicaoId, participanteId: ator.participanteId, iniciadaEm: this.agora() }
      });
    } catch (erro) {
      // Dois cliques ao mesmo tempo: o índice único parcial deixa uma só; a outra retoma.
      if (!ehConflitoDeUnicidade(erro)) throw erro;
      return this.estadoDaAtribuicao(atribuicaoId, ator.participanteId, true);
    }
    return this.estadoDaAtribuicao(atribuicaoId, ator.participanteId, false);
  }

  /** A tentativa do próprio participante (senão, 404), com o cenário da versão. */
  private async tentativaDoParticipante(tentativaId: string, participanteId: string) {
    const tentativa = await this.db.treinoTentativa.findUnique({
      where: { id: tentativaId },
      include: { atribuicao: { select: { versao: { select: { conteudo: true } } } } }
    });
    if (!tentativa || tentativa.participanteId !== participanteId) throw NAO_ENCONTRADO();
    return { tentativa, cenario: this.cenarioDa(tentativa.atribuicao.versao.conteudo) };
  }

  /**
   * Grava a alternativa de uma pergunta e devolve só a reação dela. A mesma resposta de novo
   * devolve o mesmo (idempotente); outra alternativa para a mesma pergunta é 409.
   */
  async responder(ator: TreinoAtor, tentativaId: string, perguntaId: string, alternativa: number) {
    this.exigirParticipante(ator);
    const { tentativa, cenario } = await this.tentativaDoParticipante(
      tentativaId,
      ator.participanteId
    );
    if (tentativa.status !== "em_andamento")
      throw new HttpError(409, "TREINO_TENTATIVA_ENCERRADA", "Esta tentativa já foi encerrada.");

    let reacao;
    try {
      reacao = reacaoDaAlternativa(cenario, perguntaId, alternativa);
    } catch (erro) {
      if (erro instanceof TreinoErroDoMotor)
        throw new HttpError(400, "TREINO_ESCOLHA_INVALIDA", "Pergunta ou alternativa inexistente.");
      throw erro;
    }

    try {
      await this.db.treinoResposta.create({
        data: { tentativaId, perguntaId, alternativa, respondidaEm: this.agora() }
      });
    } catch (erro) {
      if (!ehConflitoDeUnicidade(erro)) throw erro;
      const anterior = await this.db.treinoResposta.findUnique({
        where: { tentativaId_perguntaId: { tentativaId, perguntaId } }
      });
      if (anterior?.alternativa !== alternativa)
        throw new HttpError(
          409,
          "TREINO_RESPOSTA_JA_DADA",
          "Esta pergunta já foi respondida com outra alternativa."
        );
    }
    const respondidas = await this.db.treinoResposta.count({ where: { tentativaId } });
    return { perguntaId, alternativa, reacao, respondidas };
  }

  /** Conclui: exige as 5 respostas, calcula o desfecho no servidor e grava o retrato. */
  async concluir(ator: TreinoAtor, tentativaId: string) {
    this.exigirParticipante(ator);
    const participanteId = ator.participanteId;
    await this.db.$transaction(async (tx) => {
      // Trava a linha: duas conclusões ao mesmo tempo não calculam duas vezes.
      await tx.$queryRaw`SELECT id FROM treinamentos.tentativa WHERE id = ${tentativaId}::uuid FOR UPDATE`;
      const tentativa = await tx.treinoTentativa.findUnique({
        where: { id: tentativaId },
        include: {
          respostas: true,
          atribuicao: { select: { versao: { select: { conteudo: true } } } }
        }
      });
      if (!tentativa || tentativa.participanteId !== participanteId) throw NAO_ENCONTRADO();
      if (tentativa.status === "concluida") return;
      if (tentativa.status !== "em_andamento")
        throw new HttpError(409, "TREINO_TENTATIVA_ENCERRADA", "Esta tentativa já foi encerrada.");

      const cenario = this.cenarioDa(tentativa.atribuicao.versao.conteudo);
      const escolhas = Object.fromEntries(
        tentativa.respostas.map((r) => [r.perguntaId, r.alternativa])
      );
      const faltam = cenario.questions.filter((q) => escolhas[q.id] === undefined).map((q) => q.id);
      if (faltam.length)
        throw new HttpError(
          409,
          "TREINO_RESPOSTAS_INCOMPLETAS",
          "Responda as 5 perguntas antes de concluir.",
          { faltam }
        );
      const decisoes = takenFromPicks(cenario, escolhas);
      const desfecho = evaluate(cenario, decisoes);
      const agora = this.agora();
      await tx.treinoTentativa.update({
        where: { id: tentativaId },
        data: {
          status: "concluida",
          concluidaEm: agora,
          alteradoEm: agora,
          decisoes: json(decisoes),
          resultados: json(desfecho)
        }
      });
    });
    return this.resultado(ator, tentativaId);
  }

  /** O desfecho de uma tentativa concluída: para o dono ou para o curador do escopo. */
  async resultado(ator: TreinoAtor, tentativaId: string) {
    const tentativa = await this.db.treinoTentativa.findUnique({
      where: { id: tentativaId },
      include: {
        respostas: { orderBy: { respondidaEm: "asc" } },
        participante: { select: { employee: { select: { name: true } } } },
        atribuicao: {
          select: {
            id: true,
            turma: { select: { nome: true, curadorId: true, ativa: true } },
            versao: { select: { numero: true, conteudo: true } }
          }
        }
      }
    });
    if (!tentativa) throw NAO_ENCONTRADO();
    const acesso = acessoATentativa(ator, {
      participanteId: tentativa.participanteId,
      turmaCuradorId: tentativa.atribuicao.turma.curadorId,
      turmaAtiva: tentativa.atribuicao.turma.ativa
    });
    // O curador não vê tentativa em andamento (nem que ela existe).
    if (!acesso || (acesso === "curador" && tentativa.status !== "concluida"))
      throw NAO_ENCONTRADO();
    if (tentativa.status !== "concluida")
      throw new HttpError(
        409,
        "TREINO_TENTATIVA_EM_ANDAMENTO",
        "Conclua a tentativa para ver o resultado."
      );

    const cenario = this.cenarioDa(tentativa.atribuicao.versao.conteudo);
    const decisoes = (tentativa.decisoes ?? {}) as Record<string, boolean>;
    const desfecho = tentativa.resultados as unknown as TreinoDesfecho;
    return {
      tentativaId: tentativa.id,
      atribuicaoId: tentativa.atribuicao.id,
      acesso,
      ...(acesso === "curador" ? { participante: tentativa.participante.employee.name } : {}),
      turma: tentativa.atribuicao.turma.nome,
      iniciadaEm: tentativa.iniciadaEm.toISOString(),
      concluidaEm: tentativa.concluidaEm?.toISOString() ?? null,
      cenario: {
        titulo: cenario.title,
        area: cenario.area,
        exemplo: cenario.exemplo,
        scenePack: cenario.scenePack,
        versao: tentativa.atribuicao.versao.numero
      },
      decisoes: cenario.decisions.map((d) => ({
        id: d.id,
        label: d.label,
        procedure: d.procedure,
        cumpriu: decisoes[d.id] === true
      })),
      respostas: tentativa.respostas.map((r) => {
        const pergunta = cenario.questions.find((q) => q.id === r.perguntaId);
        return {
          perguntaId: r.perguntaId,
          decisao: pergunta?.decision ?? null,
          prompt: pergunta?.prompt ?? "",
          alternativa: r.alternativa,
          texto: pergunta?.alternatives[r.alternativa]?.text ?? "",
          reacao: reacaoDaAlternativa(cenario, r.perguntaId, r.alternativa)
        };
      }),
      desfecho,
      // As regras, para o grafo de causa e consequência (já não são segredo depois de concluir).
      regras: {
        events: cenario.events.map((e) => ({
          id: e.id,
          label: e.label,
          tone: e.tone,
          when: e.when,
          scene: e.scene
        })),
        outcomes: cenario.outcomes.map((o) => ({
          id: o.id,
          label: o.label,
          levels: o.levels,
          when: o.when
        }))
      },
      validacao: {
        validada: tentativa.validadaEm !== null,
        validadaEm: tentativa.validadaEm?.toISOString() ?? null,
        nota: tentativa.notaCurador
      }
    };
  }

  /** "E se?": recalcula com outras decisões, pelo mesmo motor, SEM gravar nada. */
  async simular(ator: TreinoAtor, tentativaId: string, decisoes: Record<string, boolean>) {
    this.exigirParticipante(ator);
    const { tentativa, cenario } = await this.tentativaDoParticipante(
      tentativaId,
      ator.participanteId
    );
    if (tentativa.status !== "concluida")
      throw new HttpError(
        409,
        "TREINO_TENTATIVA_EM_ANDAMENTO",
        "Conclua a tentativa para explorar outros caminhos."
      );
    const esperadas = cenario.decisions.map((d) => d.id).sort();
    const recebidas = Object.keys(decisoes).sort();
    if (JSON.stringify(esperadas) !== JSON.stringify(recebidas))
      throw new HttpError(400, "TREINO_DECISOES_INVALIDAS", "Informe as 5 decisões do cenário.", {
        esperadas
      });
    return evaluate(cenario, decisoes);
  }

  // ---------------------------------------------------------------------------
  // Curadoria (RH)
  // ---------------------------------------------------------------------------

  /** Onde o curador pode ver: turmas ativas dele (DEV: todas). */
  private escopoDoCurador(ator: TreinoAtor): Prisma.TreinoAtribuicaoWhereInput {
    return ator.role === "DEV" ? {} : { turma: { ativa: true, curadorId: ator.userId } };
  }

  async listarDoRh(ator: TreinoAtor, filtros: TreinoFiltrosDoRh) {
    this.exigirPapel(ator, "curador");
    const tentativas = await this.db.treinoTentativa.findMany({
      where: {
        status: "concluida",
        atribuicao: {
          ...this.escopoDoCurador(ator),
          ...(filtros.atribuicaoId ? { id: filtros.atribuicaoId } : {})
        },
        ...(filtros.situacao === "pendentes" ? { validadaEm: null } : {}),
        ...(filtros.situacao === "validadas" ? { validadaEm: { not: null } } : {})
      },
      orderBy: { concluidaEm: "desc" },
      take: 200,
      include: {
        participante: { select: { employee: { select: { name: true } } } },
        atribuicao: {
          select: {
            id: true,
            turma: { select: { nome: true } },
            versao: { select: { cenario: { select: { titulo: true, area: true } } } }
          }
        }
      }
    });
    return tentativas.map((t) => ({
      tentativaId: t.id,
      atribuicaoId: t.atribuicao.id,
      participante: t.participante.employee.name,
      turma: t.atribuicao.turma.nome,
      titulo: t.atribuicao.versao.cenario.titulo,
      area: t.atribuicao.versao.cenario.area,
      concluidaEm: t.concluidaEm?.toISOString() ?? null,
      resultados: ((t.resultados as unknown as TreinoDesfecho | null)?.outcomes ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        nivel: o.nivel
      })),
      validada: t.validadaEm !== null
    }));
  }

  /** Valida (com nota opcional). Dois curadores ao mesmo tempo: o segundo recebe 409. */
  async validarTentativa(ator: TreinoAtor, tentativaId: string, nota: string | undefined) {
    this.exigirPapel(ator, "curador");
    const tentativa = await this.db.treinoTentativa.findFirst({
      where: { id: tentativaId, atribuicao: this.escopoDoCurador(ator) },
      select: { id: true, status: true }
    });
    if (!tentativa || tentativa.status !== "concluida") throw NAO_ENCONTRADO();
    const agora = this.agora();
    return this.db.$transaction(async (tx) => {
      const alteradas = await tx.treinoTentativa.updateMany({
        where: { id: tentativaId, status: "concluida", validadaEm: null },
        data: {
          validadaEm: agora,
          validadaPor: ator.userId,
          notaCurador: nota?.trim() || null,
          alteradoEm: agora
        }
      });
      if (alteradas.count === 0)
        throw new HttpError(409, "TREINO_JA_VALIDADA", "Esta tentativa já foi validada.");
      await this.auditar(tx, ator, "APPROVE", "treinamentos.tentativa", tentativaId, null, {
        validada: true,
        nota: nota?.trim() || null
      });
      return { tentativaId, validadaEm: agora.toISOString(), nota: nota?.trim() || null };
    });
  }

  // ---------------------------------------------------------------------------
  // Autoria e configuração (ADMIN, DEV)
  // ---------------------------------------------------------------------------

  validar(ator: TreinoAtor, conteudo: unknown) {
    this.exigirPapel(ator, "administrador");
    const resultado = validarCenario(conteudo);
    if (!resultado.ok) return { valido: false as const, problemas: resultado.problemas };
    const c = resultado.cenario;
    return {
      valido: true as const,
      problemas: [],
      resumo: {
        slug: c.slug,
        titulo: c.title,
        area: c.area,
        scenePack: c.scenePack,
        exemplo: c.exemplo,
        decisoes: c.decisions.length,
        acontecimentos: c.events.length,
        resultados: c.outcomes.length
      }
    };
  }

  private validoOuErro(conteudo: unknown): TreinoCenario {
    const resultado = validarCenario(conteudo);
    if (!resultado.ok)
      throw new HttpError(422, "TREINO_CENARIO_INVALIDO", "O cenário tem problemas de autoria.", {
        problemas: resultado.problemas
      });
    return resultado.cenario;
  }

  async listarCenarios(ator: TreinoAtor) {
    this.exigirPapel(ator, "administrador");
    const cenarios = await this.db.treinoCenario.findMany({
      orderBy: { alteradoEm: "desc" },
      include: {
        versoes: {
          orderBy: { numero: "desc" },
          select: {
            id: true,
            numero: true,
            scenePack: true,
            criadoEm: true,
            aprovadoEm: true,
            _count: { select: { atribuicoes: true } }
          }
        }
      }
    });
    return cenarios.map((c) => ({
      id: c.id,
      slug: c.slug,
      area: c.area,
      titulo: c.titulo,
      status: c.status,
      alteradoEm: c.alteradoEm.toISOString(),
      versoes: c.versoes.map((v) => ({
        id: v.id,
        numero: v.numero,
        scenePack: v.scenePack,
        criadoEm: v.criadoEm.toISOString(),
        aprovadoEm: v.aprovadoEm?.toISOString() ?? null,
        atribuicoes: v._count.atribuicoes
      }))
    }));
  }

  async lerVersao(ator: TreinoAtor, cenarioId: string, versaoId: string) {
    this.exigirPapel(ator, "administrador");
    const versao = await this.db.treinoCenarioVersao.findFirst({
      where: { id: versaoId, cenarioId }
    });
    if (!versao) throw NAO_ENCONTRADO();
    return {
      id: versao.id,
      numero: versao.numero,
      aprovadoEm: versao.aprovadoEm?.toISOString() ?? null,
      conteudo: versao.conteudo
    };
  }

  async criarCenario(ator: TreinoAtor, conteudo: unknown) {
    this.exigirPapel(ator, "administrador");
    const cenario = this.validoOuErro(conteudo);
    try {
      return await this.db.$transaction(async (tx) => {
        const agora = this.agora();
        const criado = await tx.treinoCenario.create({
          data: {
            slug: cenario.slug,
            area: cenario.area,
            titulo: cenario.title,
            criadoPor: ator.userId,
            criadoEm: agora,
            alteradoPor: ator.userId,
            alteradoEm: agora,
            versoes: {
              create: {
                numero: 1,
                conteudo: json(cenario),
                scenePack: cenario.scenePack,
                criadoPor: ator.userId,
                criadoEm: agora
              }
            }
          },
          include: { versoes: { select: { id: true } } }
        });
        await this.auditar(tx, ator, "CREATE", "treinamentos.cenario", criado.id, null, {
          slug: cenario.slug,
          titulo: cenario.title,
          versao: 1
        });
        return { id: criado.id, slug: criado.slug, versaoId: criado.versoes[0]!.id, numero: 1 };
      });
    } catch (erro) {
      if (ehConflitoDeUnicidade(erro))
        throw new HttpError(409, "TREINO_SLUG_EM_USO", "Já existe um cenário com este slug.", {
          slug: cenario.slug
        });
      throw erro;
    }
  }

  async novaVersao(ator: TreinoAtor, cenarioId: string, conteudo: unknown) {
    this.exigirPapel(ator, "administrador");
    const existente = await this.db.treinoCenario.findUnique({ where: { id: cenarioId } });
    if (!existente) throw NAO_ENCONTRADO();
    const cenario = this.validoOuErro(conteudo);
    if (cenario.slug !== existente.slug)
      throw new HttpError(
        400,
        "TREINO_SLUG_DIFERENTE",
        "O slug do conteúdo não é o deste cenário. Para outro slug, crie outro cenário.",
        { esperado: existente.slug, recebido: cenario.slug }
      );
    return this.db.$transaction(async (tx) => {
      const ultima = await tx.treinoCenarioVersao.aggregate({
        where: { cenarioId },
        _max: { numero: true }
      });
      const numero = (ultima._max.numero ?? 0) + 1;
      const agora = this.agora();
      const versao = await tx.treinoCenarioVersao.create({
        data: {
          cenarioId,
          numero,
          conteudo: json(cenario),
          scenePack: cenario.scenePack,
          criadoPor: ator.userId,
          criadoEm: agora
        }
      });
      await tx.treinoCenario.update({
        where: { id: cenarioId },
        data: {
          titulo: cenario.title,
          area: cenario.area,
          alteradoPor: ator.userId,
          alteradoEm: agora
        }
      });
      await this.auditar(
        tx,
        ator,
        "UPDATE",
        "treinamentos.cenario",
        cenarioId,
        { titulo: existente.titulo, area: existente.area },
        { titulo: cenario.title, area: cenario.area, versao: numero }
      );
      return { id: cenarioId, versaoId: versao.id, numero };
    });
  }

  /** Aprova (congela) uma versão. O gatilho do banco impede mudar uma versão aprovada. */
  async aprovarVersao(ator: TreinoAtor, cenarioId: string, versaoId: string) {
    this.exigirPapel(ator, "administrador");
    const versao = await this.db.treinoCenarioVersao.findFirst({
      where: { id: versaoId, cenarioId }
    });
    if (!versao) throw NAO_ENCONTRADO();
    if (versao.aprovadoEm)
      throw new HttpError(409, "TREINO_VERSAO_JA_APROVADA", "Esta versão já foi aprovada.");
    // O conteúdo gravado é revalidado: uma versão inválida nunca é aprovada.
    this.validoOuErro(versao.conteudo);
    return this.db.$transaction(async (tx) => {
      const agora = this.agora();
      const alteradas = await tx.treinoCenarioVersao.updateMany({
        where: { id: versaoId, aprovadoEm: null },
        data: { aprovadoEm: agora, aprovadoPor: ator.userId }
      });
      if (alteradas.count === 0)
        throw new HttpError(409, "TREINO_VERSAO_JA_APROVADA", "Esta versão já foi aprovada.");
      await tx.treinoCenario.update({
        where: { id: cenarioId },
        data: { status: "aprovado", alteradoPor: ator.userId, alteradoEm: agora }
      });
      await this.auditar(tx, ator, "APPROVE", "treinamentos.cenario_versao", versaoId, null, {
        cenarioId,
        numero: versao.numero
      });
      return { versaoId, numero: versao.numero, aprovadoEm: agora.toISOString() };
    });
  }

  async listarTurmas(ator: TreinoAtor) {
    this.exigirPapel(ator, "administrador");
    const turmas = await this.db.labTurma.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      include: { curador: { select: { name: true } }, _count: { select: { participantes: true } } }
    });
    return turmas.map((t) => ({
      id: t.id,
      nome: t.nome,
      curador: t.curador.name,
      participantes: t._count.participantes
    }));
  }

  async atribuir(
    ator: TreinoAtor,
    entrada: { versaoId: string; turmaId: string; prazo?: string | null | undefined }
  ) {
    this.exigirPapel(ator, "administrador");
    const [versao, turma] = await Promise.all([
      this.db.treinoCenarioVersao.findUnique({ where: { id: entrada.versaoId } }),
      this.db.labTurma.findUnique({ where: { id: entrada.turmaId } })
    ]);
    if (!versao || !turma) throw NAO_ENCONTRADO();
    if (!versao.aprovadoEm)
      throw new HttpError(
        409,
        "TREINO_VERSAO_NAO_APROVADA",
        "Só uma versão aprovada pode ser atribuída a uma turma."
      );
    if (!turma.ativa)
      throw new HttpError(409, "TREINO_TURMA_INATIVA", "Esta turma não está ativa.");
    return this.db.$transaction(async (tx) => {
      const agora = this.agora();
      const atribuicao = await tx.treinoAtribuicao.create({
        data: {
          cenarioVersaoId: versao.id,
          turmaId: turma.id,
          prazo: entrada.prazo ? new Date(entrada.prazo) : null,
          criadoPor: ator.userId,
          criadoEm: agora,
          alteradoPor: ator.userId,
          alteradoEm: agora
        }
      });
      await this.auditar(tx, ator, "CREATE", "treinamentos.atribuicao", atribuicao.id, null, {
        versaoId: versao.id,
        turmaId: turma.id,
        prazo: atribuicao.prazo?.toISOString() ?? null
      });
      return {
        id: atribuicao.id,
        versaoId: versao.id,
        turmaId: turma.id,
        prazo: atribuicao.prazo?.toISOString() ?? null,
        status: atribuicao.status
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Auditoria (sempre dentro da transação da mudança)
  // ---------------------------------------------------------------------------

  private async auditar(
    tx: Prisma.TransactionClient,
    ator: TreinoAtor,
    action: "CREATE" | "UPDATE" | "APPROVE",
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await tx.auditLog.create({
      data: {
        userId: ator.userId,
        userRole: ator.role as RoleName,
        action,
        entity,
        entityId,
        before: before === null ? Prisma.DbNull : json(before),
        after: json(after),
        origin: "api"
      }
    });
  }
}
