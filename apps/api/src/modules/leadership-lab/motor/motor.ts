// Leadership Lab — o motor do teste.
//
// Conduz um teste de ponta a ponta: iniciar, responder, tempo esgotado, fechar e consultar o
// resultado. A IA propõe; este código valida, mede o tempo, calcula, grava e decide.
//
// Garantias (cada uma tem teste de integração):
//  - Permissão em TODO método (matriz do Lab), antes de ler ou gravar dado do participante.
//  - Durante o teste o navegador só recebe o que visoes.ts permite: nunca aderência, estilo,
//    skills, alerta nem a justificativa.
//  - O tempo é medido aqui, com o relógio do servidor. Resposta fora do prazo vale como
//    omissão, e o cliente não decide se o tempo acabou.
//  - Reenviar a mesma resposta devolve o mesmo resultado sem nova chamada à IA; outra resposta
//    para a mesma situação é recusada.
//  - Duas requisições simultâneas para o mesmo turno não disparam duas chamadas à IA (reserva
//    no turno). Se a IA falhar, a resposta já dada fica gravada e o participante só repete.
//  - A IA só vê o molde, os temas, a escolha e o campo livre depois da Guarda; nunca o
//    participante, o colaborador, a operação nem a unidade.
//  - Resposta da IA fora do contrato não grava nada.
import {
  type LabAtor,
  type LabEscolha,
  type LabConversaResposta,
  type LabMoldeNivel,
  labConversaEntradaSchema,
  labConversaLimites,
  labMoldeNiveis,
  medirResposta
} from "@my-flux/shared";
import {
  Prisma,
  type LabMolde,
  type LabSessao,
  type LabTurno,
  type PrismaClient
} from "@prisma/client";
import { z } from "zod";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { consultarPainel } from "../painel/consulta.js";
import type { PainelDoParticipante } from "../painel/tipos.js";
import {
  type RespostaTurnoIa,
  aplicarGuarda,
  conversaIaRequestSchema,
  guardaIaRequestSchema,
  iniciarSessaoIaRequestSchema,
  proximoTurnoIaRequestSchema,
  validarAberturaIa,
  validarConversaIa,
  validarTurnoIa
} from "../ia/ia-contrato.js";
import { type ClienteIa, type DesfechoDaChamada, chamarIa } from "./cliente-ia.js";
import type { ConfigDoMotor } from "./config.js";
import {
  iniciarEntradaSchema,
  responderEntradaSchema,
  tempoEsgotadoEntradaSchema
} from "./entradas.js";
import { RESPOSTA_BLOQUEADA, contextoDaConversa, historicoSeguro } from "./conversa.js";
import { erros } from "./erros.js";
import { fecharTeste } from "./fechamento.js";
import {
  type SessaoComMolde,
  avaliarInicio,
  buscarSessaoAtiva,
  moldePronto,
  resolverMoldeDoParticipante
} from "./precondicoes.js";
import {
  type EstadoDoTeste,
  type RespostaDeResultado,
  type RespostaDeSituacao,
  type RespostaDoTeste,
  type VisaoDoResultado,
  visaoDaSituacao,
  visaoDoResultado
} from "./visoes.js";

/** Um molde, como o participante o vê na tela de início. */
export type MoldeVisivel = {
  id: string;
  nivel: LabMoldeNivel;
  nome: string;
  temas: string[];
  numeroSituacoes: number;
  /** Só quando o molde está liberado; nulo caso contrário. */
  tempoLimiteS: number | null;
  /** Ativo, com tempo e com temas. Só estes podem ser iniciados. */
  disponivel: boolean;
  doMeuCargo: boolean;
};

export type LoggerDoMotor = { warn(dados: object, mensagem: string): void };

export type DependenciasDoMotor = {
  db: PrismaClient;
  ia: ClienteIa;
  config: ConfigDoMotor;
  /** Relógio injetável. Todo cálculo de tempo do teste usa este, nunca Date.now() direto. */
  agora?: () => Date;
  logger?: LoggerDoMotor;
  /**
   * Temas da simulação local. Só existe no modo demonstração: sem isto, `categoriaId` é recusado.
   * O motor não conhece a biblioteca; só confere se o tema escolhido está nesta lista.
   */
  temasDeSimulacao?: ReadonlySet<string>;
};

type Intencao =
  { tipo: "resposta"; escolha: LabEscolha; textoLivre: string | null } | { tipo: "omissao" };

/** Margem somada ao timeout da IA para dimensionar a reserva do turno. */
const MARGEM_DA_RESERVA_MS = 5_000;

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

export class MotorDoTeste {
  private readonly db: PrismaClient;
  private readonly ia: ClienteIa;
  private readonly config: ConfigDoMotor;
  private readonly relogio: () => Date;
  private readonly logger: LoggerDoMotor | undefined;
  private readonly temasDeSimulacao: ReadonlySet<string> | undefined;

