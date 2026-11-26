// Leadership Lab — o teste por cenários: a TRILHA de cenários de Treinamentos dentro do Lab.
//
// O que o servidor faz (a tela só mostra):
//  - escolhe N cenários APROVADOS do público da pessoa, sem repetir os já feitos (só repete quando
//    acabam os inéditos), e cria a sessão (modo "cenarios") com a origem certa: "participante" (COMUM)
//    ou "interno" (DEV, ADMIN e RH);
//  - nunca envia o gabarito (`taken`, `beat`, regras): a visão do participante é montada campo a campo
//    (visaoDoParticipante) e cada resposta devolve só a reação da alternativa escolhida;
//  - uma sessão em andamento por pessoa (índice único parcial); iniciar de novo retoma; recarregar a
//    página retoma na primeira pergunta sem resposta; a mesma resposta duas vezes é idempotente e outra
//    alternativa para a mesma pergunta é 409;
//  - ao concluir cada cenário, calcula o desfecho com o motor de packages/shared; ao concluir o último,
//    calcula e grava o `resultado` do Lab (aderência = % de decisões cumpridas; agilidade pelo tempo).
//
// As tabelas são as do Lab (sessao, resultado) mais tentativa_cenario e resposta_cenario. Não há IA no
// caminho do participante.
import {
  type LabAtor,
  type LabModoDeTeste,
  type LabOrigem,
  type LabTesteIniciarEntrada,
  type TreinoCenario,
  type TreinoDesfecho,
  type TreinoPublico,
  LAB_CENARIOS_POR_TESTE_PADRAO,
  LAB_CENARIOS_POR_TESTE_MAXIMO,
  aderenciaDosCenarios,
  agilidadeDosCenarios,
  evaluate,
  moldeDoPublico,
  origemDoPerfil,
  publicoPelasRegras,
  type RegraDePublico,
  reacaoDaAlternativa,
  takenFromPicks,
  treinoCenarioSchema,
  treinoPublicos,
  TreinoErroDoMotor,
  visaoDoParticipante
} from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import { HttpError } from "../../../lib/http-error.js";
import { assertAcesso, LAB_NAO_ENCONTRADO } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import type { ConfigDoMotor } from "../motor/config.js";
import { inicioDoDia } from "../motor/tempo-do-dia.js";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export type ConfigDaTrilha = Pick<
  ConfigDoMotor,
  "versaoTermo" | "limiteTestesDia" | "fusoHorario"
> & {
  /** Quantos cenários compõem um teste (LAB_TESTE_CENARIOS). */
  cenariosPorTeste?: number | undefined;
  modoDoTeste?: LabModoDeTeste | undefined;
};

export type DependenciasDaTrilha = {
  db: Db;
  config: ConfigDaTrilha;
  agora?: () => Date;
  /** Embaralha uma lista (injetável nos testes; o padrão usa crypto.randomInt). */
  embaralhar?: <T>(lista: readonly T[]) => T[];
};

const NAO_ENCONTRADO = () =>
  new HttpError(404, LAB_NAO_ENCONTRADO.code, LAB_NAO_ENCONTRADO.message);

const SESSAO_ENCERRADA = () =>
  new HttpError(409, "LAB_SESSAO_ENCERRADA", "Este teste já foi encerrado.");

const json = (valor: unknown) => valor as Prisma.InputJsonValue;
const ehConflitoDeUnicidade = (erro: unknown) =>
  erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";

function embaralharDeVerdade<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

const cenarioDe = (conteudo: Prisma.JsonValue): TreinoCenario =>
  treinoCenarioSchema.parse(conteudo);

// ---------------------------------------------------------------------------
// O que a tela recebe
// ---------------------------------------------------------------------------

export type RespostaDada = {
  perguntaId: string;
  alternativa: number;
  reacao: ReturnType<typeof reacaoDaAlternativa>;
};

export type TrilhaDoTeste = {
  sessaoId: string;
  origem: LabOrigem;
  publico: TreinoPublico;
  total: number;
  /** A ordem (1 a N) do cenário atual. */
  atual: number;
  concluidos: number;
  cenarios: { ordem: number; status: "pendente" | "em_andamento" | "concluida" }[];
};

export type MotivoSemTeste =
  | "termo-pendente"
  | "cadastro-incompleto"
  | "sem-cenarios"
  | "limite-diario"
  | "teste-legado-em-andamento";

