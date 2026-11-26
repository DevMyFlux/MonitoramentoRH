// Leadership Lab — as contestações: o participante questiona um ponto do próprio resultado, e o
// curador da turma decide.
//
// O participante só contesta o próprio resultado, e só vê as próprias contestações, com o estado e
// a justificativa, nunca quem decidiu. O caminho é: aberta (pendente) -> em análise -> deferida
// (aceita) | indeferida (rejeitada); a decisão exige a justificativa (é o que explica a decisão ao
// participante) e é definitiva. Quem decide: o RH (das turmas que acompanha), ADMIN e DEV.
//
// DEFERIR NÃO APAGA NEM ALTERA O RESULTADO: ele continua guardado, igual ao original, e fica
// marcado (`contestacao_deferida_em`). A marca libera uma nova tentativa: a trilha de cenários
// deixa de contar esse teste no limite do dia e nos cenários "já feitos". Ajustar um nível continua
// sendo a validação, e só vale enquanto o resultado aguarda validação.
import {
  type LabAtor,
  type LabContestacaoDoCurador,
  type LabContestacaoPropria,
  type LabContestacaoStatus,
  labCriarContestacaoEntradaSchema,
  labDecidirContestacaoEntradaSchema,
  labLimiteDasListasDoCurador
} from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { registrarAuditoria } from "../cadastro/auditoria.js";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { recursoInexistente } from "./acesso.js";
import { errosDaCuradoria } from "./erros.js";
import {
  carregarNomes,
  selecaoDaContestacao,
  visaoDaContestacao,
  visaoDaContestacaoPropria
} from "./visoes.js";

export class ContestacoesDoLab {
  constructor(private readonly db: PrismaClient) {}

  // ---- Curador ------------------------------------------------------------