  constructor(dependencias: DependenciasDoMotor) {
    this.temasDeSimulacao = dependencias.temasDeSimulacao;
    this.db = dependencias.db;
    this.ia = dependencias.ia;
    this.config = dependencias.config;
    this.relogio = dependencias.agora ?? (() => new Date());
    this.logger = dependencias.logger;
  }

  /** Há simulação local (modo demonstração)? As rotas /simulador só existem se sim. */
  get temSimulador(): boolean {
    return this.temasDeSimulacao !== undefined;
  }

  // =========================================================================
  // Termo de ciência
  // =========================================================================

  /** Registra o aceite da versão atual do termo. Repetir não faz nada além de devolver o aceite. */
  async aceitarTermo(ator: LabAtor): Promise<{ versaoTermo: string; aceitoEm: Date }> {
    assertAcesso(ator, "termo:aceitar");
    const participanteId = this.participanteDe(ator);
    const versaoTermo = this.config.versaoTermo;
    const aceite = await this.db.labTermoAceite.upsert({
      where: { participanteId_versaoTermo: { participanteId, versaoTermo } },
      create: { participanteId, versaoTermo, aceitoEm: this.relogio() },
      update: {}
    });
    return { versaoTermo: aceite.versaoTermo, aceitoEm: aceite.aceitoEm };
  }

  /** O termo atual e se este participante já o aceitou. A tela de início usa para decidir se o mostra. */
  async situacaoDoTermo(
    ator: LabAtor
  ): Promise<{ versaoAtual: string; aceito: boolean; aceitoEm: Date | null }> {
    assertAcesso(ator, "termo:ler");
    const participanteId = this.participanteDe(ator);
    const versaoAtual = this.config.versaoTermo;
    const aceite = await this.db.labTermoAceite.findUnique({
      where: { participanteId_versaoTermo: { participanteId, versaoTermo: versaoAtual } }
    });
    return { versaoAtual, aceito: aceite !== null, aceitoEm: aceite?.aceitoEm ?? null };
  }

  // =========================================================================
  // Moldes
  // =========================================================================

  /**
   * Os moldes, com o do cargo do participante marcado. Só o que a tela de início mostra: nada
   * de quem o configurou, e o tempo só aparece quando o molde está de fato liberado.
   */
  async listarMoldes(
    ator: LabAtor
  ): Promise<{ moldes: MoldeVisivel[]; meuMoldeId: string | null }> {
    assertAcesso(ator, "moldes:listar");
    const participanteId = this.participanteDe(ator);
    const [moldes, resolvido] = await Promise.all([
      this.db.labMolde.findMany(),
      resolverMoldeDoParticipante(this.db, participanteId)
    ]);
    const meuMoldeId = "molde" in resolvido ? resolvido.molde.id : null;
    // Ordem fixa dos níveis: os três moldes nascem na mesma instrução e empatam em qualquer data.
    moldes.sort(
      (a, b) =>
        labMoldeNiveis.indexOf(a.nivel as LabMoldeNivel) -
        labMoldeNiveis.indexOf(b.nivel as LabMoldeNivel)
    );
    return {
      meuMoldeId,
      moldes: moldes.map((molde) => {
        const pronto = moldePronto(molde);
        const temas = z.array(z.string()).safeParse(molde.temas);
        return {
          id: molde.id,
          nivel: molde.nivel as MoldeVisivel["nivel"],
          nome: molde.nome,
          temas: temas.success ? temas.data : [],
          numeroSituacoes: molde.numeroSituacoes,
          tempoLimiteS: pronto?.tempoLimiteS ?? null,
          disponivel: pronto !== null,
          doMeuCargo: molde.id === meuMoldeId
        };
      })
    };
  }

  // =========================================================================
  // Painel
  // =========================================================================

  /**
   * O painel do participante, a tela inicial do módulo. Só do próprio participante, e só de testes
   * CONCLUÍDOS: o teste em andamento aparece apenas como a ação "continuar", sem nenhum dado de
   * avaliação (a aderência fica escondida até o fim).
   */
  async painel(ator: LabAtor): Promise<PainelDoParticipante> {
    assertAcesso(ator, "painel:ler");
    return consultarPainel(this.db, {
      participanteId: this.participanteDe(ator),
      config: this.config,
      agora: this.relogio()
    });
  }

  // =========================================================================
  // Iniciar (ou retomar)
  // =========================================================================