export type ProximoDoTeste =
  | {
      tipo: "cenario";
      trilha: TrilhaDoTeste;
      cenario: ReturnType<typeof visaoDoParticipante>;
      tentativa: { id: string; iniciadaEm: string; respostas: RespostaDada[] };
    }
  | {
      tipo: "sem-teste";
      /** Pode iniciar agora? Falso traz o `motivo`. */
      podeIniciar: boolean;
      motivo: MotivoSemTeste | null;
      /** O público que a regra da conta define (nulo: cadastro incompleto). */
      publico: TreinoPublico | null;
      /** Quantos cenários o teste terá (pode ser menos que o configurado, se faltarem aprovados). */
      total: number;
      /** DEV, ADMIN e RH podem escolher qualquer público; o COMUM, nunca. */
      publicosEscolhiveis: readonly TreinoPublico[];
    };

export type ConclusaoDoCenario = {
  ordem: number;
  desfecho: TreinoDesfecho;
  /** O próximo cenário da trilha, ou nulo quando era o último. */
  proximo: Extract<ProximoDoTeste, { tipo: "cenario" }> | null;
  /** Quando era o último: a sessão cujo resultado está pronto (GET /sessoes/:id/resultado). */
  resultadoDaSessao: string | null;
};

export class TrilhaDeCenarios {
  private readonly db: Db;
  private readonly config: ConfigDaTrilha;
  private readonly agora: () => Date;
  private readonly embaralhar: <T>(lista: readonly T[]) => T[];

  constructor(dep: DependenciasDaTrilha) {
    this.db = dep.db;
    this.config = dep.config;
    this.agora = dep.agora ?? (() => new Date());
    this.embaralhar = dep.embaralhar ?? embaralharDeVerdade;
  }

  /** O modo em vigor. Sem configuração explícita, o legado (assim as configs antigas seguem iguais). */
  get modo(): LabModoDeTeste {
    return this.config.modoDoTeste ?? "legado";
  }

  private get quantidade(): number {
    const n = this.config.cenariosPorTeste ?? LAB_CENARIOS_POR_TESTE_PADRAO;
    return Math.max(1, Math.min(LAB_CENARIOS_POR_TESTE_MAXIMO, n));
  }

  private exigirModo(): void {
    if (this.modo !== "cenarios")
      throw new HttpError(
        409,
        "LAB_MODO_LEGADO",
        "O teste por cenários não está ligado neste ambiente (LAB_TESTE_MODO=legado)."
      );
  }

  // -------------------------------------------------------------------------
  // Quem é a pessoa para o teste (público e molde)
  // -------------------------------------------------------------------------

  /**
   * O público que as regras definem para o cadastro da conta, ou nulo se o cadastro está incompleto. Valem
   * as regras CONFIGURADAS (tabela editável); sem regra que sirva, o padrão do código.
   */
  private async publicoDaConta(user: AuthenticatedUser): Promise<TreinoPublico | null> {
    if (!user.nivelGovernanca || !user.area?.id) return null;
    const [area, regras] = await Promise.all([
      this.db.area.findUnique({ where: { id: user.area.id }, select: { slug: true } }),
      this.db.treinoRegraPublico.findMany({ orderBy: [{ criadoEm: "asc" }, { id: "asc" }] })
    ]);
    if (!area) return null;
    return publicoPelasRegras(
      regras.map((r) => ({
        nivelGovernanca: r.nivel as RegraDePublico["nivelGovernanca"],
        areaId: r.areaId,
        publico: r.publico as TreinoPublico,
        ativa: r.ativa
      })),
      { nivelGovernanca: user.nivelGovernanca, areaId: user.area.id, areaSlug: area.slug }
    ).publico;
  }

  /**
   * Quantos cenários compõem o teste desta pessoa: a quantidade da TURMA dela para o público (se houver
   * mais de uma, a maior), senão a do público, senão o padrão do ambiente.
   */
  private async quantidadeDe(participanteId: string, publico: TreinoPublico): Promise<number> {
    const configs = await this.db.treinoTesteConfig.findMany({ where: { publico } });
    const limite = (n: number) => Math.max(1, Math.min(LAB_CENARIOS_POR_TESTE_MAXIMO, n));
    if (configs.length === 0) return this.quantidade;
    const turmas = await this.db.labTurmaParticipante.findMany({
      where: { participanteId, turma: { ativa: true } },
      select: { turmaId: true }
    });
    const deTurma = configs.filter(
      (c) => c.turmaId !== null && turmas.some((t) => t.turmaId === c.turmaId)
    );
    if (deTurma.length) return limite(Math.max(...deTurma.map((c) => c.quantidade)));
    const doPublico = configs.find((c) => c.turmaId === null);
    return doPublico ? limite(doPublico.quantidade) : this.quantidade;
  }