  async listar(
    user: AuthenticatedUser,
    ator: LabAtor,
    status: LabContestacaoStatus | "todas"
  ): Promise<LabContestacaoDoCurador[]> {
    assertAcesso(ator, "contestacao:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id, user.role))];
    const linhas = await this.db.labContestacao.findMany({
      where: {
        ...(status === "todas" ? {} : { status }),
        resultado: { sessao: { participanteId: { in: participantes } } }
      },
      select: selecaoDaContestacao,
      orderBy: [{ criadoEm: status === "pendente" ? "asc" : "desc" }, { id: "asc" }],
      take: labLimiteDasListasDoCurador
    });
    const nomes = await carregarNomes(
      this.db,
      linhas.map((l) => l.decididoPor)
    );
    return linhas.map((l) => visaoDaContestacao(l, nomes));
  }

  /** Carrega a contestação e confere o alcance de quem age; ninguém age na PRÓPRIA contestação. */
  private async daqueleQueAge(
    user: AuthenticatedUser,
    ator: LabAtor,
    contestacaoId: string,
    acao: "contestacao:analisar" | "contestacao:decidir"
  ) {
    const contestacao = await this.db.labContestacao.findUnique({
      where: { id: contestacaoId },
      select: selecaoDaContestacao
    });
    if (!contestacao) recursoInexistente(ator, acao);
    const participanteId = contestacao.resultado.sessao.participante.id;
    const participantesDasTurmas = await carregarParticipantesDasTurmas(
      this.db,
      user.id,
      user.role
    );
    assertAcesso(ator, acao, { participanteId, participantesDasTurmas });
    if (ator.participanteId === participanteId) recursoInexistente(ator, acao);
    return contestacao;
  }

  /** Aberta -> em análise: o RH avisa que pegou o caso. Só sai de "pendente". */
  async analisar(
    user: AuthenticatedUser,
    ator: LabAtor,
    contestacaoId: string
  ): Promise<LabContestacaoDoCurador> {
    assertAcesso(ator, "contestacao:analisar");
    const contestacao = await this.daqueleQueAge(user, ator, contestacaoId, "contestacao:analisar");
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.labContestacao.updateMany({
        where: { id: contestacaoId, status: "pendente" },
        data: { status: "em_analise", analisePor: user.id, analiseEm: new Date() }
      });
      if (count === 0) throw errosDaCuradoria.jaDecidido();
      await registrarAuditoria(tx, user, {
        acao: "UPDATE",
        entidade: "LabContestacao",
        entidadeId: contestacaoId,
        operacao: contestacao.resultado.sessao.participante.employee.operation,
        antes: { status: "pendente" },
        depois: { status: "em_analise" }
      });
    });
    return this.visao(contestacaoId);
  }

  /**
   * Decide (deferida ou indeferida), com a justificativa. Vale a partir de "aberta" ou "em análise".
   * Deferir marca o resultado e, com isso, libera uma nova tentativa (o original fica guardado).
   */
  async decidir(
    user: AuthenticatedUser,
    ator: LabAtor,
    contestacaoId: string,
    entradaBruta: unknown
  ): Promise<LabContestacaoDoCurador> {
    assertAcesso(ator, "contestacao:listar");
    const entrada = labDecidirContestacaoEntradaSchema.parse(entradaBruta);
    const contestacao = await this.daqueleQueAge(user, ator, contestacaoId, "contestacao:decidir");

    await this.db.$transaction(async (tx) => {
      const agora = new Date();
      const { count } = await tx.labContestacao.updateMany({
        where: { id: contestacaoId, status: { in: ["pendente", "em_analise"] } },
        data: {
          status: entrada.decisao,
          decididoPor: user.id,
          decididoEm: agora,
          notaDecisao: entrada.nota
        }
      });
      if (count === 0) throw errosDaCuradoria.jaDecidido();
      if (entrada.decisao === "aceita") {
        await tx.labResultado.updateMany({
          where: { id: contestacao.resultado.id, contestacaoDeferidaEm: null },
          data: { contestacaoDeferidaEm: agora }
        });
      }
      await registrarAuditoria(tx, user, {
        acao: entrada.decisao === "aceita" ? "APPROVE" : "REJECT",
        entidade: "LabContestacao",
        entidadeId: contestacaoId,
        operacao: contestacao.resultado.sessao.participante.employee.operation,
        antes: { status: contestacao.status },
        depois: { status: entrada.decisao, liberaNovaTentativa: entrada.decisao === "aceita" }
      });
    });

    return this.visao(contestacaoId);
  }

  private async visao(contestacaoId: string): Promise<LabContestacaoDoCurador> {
    const atual = await this.db.labContestacao.findUniqueOrThrow({
      where: { id: contestacaoId },
      select: selecaoDaContestacao
    });
    return visaoDaContestacao(atual, await carregarNomes(this.db, [atual.decididoPor]));
  }

  // ---- Participante -------------------------------------------------------

  /** O participante contesta um ponto do PRÓPRIO resultado. */
  async criar(
    user: AuthenticatedUser,
    ator: LabAtor,
    resultadoId: string,
    entradaBruta: unknown
  ): Promise<LabContestacaoPropria> {
    assertAcesso(ator, "contestacao:criar");
    const entrada = labCriarContestacaoEntradaSchema.parse(entradaBruta);
    const dono = await this.donoDoResultado(resultadoId);
    if (!dono) recursoInexistente(ator, "contestacao:criar");
    assertAcesso(ator, "contestacao:criar", { participanteId: dono.participanteId });

    return this.db.$transaction(async (tx) => {
      const criada = await tx.labContestacao.create({
        data: { resultadoId, ponto: entrada.ponto, motivo: entrada.motivo }
      });
      await registrarAuditoria(tx, user, {
        acao: "CREATE",
        entidade: "LabContestacao",
        entidadeId: criada.id,
        operacao: dono.operacao,
        depois: { resultadoId, status: "pendente" }
      });
      return visaoDaContestacaoPropria(criada);
    });
  }

  /** As contestações do participante sobre o PRÓPRIO resultado, a mais recente primeiro. */
  async listarProprias(ator: LabAtor, resultadoId: string): Promise<LabContestacaoPropria[]> {
    assertAcesso(ator, "contestacao:ler-proprias");
    const dono = await this.donoDoResultado(resultadoId);
    if (!dono) recursoInexistente(ator, "contestacao:ler-proprias");
    assertAcesso(ator, "contestacao:ler-proprias", { participanteId: dono.participanteId });
    const linhas = await this.db.labContestacao.findMany({
      where: { resultadoId },
      orderBy: [{ criadoEm: "desc" }, { id: "asc" }]
    });
    return linhas.map(visaoDaContestacaoPropria);
  }

  private async donoDoResultado(resultadoId: string) {
    const r = await this.db.labResultado.findUnique({
      where: { id: resultadoId },
      select: {
        sessao: {
          select: {
            participanteId: true,
            participante: { select: { employee: { select: { operation: true } } } }
          }
        }
      }
    });
    if (!r) return null;
    const op = r.sessao.participante.employee.operation;
    return {
      participanteId: r.sessao.participanteId,
      operacao: { id: op.id, companyId: op.companyId, unitId: op.unitId }
    };
  }
}