  /**
   * Inicia um teste. Se o participante já tem um em andamento, retoma esse (sem nova chamada à
   * IA e sem zerar o relógio da situação atual): clicar duas vezes, ou abrir em duas abas,
   * não cria dois testes.
   */
  async iniciar(ator: LabAtor, entradaBruta: unknown = {}): Promise<RespostaDoTeste> {
    assertAcesso(ator, "sessao:iniciar");
    const entrada = iniciarEntradaSchema.parse(entradaBruta ?? {});
    const participanteId = this.participanteDe(ator);

    const estado = await avaliarInicio(this.db, {
      participanteId,
      config: this.config,
      agora: this.relogio()
    });

    // O participante só confirma o molde do PRÓPRIO cargo. Isto vem antes de "molde inativo" e de
    // "limite do dia" (e depois de cargo/mapeamento) para manter quem recebe qual erro.
    if ("molde" in estado && entrada.moldeId !== undefined && entrada.moldeId !== estado.molde.id) {
      throw erros.moldeDivergente();
    }

    switch (estado.tipo) {
      case "termo-pendente":
        throw erros.termoPendente();
      case "continuar":
        return this.retomar(estado.sessao);
      case "cargo-nao-informado":
        throw erros.cargoNaoInformado();
      case "molde-nao-mapeado":
        throw erros.moldeNaoMapeado();
      case "molde-inativo":
        throw erros.moldeInativo();
      case "limite-diario":
        throw erros.limiteDiario(estado.limite);
      case "iniciar":
        break;
    }
    const { molde, temas } = estado;
    if (entrada.categoriaId !== undefined && !this.temasDeSimulacao?.has(entrada.categoriaId)) {
      throw erros.temaInvalido();
    }

    // O corpo sai do schema estrito: só molde, temas e quantidade de situações. Com um tema de
    // simulação escolhido, ele é o único tema (nunca o texto que o participante digitou).
    const corpo = iniciarSessaoIaRequestSchema.parse({
      molde: molde.nivel,
      temas: entrada.categoriaId !== undefined ? [entrada.categoriaId] : temas,
      numero_situacoes: molde.numeroSituacoes
    });
    const desfecho = await chamarIa(() => this.ia.abrirSessao(corpo), validarAberturaIa);
    if (!desfecho.ok) {
      await this.registrarFalha("agente_lab", desfecho, null);
      throw erros.ia(desfecho.codigo);
    }
    this.avisar(desfecho.avisos, "abertura");

    const abertura = desfecho.valor;
    const apresentadaEm = this.relogio();
    try {
      const sessaoId = await this.db.$transaction(async (tx) => {
        const sessao = await tx.labSessao.create({
          data: {
            participanteId,
            moldeId: molde.id,
            iaSessaoId: abertura.sessao_id,
            iniciadaEm: apresentadaEm
          }
        });
        await tx.labTurno.create({
          data: {
            sessaoId: sessao.id,
            numero: abertura.situacao.numero,
            marco: abertura.situacao.marco,
            texto: abertura.situacao.texto,
            opcoes: abertura.situacao.opcoes,
            estiloAdequado: abertura.situacao.estilo_adequado,
            apresentadaEm
          }
        });
        await tx.labLogIa.create({
          data: this.dadosDoLog("agente_lab", desfecho, sessao.id, abertura.uso)
        });
        return sessao.id;
      });
      const sessao = await this.sessaoComMolde(sessaoId);
      return this.retomar(sessao);
    } catch (erro) {
      // Outra requisição criou a sessão primeiro (índice de uma sessão em andamento).
      if (ehViolacaoDeUnicidade(erro)) {
        const existente = await this.sessaoAtiva(participanteId);
        if (existente) return this.retomar(existente);
      }
      throw erro;
    }
  }

  // =========================================================================
  // Ler o teste em andamento
  // =========================================================================

  /**
   * O teste em andamento do participante, SÓ para ler. Ao contrário de `iniciar`, nunca começa um
   * teste e nunca chama a IA: a tela do teste usa isto ao abrir ou recarregar, e abrir o endereço
   * por engano não pode disparar o relógio da situação 1.
   *
   * Devolve a situação em que o participante parou (com o tempo que resta, calculado aqui) ou,
   * se a resposta já foi dada mas a IA ainda não a avaliou, "em-processamento". Sem teste em
   * andamento, 404.
   */
  async estadoDoTeste(ator: LabAtor): Promise<EstadoDoTeste> {
    assertAcesso(ator, "sessao:ler-atual");
    const sessao = await this.sessaoAtiva(this.participanteDe(ator));
    if (!sessao) throw erros.semTesteEmAndamento();

    const atual = await this.db.labTurno.findFirst({
      where: { sessaoId: sessao.id },
      orderBy: { numero: "desc" }
    });
    if (!atual) throw new Error(`Sessão ${sessao.id} sem nenhuma situação.`);

    if (atual.respondidaEm !== null && atual.justificativa === null) {
      return {
        tipo: "em-processamento",
        sessaoId: sessao.id,
        numero: atual.numero,
        totalSituacoes: sessao.molde.numeroSituacoes
      };
    }
    return this.situacaoAtual(sessao, atual);
  }

  // =========================================================================
  // Responder e tempo esgotado
  // =========================================================================