  /** O termo de ciência é etapa de participante: o teste interno (DEV, ADMIN, RH) não depende dele. */
  private async faltaOTermo(user: AuthenticatedUser, participanteId: string): Promise<boolean> {
    if (origemDoPerfil(user.role) === "interno") return false;
    const termo = await this.db.labTermoAceite.findUnique({
      where: {
        participanteId_versaoTermo: { participanteId, versaoTermo: this.config.versaoTermo }
      }
    });
    return termo === null;
  }

  /** DEV, ADMIN e RH escolhem o público; o COMUM recebe o da regra do cadastro. */
  private escolhiveis(user: AuthenticatedUser): readonly TreinoPublico[] {
    return user.role === "COMUM" ? [] : treinoPublicos;
  }

  // -------------------------------------------------------------------------
  // Cenários aprovados e escolha
  // -------------------------------------------------------------------------

  /** A versão aprovada MAIS NOVA de cada cenário aprovado do público (o resto não existe para o teste). */
  private async aprovadosDoPublico(db: Db | Tx, publico: TreinoPublico) {
    const versoes = await db.treinoCenarioVersao.findMany({
      where: {
        aprovadoEm: { not: null },
        cenario: { status: "aprovado" },
        conteudo: { path: ["publico"], equals: publico }
      },
      orderBy: [{ cenarioId: "asc" }, { numero: "desc" }],
      select: { id: true, cenarioId: true, numero: true }
    });
    const maisNovas = new Map<string, { id: string; cenarioId: string; numero: number }>();
    for (const v of versoes) if (!maisNovas.has(v.cenarioId)) maisNovas.set(v.cenarioId, v);
    return [...maisNovas.values()];
  }

  /**
   * Escolhe os cenários: os INÉDITOS para a pessoa, sorteados; se não bastarem, completa com os que
   * ela fez há mais tempo (o ciclo recomeça). Nunca repete um cenário na mesma trilha.
   */
  private async escolher(
    db: Db | Tx,
    participanteId: string,
    publico: TreinoPublico,
    quantos: number
  ) {
    const pool = await this.aprovadosDoPublico(db, publico);
    if (pool.length === 0) return [];
    const feitos = await db.labTentativaCenario.findMany({
      where: {
        status: "concluida",
        // Um teste cuja contestação foi deferida não conta: a pessoa pode refazer os cenários.
        sessao: {
          participanteId,
          modo: "cenarios",
          NOT: { resultado: { is: { contestacaoDeferidaEm: { not: null } } } }
        }
      },
      select: { concluidaEm: true, cenarioVersao: { select: { cenarioId: true } } }
    });
    const ultima = new Map<string, number>();
    for (const f of feitos) {
      const id = f.cenarioVersao.cenarioId;
      ultima.set(id, Math.max(ultima.get(id) ?? 0, f.concluidaEm?.getTime() ?? 0));
    }
    const ineditos = pool.filter((v) => !ultima.has(v.cenarioId));
    const escolhidos = this.embaralhar(ineditos).slice(0, quantos);
    if (escolhidos.length < quantos) {
      const jaFeitos = pool
        .filter((v) => ultima.has(v.cenarioId))
        .sort((a, b) => (ultima.get(a.cenarioId) ?? 0) - (ultima.get(b.cenarioId) ?? 0));
      escolhidos.push(...jaFeitos.slice(0, quantos - escolhidos.length));
    }
    return escolhidos;
  }

  // -------------------------------------------------------------------------
  // GET /teste/proxima
  // -------------------------------------------------------------------------

  /**
   * O estado do teste: a trilha em andamento (com o cenário atual e as respostas já dadas, para
   * retomar) ou, se não há, o que aconteceria ao iniciar. Só lê: nunca cria nada.
   */
  async proxima(ator: LabAtor, user: AuthenticatedUser): Promise<ProximoDoTeste> {
    this.exigirModo();
    assertAcesso(ator, "teste:ler");
    const participanteId = ator.participanteId!;

    const ativa = await this.db.labSessao.findFirst({
      where: { participanteId, status: "em_andamento" },
      select: { id: true, modo: true }
    });
    if (ativa?.modo === "cenarios") return this.estadoDaSessao(ativa.id);
    if (ativa) return this.semTeste(user, false, "teste-legado-em-andamento", null, 0);

    const publico = await this.publicoDaConta(user);
    if (await this.faltaOTermo(user, participanteId))
      return this.semTeste(user, false, "termo-pendente", publico, 0);
    if (await this.passouDoLimite(participanteId))
      return this.semTeste(user, false, "limite-diario", publico, 0);
    if (publico === null && user.role === "COMUM")
      return this.semTeste(user, false, "cadastro-incompleto", null, 0);
    // Quem pode escolher o público vê, para o público da conta (se houver), quantos cenários teria.
    if (publico === null) return this.semTeste(user, true, null, null, 0);
    const quantos = await this.quantidadeDe(participanteId, publico);
    const total = (await this.escolher(this.db, participanteId, publico, quantos)).length;
    return total === 0
      ? this.semTeste(user, false, "sem-cenarios", publico, 0)
      : this.semTeste(user, true, null, publico, total);
  }

