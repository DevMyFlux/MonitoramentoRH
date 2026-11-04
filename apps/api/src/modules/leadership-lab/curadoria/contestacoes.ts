// Leadership Lab — as contestações: o participante questiona um ponto do próprio resultado, e o
// curador da turma decide.
//
// O participante só contesta o próprio resultado, e só vê as próprias contestações, com a decisão e
// a nota, nunca quem decidiu. A decisão do curador é definitiva, exige a nota (é o que explica a
// decisão ao participante) e NÃO altera o resultado sozinha: ajustar um nível é a validação, e só
// vale enquanto o resultado aguarda validação. Isto está nas decisões que o negócio pode rever.
import {
  type LabAtor,
  type LabContestacaoDoCurador,
  type LabContestacaoPropria,
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
    status: "pendente" | "aceita" | "rejeitada" | "todas"
  ): Promise<LabContestacaoDoCurador[]> {
    assertAcesso(ator, "contestacao:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id))];
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

  async decidir(
    user: AuthenticatedUser,
    ator: LabAtor,
    contestacaoId: string,
    entradaBruta: unknown
  ): Promise<LabContestacaoDoCurador> {
    assertAcesso(ator, "contestacao:listar");
    const entrada = labDecidirContestacaoEntradaSchema.parse(entradaBruta);
    const contestacao = await this.db.labContestacao.findUnique({
      where: { id: contestacaoId },
      select: selecaoDaContestacao
    });
    if (!contestacao) recursoInexistente(ator, "contestacao:decidir");
    const participantesDasTurmas = await carregarParticipantesDasTurmas(this.db, user.id);
    assertAcesso(ator, "contestacao:decidir", {
      participanteId: contestacao.resultado.sessao.participante.id,
      participantesDasTurmas
    });

    await this.db.$transaction(async (tx) => {
      const { count } = await tx.labContestacao.updateMany({
        where: { id: contestacaoId, status: "pendente" },
        data: {
          status: entrada.decisao,
          decididoPor: user.id,
          decididoEm: new Date(),
          notaDecisao: entrada.nota
        }
      });
      if (count === 0) throw errosDaCuradoria.jaDecidido();
      await registrarAuditoria(tx, user, {
        acao: entrada.decisao === "aceita" ? "APPROVE" : "REJECT",
        entidade: "LabContestacao",
        entidadeId: contestacaoId,
        operacao: contestacao.resultado.sessao.participante.employee.operation,
        antes: { status: "pendente" },
        depois: { status: entrada.decisao }
      });
    });

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