  /**
   * Registra a resposta de uma situação e devolve a consequência e a próxima situação, ou o
   * resultado. Reenviar a mesma resposta devolve o mesmo resultado; chegar depois do prazo vale
   * como omissão.
   */
  async responder(
    ator: LabAtor,
    sessaoId: string,
    entradaBruta: unknown
  ): Promise<RespostaDoTeste> {
    const recebidaEm = this.relogio();
    const entrada = responderEntradaSchema.parse(entradaBruta);
    return this.resolver(
      ator,
      sessaoId,
      entrada.numero,
      { tipo: "resposta", escolha: entrada.escolha, textoLivre: entrada.textoLivre ?? null },
      "sessao:responder",
      recebidaEm
    );
  }

  /**
   * O cliente avisa que o relógio dele zerou. Quem decide é o servidor: antes do prazo, a
   * chamada é recusada.
   */
  async tempoEsgotado(
    ator: LabAtor,
    sessaoId: string,
    entradaBruta: unknown
  ): Promise<RespostaDoTeste> {
    const recebidaEm = this.relogio();
    const entrada = tempoEsgotadoEntradaSchema.parse(entradaBruta);
    return this.resolver(
      ator,
      sessaoId,
      entrada.numero,
      { tipo: "omissao" },
      "sessao:tempo-esgotado",
      recebidaEm
    );
  }

  // =========================================================================
  // Resultado
  // =========================================================================

  /** O resultado de um teste concluído: do próprio participante ou de quem está na turma do curador. */
  async obterResultado(ator: LabAtor, sessaoId: string): Promise<VisaoDoResultado> {
    const sessao = await this.buscarSessao(sessaoId);
    if (!sessao) {
      // Mesmo erro de "não é seu": não revela o que existe.
      assertAcesso(ator, "resultado:ler", {
        participanteId: "00000000-0000-0000-0000-000000000000"
      });
      throw erros.naoEncontrado();
    }
    const participantesDasTurmas =
      ator.role === "RH" || ator.role === "DEV"
        ? await carregarParticipantesDasTurmas(this.db, ator.userId, ator.role)
        : undefined;
    assertAcesso(ator, "resultado:ler", {
      participanteId: sessao.participanteId,
      participantesDasTurmas
    });
    if (sessao.status !== "concluida") throw erros.testeEmAndamento();
    return this.montarVisaoDoResultado(sessao);
  }

  // =========================================================================
  // Conversa com o facilitador
  // =========================================================================

  /**
   * O participante conversa com o facilitador sobre o PRÓPRIO resultado, depois do teste. Nada da
   * conversa é gravado: só os metadados da chamada, em log_ia. Cada mensagem do participante (a
   * nova e as do histórico) passa pela Guarda, que falha fechada; a IA só recebe o resultado que
   * ele já viu. Há um teto de mensagens por teste.
   */
  async conversar(
    ator: LabAtor,
    sessaoId: string,
    entradaBruta: unknown
  ): Promise<LabConversaResposta> {
    const entrada = labConversaEntradaSchema.parse(entradaBruta);
    const sessao = await this.buscarSessao(sessaoId);
    if (!sessao) {
      assertAcesso(ator, "conversa:enviar", {
        participanteId: "00000000-0000-0000-0000-000000000000"
      });
      throw erros.naoEncontrado();
    }
    assertAcesso(ator, "conversa:enviar", { participanteId: sessao.participanteId });
    if (sessao.status !== "concluida") throw erros.testeEmAndamento();

    const enviadas = await this.db.labLogIa.count({
      where: { sessaoId, agente: "facilitador", sucesso: true }
    });
    if (enviadas >= labConversaLimites.mensagensPorTeste) {
      throw erros.limiteDaConversa(labConversaLimites.mensagensPorTeste);
    }

    const doParticipante = entrada.historico.filter((m) => m.papel === "participante");
    const [nova, ...antigas] = await Promise.all(
      [entrada.mensagem, ...doParticipante.map((m) => m.texto)].map((texto) =>
        this.filtrarTextoLivre(sessaoId, texto)
      )
    );
    // Falha fechada: sem a liberação da Guarda, a mensagem não vai para a IA.
    if (nova === undefined || nova.decisao === "bloquear") {
      return { desfecho: "bloqueada", resposta: RESPOSTA_BLOQUEADA };
    }
    const mensagem = nova.decisao === "mascarar" ? (nova.texto ?? "") : entrada.mensagem;
    const seguros = antigas.map((a, i) =>
      a.decisao === "bloquear"
        ? null
        : a.decisao === "mascarar"
          ? a.texto
          : (doParticipante[i]?.texto ?? null)
    );

    const visao = await this.montarVisaoDoResultado(sessao);
    const corpo = conversaIaRequestSchema.parse({
      molde: sessao.molde.nivel,
      mensagem,
      historico: historicoSeguro(entrada.historico, seguros),
      resultado: contextoDaConversa(visao)
    });
    const desfecho = await chamarIa(() => this.ia.conversar(corpo), validarConversaIa);
    if (!desfecho.ok) {
      await this.registrarFalha("facilitador", desfecho, sessaoId);
      throw erros.ia(desfecho.codigo);
    }
    await this.db.labLogIa
      .create({ data: this.dadosDoLog("facilitador", desfecho, sessaoId, desfecho.valor.uso) })
      .catch((erro: unknown) =>
        this.logger?.warn({ erro }, "falha ao registrar o log do facilitador")
      );
    return { desfecho: "respondida", resposta: desfecho.valor.resposta };
  }