  private semTeste(
    user: AuthenticatedUser,
    podeIniciar: boolean,
    motivo: MotivoSemTeste | null,
    publico: TreinoPublico | null,
    total: number
  ): ProximoDoTeste {
    return {
      tipo: "sem-teste",
      podeIniciar,
      motivo,
      publico,
      total,
      publicosEscolhiveis: this.escolhiveis(user)
    };
  }

  private async passouDoLimite(participanteId: string): Promise<boolean> {
    const limite = this.config.limiteTestesDia;
    if (limite === null) return false;
    const hoje = await this.db.labSessao.count({
      where: {
        participanteId,
        iniciadaEm: { gte: inicioDoDia(this.agora(), this.config.fusoHorario) },
        status: { in: ["em_andamento", "concluida"] },
        // Deferida a contestação, esse teste não gasta o limite do dia.
        NOT: { resultado: { is: { contestacaoDeferidaEm: { not: null } } } }
      }
    });
    return hoje >= limite;
  }

  // -------------------------------------------------------------------------
  // POST /teste
  // -------------------------------------------------------------------------

  /** Inicia a trilha (o clique) ou retoma a que está em andamento. Idempotente. */
  async iniciar(
    ator: LabAtor,
    user: AuthenticatedUser,
    entrada: LabTesteIniciarEntrada
  ): Promise<Extract<ProximoDoTeste, { tipo: "cenario" }>> {
    this.exigirModo();
    assertAcesso(ator, "teste:iniciar");
    const participanteId = ator.participanteId!;

    // O COMUM nunca escolhe o público: é o da regra do cadastro.
    if (entrada.publico !== undefined && user.role === "COMUM")
      throw new HttpError(
        403,
        "LAB_PUBLICO_DEFINIDO_PELO_SERVIDOR",
        "O público do seu teste é definido pelo seu cadastro."
      );

    const ativa = await this.db.labSessao.findFirst({
      where: { participanteId, status: "em_andamento" },
      select: { id: true, modo: true }
    });
    if (ativa?.modo === "cenarios") return this.estadoDaSessao(ativa.id);
    if (ativa)
      throw new HttpError(
        409,
        "LAB_TESTE_EM_ANDAMENTO",
        "Há um teste do modo anterior em andamento. Conclua-o antes de iniciar outro."
      );

    if (await this.faltaOTermo(user, participanteId))
      throw new HttpError(
        409,
        "LAB_TERMO_PENDENTE",
        "Aceite o termo de ciência do Leadership Lab para começar o teste."
      );
    if (await this.passouDoLimite(participanteId))
      throw new HttpError(
        429,
        "LAB_LIMITE_DIARIO",
        "Você atingiu o limite de testes de hoje. Tente de novo amanhã.",
        { limite: this.config.limiteTestesDia }
      );

    const publico = entrada.publico ?? (await this.publicoDaConta(user));
    if (publico === null)
      throw new HttpError(
        409,
        "LAB_CADASTRO_INCOMPLETO",
        user.role === "COMUM"
          ? "Seu cadastro está incompleto (cargo, nível de governança e área). Procure o RH."
          : "Escolha o público do teste: seu cadastro não define um."
      );

    const molde = await this.db.labMolde.findUnique({
      where: { nivel: moldeDoPublico(publico) },
      select: { id: true }
    });
    if (!molde)
      throw new HttpError(409, "LAB_MOLDE_NAO_MAPEADO", "O molde do teste não está cadastrado.");

    const quantos = await this.quantidadeDe(participanteId, publico);
    try {
      const sessaoId = await this.db.$transaction(async (tx) => {
        const escolhidos = await this.escolher(tx, participanteId, publico, quantos);
        if (escolhidos.length === 0)
          throw new HttpError(
            409,
            "LAB_SEM_CENARIOS",
            "Ainda não há cenários aprovados para o seu público. Procure o RH.",
            { publico }
          );
        const agora = this.agora();
        const sessao = await tx.labSessao.create({
          data: {
            participanteId,
            moldeId: molde.id,
            modo: "cenarios",
            origem: origemDoPerfil(user.role),
            publico,
            iniciadaEm: agora,
            cenarios: {
              create: escolhidos.map((v, i) => ({
                ordem: i + 1,
                cenarioVersaoId: v.id,
                status: i === 0 ? "em_andamento" : "pendente",
                iniciadaEm: i === 0 ? agora : null
              }))
            }
          },
          select: { id: true }
        });
        return sessao.id;
      });
      return await this.estadoDaSessao(sessaoId);
    } catch (erro) {
      // Dois cliques ao mesmo tempo: o índice único parcial deixa uma sessão; a outra retoma.
      if (!ehConflitoDeUnicidade(erro)) throw erro;
      const existente = await this.db.labSessao.findFirst({
        where: { participanteId, status: "em_andamento", modo: "cenarios" },
        select: { id: true }
      });
      if (!existente) throw erro;
      return this.estadoDaSessao(existente.id);
    }
  }