  // =========================================================================
  // Núcleo: decidir o que fazer com a resposta
  // =========================================================================

  private async resolver(
    ator: LabAtor,
    sessaoId: string,
    numero: number,
    intencao: Intencao,
    acao: "sessao:responder" | "sessao:tempo-esgotado",
    recebidaEm: Date,
    tentativa = 0
  ): Promise<RespostaDoTeste> {
    const sessao = await this.buscarSessao(sessaoId);
    if (!sessao) {
      // Sessão que não existe responde como sessão alheia; passa pela matriz primeiro para
      // quem nem pode agir receber o 403 de perfil.
      assertAcesso(ator, acao, { participanteId: "00000000-0000-0000-0000-000000000000" });
      throw erros.naoEncontrado();
    }
    assertAcesso(ator, acao, { participanteId: sessao.participanteId });
    if (sessao.status === "cancelada") throw erros.sessaoEncerrada();

    const ultimo = await this.db.labTurno.findFirst({
      where: { sessaoId: sessao.id },
      orderBy: { numero: "desc" }
    });
    if (!ultimo) throw new Error(`Sessão ${sessao.id} sem nenhuma situação.`);
    if (numero > ultimo.numero) throw erros.turnoForaDeOrdem(ultimo.numero);

    const turno =
      numero === ultimo.numero
        ? ultimo
        : await this.db.labTurno.findUniqueOrThrow({
            where: { sessaoId_numero: { sessaoId: sessao.id, numero } }
          });

    // 1. Já avaliado: é uma repetição. Devolve o mesmo resultado, sem tocar na IA.
    //    (Caminho rápido: assumirEProcessar chegaria ao mesmo resultado, com uma escrita a mais.)
    if (turno.justificativa !== null) {
      this.conferirRepeticao(turno, intencao);
      return this.reconstruir(sessao, turno);
    }

    // 2. Respondido, mas a IA ainda não aplicou a avaliação (falhou antes, ou está em curso).
    if (turno.respondidaEm !== null) {
      this.conferirRepeticao(turno, intencao);
      return this.assumirEProcessar(sessao, turno);
    }

    // 3. Pendente: é a primeira vez que a resposta chega.
    const tempoLimiteS = this.tempoLimiteDe(sessao.molde);
    const medicao = medirResposta({
      apresentadaEm: turno.apresentadaEm,
      recebidaEm,
      tempoLimiteS,
      toleranciaS: this.config.toleranciaTempoS
    });

    let reservou: boolean;
    if (intencao.tipo === "omissao") {
      // Aceita o aviso do cliente só se o relógio do SERVIDOR já passou do limite.
      if (medicao.tempoBrutoMs < tempoLimiteS * 1000) {
        throw erros.tempoNaoEsgotado(tempoLimiteS * 1000 - medicao.tempoBrutoMs);
      }
      reservou = await this.reservarOmissao(turno, recebidaEm);
    } else if (medicao.esgotado) {
      // Chegou depois do prazo (e da tolerância): a letra e o texto são descartados.
      reservou = await this.reservarOmissao(turno, recebidaEm);
    } else {
      const filtrado =
        intencao.textoLivre !== null
          ? await this.filtrarTextoLivre(sessao.id, intencao.textoLivre)
          : { decisao: null, texto: null };
      reservou = await this.reservarResposta(turno, {
        escolha: intencao.escolha,
        respondidaEm: new Date(Math.max(recebidaEm.getTime(), turno.apresentadaEm.getTime())),
        tempoRespostaMs: medicao.tempoRespostaMs,
        textoLivre: filtrado.texto,
        decisaoGuarda: filtrado.decisao
      });
    }

    if (!reservou) {
      // Outra requisição chegou primeiro. Relê o turno e decide de novo, uma única vez.
      if (tentativa >= 1) throw erros.emProcessamento();
      return this.resolver(ator, sessaoId, numero, intencao, acao, recebidaEm, tentativa + 1);
    }

    const reservado = await this.db.labTurno.findUniqueOrThrow({ where: { id: turno.id } });
    return this.processar(sessao, reservado);
  }

  /** Repetir a mesma resposta é permitido; mudar de resposta não. */
  private conferirRepeticao(turno: LabTurno, intencao: Intencao): void {
    if (turno.tempoEsgotado) return; // omissão: qualquer repetição devolve o mesmo desfecho
    if (intencao.tipo === "omissao" || intencao.escolha !== turno.escolha) {
      throw erros.respostaDivergente();
    }
  }

  // =========================================================================
  // Reserva do turno e chamada à IA
  // =========================================================================

  private reservaAte(): Date {
    return new Date(this.relogio().getTime() + this.config.iaTimeoutMs + MARGEM_DA_RESERVA_MS);
  }

  private async reservarOmissao(turno: LabTurno, recebidaEm: Date): Promise<boolean> {
    const { count } = await this.db.labTurno.updateMany({
      where: { id: turno.id, respondidaEm: null },
      data: {
        respondidaEm: new Date(Math.max(recebidaEm.getTime(), turno.apresentadaEm.getTime())),
        tempoEsgotado: true,
        aderencia: 0,
        processandoAte: this.reservaAte()
      }
    });
    return count === 1;
  }

  private async reservarResposta(
    turno: LabTurno,
    dados: {
      escolha: LabEscolha;
      respondidaEm: Date;
      tempoRespostaMs: number;
      textoLivre: string | null;
      decisaoGuarda: string | null;
    }
  ): Promise<boolean> {
    const { count } = await this.db.labTurno.updateMany({
      where: { id: turno.id, respondidaEm: null },
      data: { ...dados, processandoAte: this.reservaAte() }
    });
    return count === 1;
  }

  /** Para um turno já respondido cuja avaliação ainda não foi aplicada: assume a reserva. */
  private async assumirEProcessar(
    sessao: SessaoComMolde,
    turno: LabTurno
  ): Promise<RespostaDoTeste> {
    const agora = this.relogio();
    const { count } = await this.db.labTurno.updateMany({
      where: {
        id: turno.id,
        respondidaEm: { not: null },
        justificativa: null,
        OR: [{ processandoAte: null }, { processandoAte: { lt: agora } }]
      },
      data: { processandoAte: this.reservaAte() }
    });
    const atual = await this.db.labTurno.findUniqueOrThrow({ where: { id: turno.id } });
    if (count === 1) return this.processar(sessao, atual);
    // Não assumiu: ou já foi aplicado por quem tinha a reserva, ou ainda está em curso.
    if (atual.justificativa !== null) return this.reconstruir(sessao, atual);
    throw erros.emProcessamento();
  }

  private async liberarReserva(turnoId: string): Promise<void> {
    await this.db.labTurno.updateMany({
      where: { id: turnoId, justificativa: null },
      data: { processandoAte: null }
    });
  }

  /** Com a reserva em mãos: consulta a IA, valida e aplica. */
  private async processar(sessao: SessaoComMolde, turno: LabTurno): Promise<RespostaDoTeste> {
    if (sessao.iaSessaoId === null) {
      throw new Error(`Sessão ${sessao.id} sem identificador de conversa na IA.`);
    }
    const escolha = turno.escolha as LabEscolha | null;
    const corpo = proximoTurnoIaRequestSchema.parse({
      sessao_id: sessao.iaSessaoId,
      numero: turno.numero,
      escolha,
      tempo_esgotado: turno.tempoEsgotado,
      texto_livre: turno.textoLivre
    });

    const desfecho = await chamarIa(
      () => this.ia.proximoTurno(corpo),
      (bruto) =>
        validarTurnoIa(bruto, {
          numero: turno.numero,
          escolha,
          totalSituacoes: sessao.molde.numeroSituacoes
        })
    );
    if (!desfecho.ok) {
      await this.liberarReserva(turno.id);
      await this.registrarFalha("agente_lab", desfecho, sessao.id);
      throw erros.ia(desfecho.codigo);
    }
    this.avisar(desfecho.avisos, `turno ${turno.numero}`);

    try {
      await this.aplicar(sessao, turno, desfecho.valor, desfecho);
    } catch (erro) {
      await this.liberarReserva(turno.id);
      throw erro;
    }
    // Devolve sempre o que ficou GRAVADO (inclusive se outra requisição aplicou antes de nós).
    const atualizado = await this.db.labTurno.findUniqueOrThrow({ where: { id: turno.id } });
    return this.reconstruir(await this.sessaoComMolde(sessao.id), atualizado);
  }