  // -------------------------------------------------------------------------
  // POST /teste/reiniciar
  // -------------------------------------------------------------------------

  /**
   * Encerra o teste em andamento (de qualquer modo) para a equipe começar outro. Só o teste interno:
   * o participante tem um teste só, que retoma. Nada é apagado: a sessão vira "cancelada", com
   * auditoria na mesma transação. Sem teste aberto, não faz nada.
   */
  async reiniciar(ator: LabAtor, user: AuthenticatedUser): Promise<{ encerrado: boolean }> {
    this.exigirModo();
    assertAcesso(ator, "teste:iniciar");
    if (origemDoPerfil(user.role) !== "interno")
      throw new HttpError(
        403,
        "LAB_REINICIO_SO_INTERNO",
        "Só o teste interno da equipe pode ser reiniciado. Continue o teste em andamento."
      );
    return this.db.$transaction(async (tx) => {
      const ativa = await tx.labSessao.findFirst({
        where: { participanteId: ator.participanteId!, status: "em_andamento" },
        select: { id: true, modo: true }
      });
      if (!ativa) return { encerrado: false };
      // Condicional: se o teste terminou neste meio-tempo, não há o que cancelar.
      const { count } = await tx.labSessao.updateMany({
        where: { id: ativa.id, status: "em_andamento" },
        data: { status: "cancelada" }
      });
      if (count === 0) return { encerrado: false };
      await tx.auditLog.create({
        data: {
          userId: ator.userId,
          userRole: user.role,
          action: "UPDATE",
          entity: "LabSessao",
          entityId: ativa.id,
          before: json({ status: "em_andamento", modo: ativa.modo }),
          after: json({ status: "cancelada", motivo: "reinicio-do-teste-interno" }),
          origin: "api"
        }
      });
      return { encerrado: true };
    });
  }

  // -------------------------------------------------------------------------
  // A sessão em andamento
  // -------------------------------------------------------------------------

  /** A trilha, o cenário atual (sem gabarito) e as respostas já dadas. */
  private async estadoDaSessao(
    sessaoId: string
  ): Promise<Extract<ProximoDoTeste, { tipo: "cenario" }>> {
    const sessao = await this.db.labSessao.findUniqueOrThrow({
      where: { id: sessaoId },
      select: {
        id: true,
        origem: true,
        publico: true,
        cenarios: {
          orderBy: { ordem: "asc" },
          select: {
            id: true,
            ordem: true,
            status: true,
            iniciadaEm: true,
            cenarioVersao: { select: { conteudo: true } },
            respostas: { orderBy: { respondidaEm: "asc" } }
          }
        }
      }
    });
    const atual = sessao.cenarios.find((c) => c.status === "em_andamento");
    if (!atual) throw SESSAO_ENCERRADA();
    const cenario = cenarioDe(atual.cenarioVersao.conteudo);
    return {
      tipo: "cenario",
      trilha: {
        sessaoId: sessao.id,
        origem: sessao.origem as LabOrigem,
        publico: sessao.publico as TreinoPublico,
        total: sessao.cenarios.length,
        atual: atual.ordem,
        concluidos: sessao.cenarios.filter((c) => c.status === "concluida").length,
        cenarios: sessao.cenarios.map((c) => ({
          ordem: c.ordem,
          status: c.status as "pendente" | "em_andamento" | "concluida"
        }))
      },
      cenario: visaoDoParticipante(cenario),
      tentativa: {
        id: atual.id,
        iniciadaEm: (atual.iniciadaEm ?? this.agora()).toISOString(),
        respostas: atual.respostas.map((r) => ({
          perguntaId: r.perguntaId,
          alternativa: r.alternativa,
          reacao: reacaoDaAlternativa(cenario, r.perguntaId, r.alternativa)
        }))
      }
    };
  }

  /** O cenário da trilha do próprio participante (senão, 404, igual a "não existe"). */
  private async tentativaDoParticipante(tentativaId: string, participanteId: string) {
    const tentativa = await this.db.labTentativaCenario.findUnique({
      where: { id: tentativaId },
      include: {
        sessao: { select: { participanteId: true, modo: true, status: true } },
        cenarioVersao: { select: { conteudo: true } },
        respostas: { orderBy: { respondidaEm: "asc" } }
      }
    });
    if (!tentativa || tentativa.sessao.participanteId !== participanteId) throw NAO_ENCONTRADO();
    return { tentativa, cenario: cenarioDe(tentativa.cenarioVersao.conteudo) };
  }

  // -------------------------------------------------------------------------
  // POST /teste/:id/respostas
  // -------------------------------------------------------------------------

  /**
   * Grava a alternativa de uma pergunta e devolve só a reação dela. A mesma resposta de novo devolve
   * o mesmo (idempotente); outra alternativa para a mesma pergunta é 409.
   */
  async responder(ator: LabAtor, tentativaId: string, perguntaId: string, alternativa: number) {
    this.exigirModo();
    assertAcesso(ator, "teste:responder");
    const { tentativa, cenario } = await this.tentativaDoParticipante(
      tentativaId,
      ator.participanteId!
    );
    if (tentativa.sessao.status === "cancelada") throw SESSAO_ENCERRADA();
    if (tentativa.status !== "em_andamento")
      throw new HttpError(409, "LAB_CENARIO_ENCERRADO", "Este cenário já foi concluído.");

    let reacao;
    try {
      reacao = reacaoDaAlternativa(cenario, perguntaId, alternativa);
    } catch (erro) {
      if (erro instanceof TreinoErroDoMotor)
        throw new HttpError(400, "LAB_ESCOLHA_INVALIDA", "Pergunta ou alternativa inexistente.");
      throw erro;
    }

    const agora = this.agora();
    // O tempo é desde que a pergunta apareceu: a abertura do cenário ou a resposta anterior.
    const desde = tentativa.respostas.at(-1)?.respondidaEm ?? tentativa.iniciadaEm ?? agora;
    try {
      await this.db.labRespostaCenario.create({
        data: {
          tentativaCenarioId: tentativaId,
          perguntaId,
          alternativa,
          respondidaEm: agora,
          tempoMs: Math.max(0, agora.getTime() - desde.getTime())
        }
      });
    } catch (erro) {
      if (!ehConflitoDeUnicidade(erro)) throw erro;
      const anterior = await this.db.labRespostaCenario.findUnique({
        where: { tentativaCenarioId_perguntaId: { tentativaCenarioId: tentativaId, perguntaId } }
      });
      if (anterior?.alternativa !== alternativa)
        throw new HttpError(
          409,
          "LAB_RESPOSTA_JA_DADA",
          "Esta pergunta já foi respondida com outra alternativa."
        );
    }
    const respondidas = await this.db.labRespostaCenario.count({
      where: { tentativaCenarioId: tentativaId }
    });
    return { perguntaId, alternativa, reacao, respondidas };
  }

  // -------------------------------------------------------------------------
  // POST /teste/:id/concluir
  // -------------------------------------------------------------------------