  /** Grava a avaliação, a próxima situação (ou o resultado) e o log, numa só transação. */
  private async aplicar(
    sessao: SessaoComMolde,
    turno: LabTurno,
    resposta: RespostaTurnoIa,
    desfecho: Extract<DesfechoDaChamada<RespostaTurnoIa>, { ok: true }>
  ): Promise<boolean> {
    const avaliacao = resposta.avaliacao_anterior;
    if (avaliacao === null) throw new Error("Resposta da IA sem avaliação (contrato já validado).");
    const agora = this.relogio();

    return this.db.$transaction(
      async (tx) => {
        const marcado = await tx.labTurno.updateMany({
          where: { id: turno.id, justificativa: null },
          data: {
            aderencia: avaliacao.aderencia,
            estilo: avaliacao.estilo,
            alerta: avaliacao.alerta,
            justificativa: avaliacao.justificativa,
            consequencia: resposta.consequencia,
            processandoAte: null
          }
        });
        if (marcado.count !== 1) return false; // já aplicado por outra requisição

        if (avaliacao.skills.length > 0) {
          await tx.labTurnoSkill.createMany({
            data: avaliacao.skills.map((skillId) => ({ turnoId: turno.id, skillId }))
          });
        }
        if (avaliacao.contribuicao !== null) {
          await tx.labContribuicao.create({
            data: { sessaoId: sessao.id, turnoId: turno.id, texto: avaliacao.contribuicao }
          });
        }
        // O alerta vermelho nasce na hora, não no fim do teste: o curador é avisado.
        if (avaliacao.alerta === "vermelho") {
          await tx.labAlerta.create({
            data: { sessaoId: sessao.id, turnoId: turno.id, cor: "vermelho" }
          });
        }
        await tx.labLogIa.create({
          data: this.dadosDoLog("agente_lab", desfecho, sessao.id, resposta.uso)
        });

        if (resposta.tipo === "situacao") {
          await tx.labTurno.create({
            data: {
              sessaoId: sessao.id,
              numero: resposta.situacao.numero,
              marco: resposta.situacao.marco,
              texto: resposta.situacao.texto,
              opcoes: resposta.situacao.opcoes,
              estiloAdequado: resposta.situacao.estilo_adequado,
              apresentadaEm: agora
            }
          });
        } else {
          await fecharTeste(tx, { sessao, molde: sessao.molde, agora, resposta });
        }
        return true;
      },
      { timeout: 15_000 }
    );
  }

  // =========================================================================
  // Guarda
  // =========================================================================

  /**
   * Passa o campo livre pela Guarda. FALHA FECHADA: se a Guarda cair, demorar ou responder
   * fora do contrato, o texto é bloqueado e o teste segue sem ele.
   */
  private async filtrarTextoLivre(
    sessaoId: string,
    texto: string
  ): Promise<{ decisao: "seguir" | "mascarar" | "bloquear"; texto: string | null }> {
    const corpo = guardaIaRequestSchema.parse({ texto });
    const desfecho = await chamarIa(
      () => this.ia.guarda(corpo),
      (bruto) => {
        const aplicada = aplicarGuarda(texto, bruto);
        // Resposta válida sempre traz o bloco `uso`; sem ele, trata como inválida.
        return aplicada.respostaValida && aplicada.uso !== null
          ? {
              ok: true as const,
              valor: { decisao: aplicada.decisao, texto: aplicada.texto, uso: aplicada.uso },
              avisos: []
            }
          : { ok: false as const, problemas: aplicada.problemas };
      }
    );
    if (!desfecho.ok) {
      await this.registrarFalha("guarda", desfecho, sessaoId);
      return { decisao: "bloquear", texto: null };
    }
    await this.db.labLogIa
      .create({ data: this.dadosDoLog("guarda", desfecho, sessaoId, desfecho.valor.uso) })
      .catch((erro: unknown) => this.logger?.warn({ erro }, "falha ao registrar o log da Guarda"));
    return { decisao: desfecho.valor.decisao, texto: desfecho.valor.texto };
  }

  // =========================================================================
  // Leitura e montagem das respostas
  // =========================================================================

  private participanteDe(ator: LabAtor): string {
    if (ator.participanteId === null) {
      // assertAcesso já barrou; isto só estreita o tipo.
      throw new Error("Ator sem participante depois de autorizado.");
    }
    return ator.participanteId;
  }

  private async buscarSessao(sessaoId: string): Promise<SessaoComMolde | null> {
    if (!z.uuid().safeParse(sessaoId).success) return null;
    return this.db.labSessao.findUnique({ where: { id: sessaoId }, include: { molde: true } });
  }

  private async sessaoComMolde(sessaoId: string): Promise<SessaoComMolde> {
    return this.db.labSessao.findUniqueOrThrow({
      where: { id: sessaoId },
      include: { molde: true }
    });
  }

  private async sessaoAtiva(participanteId: string): Promise<SessaoComMolde | null> {
    return buscarSessaoAtiva(this.db, participanteId);
  }

  private tempoLimiteDe(molde: LabMolde): number {
    if (molde.tempoLimiteS === null) throw erros.moldeInativo();
    return molde.tempoLimiteS;
  }

  /** Volta ao ponto em que o participante parou. */
  private async retomar(sessao: SessaoComMolde): Promise<RespostaDoTeste> {
    const atual = await this.db.labTurno.findFirst({
      where: { sessaoId: sessao.id },
      orderBy: { numero: "desc" }
    });
    if (!atual) throw new Error(`Sessão ${sessao.id} sem nenhuma situação.`);
    // Respondido, mas a avaliação não foi aplicada (a IA falhou antes): refaz com a resposta gravada.
    if (atual.respondidaEm !== null && atual.justificativa === null) {
      return this.assumirEProcessar(sessao, atual);
    }
    return this.situacaoAtual(sessao, atual);
  }