  /**
   * Conclui o cenário: exige as 5 respostas, calcula o desfecho no servidor e abre o próximo. No
   * último, calcula e grava o resultado do teste. Idempotente: concluir de novo devolve o mesmo.
   */
  async concluir(ator: LabAtor, tentativaId: string): Promise<ConclusaoDoCenario> {
    this.exigirModo();
    assertAcesso(ator, "teste:responder");
    const participanteId = ator.participanteId!;

    const resultado = await this.db.$transaction(async (tx) => {
      // Trava a linha: duas conclusões ao mesmo tempo não calculam duas vezes.
      await tx.$queryRaw`SELECT id FROM leadership_lab.tentativa_cenario WHERE id = ${tentativaId}::uuid FOR UPDATE`;
      const tentativa = await tx.labTentativaCenario.findUnique({
        where: { id: tentativaId },
        include: {
          sessao: { select: { id: true, participanteId: true, status: true, origem: true } },
          cenarioVersao: { select: { conteudo: true } },
          respostas: true
        }
      });
      if (!tentativa || tentativa.sessao.participanteId !== participanteId) throw NAO_ENCONTRADO();
      if (tentativa.sessao.status === "cancelada") throw SESSAO_ENCERRADA();
      const cenario = cenarioDe(tentativa.cenarioVersao.conteudo);

      if (tentativa.status === "concluida") {
        // Já concluído: devolve o que foi calculado.
        return {
          ordem: tentativa.ordem,
          desfecho: tentativa.desfecho as unknown as TreinoDesfecho,
          sessaoId: tentativa.sessaoId
        };
      }
      if (tentativa.status !== "em_andamento")
        throw new HttpError(409, "LAB_CENARIO_ENCERRADO", "Este cenário ainda não foi aberto.");

      const escolhas = Object.fromEntries(
        tentativa.respostas.map((r) => [r.perguntaId, r.alternativa])
      );
      const faltam = cenario.questions.filter((q) => escolhas[q.id] === undefined).map((q) => q.id);
      if (faltam.length)
        throw new HttpError(
          409,
          "LAB_RESPOSTAS_INCOMPLETAS",
          "Responda as 5 perguntas antes de concluir.",
          { faltam }
        );
      const decisoes = takenFromPicks(cenario, escolhas);
      const desfecho = evaluate(cenario, decisoes);
      const agora = this.agora();
      await tx.labTentativaCenario.update({
        where: { id: tentativaId },
        data: {
          status: "concluida",
          concluidaEm: agora,
          decisoes: json(decisoes),
          desfecho: json(desfecho)
        }
      });

      // O próximo da trilha começa agora; sem próximo, a sessão fecha com o resultado.
      const proximo = await tx.labTentativaCenario.findFirst({
        where: { sessaoId: tentativa.sessaoId, status: "pendente" },
        orderBy: { ordem: "asc" },
        select: { id: true }
      });
      if (proximo)
        await tx.labTentativaCenario.update({
          where: { id: proximo.id },
          data: { status: "em_andamento", iniciadaEm: agora }
        });
      else await this.fecharSessao(tx, tentativa.sessaoId, agora);
      return { ordem: tentativa.ordem, desfecho, sessaoId: tentativa.sessaoId };
    });

    const aberta = await this.db.labSessao.findUniqueOrThrow({
      where: { id: resultado.sessaoId },
      select: { status: true }
    });
    const terminou = aberta.status === "concluida";
    return {
      ordem: resultado.ordem,
      desfecho: resultado.desfecho,
      proximo: terminou ? null : await this.estadoDaSessao(resultado.sessaoId),
      resultadoDaSessao: terminou ? resultado.sessaoId : null
    };
  }

  /** Fecha a sessão e grava o resultado do teste, calculado só com o que o servidor guardou. */
  private async fecharSessao(tx: Tx, sessaoId: string, agora: Date) {
    const sessao = await tx.labSessao.findUniqueOrThrow({
      where: { id: sessaoId },
      select: {
        publico: true,
        cenarios: {
          orderBy: { ordem: "asc" },
          select: {
            decisoes: true,
            desfecho: true,
            cenarioVersao: { select: { numero: true, conteudo: true } },
            respostas: { select: { tempoMs: true } }
          }
        }
      }
    });
    let cumpridas = 0;
    let totais = 0;
    const tempos: number[] = [];
    const niveis = { ok: 0, warn: 0, bad: 0 };
    const descumpridas: string[] = [];
    let pontoForte: string | null = null;
    let pontoDesenvolvimento: string | null = null;
    let experimental = false;
    const origem: { slug: string; versao: number }[] = [];
    for (const c of sessao.cenarios) {
      const cenario = cenarioDe(c.cenarioVersao.conteudo);
      experimental ||= cenario.exemplo;
      origem.push({ slug: cenario.slug, versao: c.cenarioVersao.numero });
      const decisoes = (c.decisoes ?? {}) as Record<string, boolean>;
      for (const d of cenario.decisions) {
        totais++;
        if (decisoes[d.id] === true) cumpridas++;
        else descumpridas.push(d.label);
      }
      const desfecho = c.desfecho as unknown as TreinoDesfecho;
      for (const o of desfecho.outcomes) {
        niveis[o.nivel]++;
        if (o.nivel === "ok" && pontoForte === null) pontoForte = o.texto;
        if (o.nivel === "bad" && pontoDesenvolvimento === null) pontoDesenvolvimento = o.texto;
      }
      for (const r of c.respostas) if (r.tempoMs !== null) tempos.push(r.tempoMs);
    }
    const aderencia = aderenciaDosCenarios(cumpridas, totais);
    const n = sessao.cenarios.length;
    const resumo =
      `Você concluiu ${n} ${n === 1 ? "cenário" : "cenários"} e cumpriu ${cumpridas} de ${totais} decisões ` +
      `(${aderencia}%). Resultados: ${niveis.ok} adequado(s), ${niveis.warn} de atenção e ${niveis.bad} crítico(s).`;
    await tx.labResultado.create({
      data: {
        sessaoId,
        aderenciaGeral: aderencia,
        agilidade: agilidadeDosCenarios(tempos),
        niveisPorSkill: {},
        resumo,
        pontoForte,
        pontoDesenvolvimento,
        sugestoes: json(descumpridas.slice(0, 3).map((d) => `Reveja a decisão: ${d}.`)),
        respostaIa: json({ origem: "cenarios", publico: sessao.publico, cenarios: origem }),
        // Cenário com texto de EXEMPLO ainda não validado pela área: o resultado não vale como oficial.
        experimental
      }
    });
    await tx.labSessao.update({
      where: { id: sessaoId },
      data: { status: "concluida", concluidaEm: agora }
    });
  }

  // -------------------------------------------------------------------------
  // O resultado
  // -------------------------------------------------------------------------

  /**
   * O resultado de um teste por cenários. Quem lê:
   *  - o dono, sempre;
   *  - o curador da turma do dono, só se a origem for "participante";
   *  - DEV, ADMIN e RH, o resultado "interno" (o de quem testa e valida).
   * Qualquer outra pessoa recebe 404, o mesmo de "não existe".
   */
  async resultado(ator: LabAtor, sessaoId: string) {
    const sessao = await this.db.labSessao.findUnique({
      where: { id: sessaoId },
      select: {
        id: true,
        modo: true,
        origem: true,
        publico: true,
        status: true,
        participanteId: true,
        concluidaEm: true,
        resultado: true,
        cenarios: {
          orderBy: { ordem: "asc" },
          select: {
            ordem: true,
            decisoes: true,
            desfecho: true,
            cenarioVersao: { select: { numero: true, conteudo: true } },
            respostas: { orderBy: { respondidaEm: "asc" } }
          }
        }
      }
    });
    if (!sessao || sessao.modo !== "cenarios") throw NAO_ENCONTRADO();

    const dono = ator.participanteId === sessao.participanteId;
    const interno = sessao.origem === "interno" && ator.role !== "COMUM";
    if (!dono && !interno) {
      // Curador da turma: só vê resultado de participante, e só das turmas dele.
      if (sessao.origem !== "participante") throw NAO_ENCONTRADO();
      const turmas = await carregarParticipantesDasTurmas(this.db, ator.userId, ator.role);
      assertAcesso(ator, "resultado:ler", {
        participanteId: sessao.participanteId,
        participantesDasTurmas: turmas
      });
    }
    // O curador não vê teste em andamento (nem que ele existe); o dono ainda o está fazendo.
    if (sessao.status !== "concluida" || !sessao.resultado) {
      if (dono)
        throw new HttpError(409, "LAB_TESTE_EM_ANDAMENTO", "Conclua o teste para ver o resultado.");
      throw NAO_ENCONTRADO();
    }

    const r = sessao.resultado;
    return {
      modo: "cenarios" as const,
      sessaoId: sessao.id,
      resultadoId: r.id,
      origem: sessao.origem as LabOrigem,
      publico: sessao.publico as TreinoPublico,
      concluidaEm: sessao.concluidaEm?.toISOString() ?? null,
      statusValidacao: r.statusValidacao,
      experimental: r.experimental,
      aderenciaGeral: r.aderenciaGeral,
      agilidade: r.agilidade,
      resumo: r.resumo,
      pontoForte: r.pontoForte,
      pontoDesenvolvimento: r.pontoDesenvolvimento,
      sugestoes: r.sugestoes as string[],
      cenarios: sessao.cenarios.map((c) => {
        const cenario = cenarioDe(c.cenarioVersao.conteudo);
        const decisoes = (c.decisoes ?? {}) as Record<string, boolean>;
        return {
          ordem: c.ordem,
          titulo: cenario.title,
          area: cenario.area,
          exemplo: cenario.exemplo,
          scenePack: cenario.scenePack,
          versao: c.cenarioVersao.numero,
          decisoes: cenario.decisions.map((d) => ({
            id: d.id,
            label: d.label,
            procedure: d.procedure,
            cumpriu: decisoes[d.id] === true
          })),
          respostas: c.respostas.map((resp) => {
            const pergunta = cenario.questions.find((q) => q.id === resp.perguntaId);
            return {
              perguntaId: resp.perguntaId,
              prompt: pergunta?.prompt ?? "",
              alternativa: resp.alternativa,
              texto: pergunta?.alternatives[resp.alternativa]?.text ?? "",
              reacao: reacaoDaAlternativa(cenario, resp.perguntaId, resp.alternativa),
              tempoMs: resp.tempoMs
            };
          }),
          desfecho: c.desfecho as unknown as TreinoDesfecho
        };
      })
    };
  }
}