  private async situacaoAtual(
    sessao: SessaoComMolde,
    atual: LabTurno
  ): Promise<RespostaDeSituacao> {
    const anterior =
      atual.numero > 1
        ? await this.db.labTurno.findUnique({
            where: { sessaoId_numero: { sessaoId: sessao.id, numero: atual.numero - 1 } }
          })
        : null;
    return this.respostaDeSituacao(sessao, atual, anterior);
  }

  private respostaDeSituacao(
    sessao: SessaoComMolde,
    turno: LabTurno,
    anterior: LabTurno | null
  ): RespostaDeSituacao {
    return {
      tipo: "situacao",
      sessaoId: sessao.id,
      totalSituacoes: sessao.molde.numeroSituacoes,
      tempoEsgotadoNaAnterior: anterior?.tempoEsgotado ?? false,
      situacao: visaoDaSituacao({
        turno,
        consequenciaAnterior: anterior?.consequencia ?? null,
        tempoLimiteS: this.tempoLimiteDe(sessao.molde),
        agora: this.relogio()
      })
    };
  }

  /**
   * A resposta que corresponde à avaliação do turno `respondido`, montada só com o que está
   * gravado. É a mesma que a primeira chamada devolve, então repetir uma requisição não pode
   * dar resposta diferente.
   */
  private async reconstruir(
    sessao: SessaoComMolde,
    respondido: LabTurno
  ): Promise<RespostaDoTeste> {
    const proximo = await this.db.labTurno.findUnique({
      where: { sessaoId_numero: { sessaoId: sessao.id, numero: respondido.numero + 1 } }
    });
    if (proximo) return this.respostaDeSituacao(sessao, proximo, respondido);

    const final: RespostaDeResultado = {
      tipo: "resultado",
      sessaoId: sessao.id,
      tempoEsgotadoNaAnterior: respondido.tempoEsgotado,
      consequencia: respondido.consequencia,
      resultado: await this.montarVisaoDoResultado(sessao)
    };
    return final;
  }

  private async montarVisaoDoResultado(sessao: LabSessao): Promise<VisaoDoResultado> {
    const [resultado, turnos, perfil] = await Promise.all([
      this.db.labResultado.findUniqueOrThrow({ where: { sessaoId: sessao.id } }),
      this.db.labTurno.findMany({ where: { sessaoId: sessao.id }, orderBy: { numero: "asc" } }),
      this.db.labPerfilSkill.findMany({
        where: { sessaoId: sessao.id, nivelValidado: { not: null } },
        select: { skillId: true, nivelValidado: true }
      })
    ]);
    const niveisValidados = new Map<string, number>();
    for (const p of perfil) {
      if (p.nivelValidado !== null) niveisValidados.set(p.skillId, p.nivelValidado);
    }
    return visaoDoResultado({ sessao, resultado, turnos, niveisValidados });
  }

  // =========================================================================
  // Log
  // =========================================================================

  private dadosDoLog(
    agente: "agente_lab" | "guarda" | "facilitador",
    desfecho: { latenciaMs: number },
    sessaoId: string | null,
    uso: {
      modelo: string;
      versao_instrucao: string;
      tokens_entrada: number | null;
      tokens_saida: number | null;
    }
  ): Prisma.LabLogIaUncheckedCreateInput {
    return {
      agente,
      versaoInstrucao: uso.versao_instrucao,
      modelo: uso.modelo,
      tokensEntrada: uso.tokens_entrada,
      tokensSaida: uso.tokens_saida,
      latenciaMs: desfecho.latenciaMs,
      sucesso: true,
      sessaoId
    };
  }

  /** Registra uma chamada que falhou. Nunca lança: o erro original é o que importa. */
  private async registrarFalha(
    agente: "agente_lab" | "guarda" | "facilitador",
    desfecho: Extract<DesfechoDaChamada<unknown>, { ok: false }>,
    sessaoId: string | null
  ): Promise<void> {
    try {
      await this.db.labLogIa.create({
        data: {
          agente,
          versaoInstrucao: "desconhecida",
          modelo: "desconhecido",
          latenciaMs: desfecho.latenciaMs,
          sucesso: false,
          codigoErro: desfecho.codigo,
          sessaoId
        }
      });
    } catch (erro) {
      this.logger?.warn({ erro }, "falha ao registrar o log de uma chamada à IA que falhou");
    }
    this.logger?.warn(
      { agente, codigo: desfecho.codigo, problemas: desfecho.problemas, sessaoId },
      "chamada à IA falhou"
    );
  }

  private avisar(avisos: string[], contexto: string): void {
    if (avisos.length > 0) this.logger?.warn({ avisos, contexto }, "resposta da IA com desvios");
  }
}
