// Leadership Lab — turmas do curador: os grupos de participantes que ele acompanha.
//
// A turma é o que define o que um curador enxerga dos resultados (a matriz "turma"): só os
// participantes das turmas ATIVAS dele. Por isso cada curador só lê e mexe nas PRÓPRIAS turmas: a
// turma de outro curador responde "não encontrado", igual ao que não existe.
//
// Tirar alguém da turma, ou encerrá-la, faz o curador deixar de ver os resultados dessa pessoa
// (inclusive os que aguardavam validação). Nada é apagado e a pessoa pode voltar.
import {
  type LabAtor,
  type LabAtualizarTurmaEntrada,
  type LabCriarTurmaEntrada,
  type LabIncluirNaTurmaEntrada,
  type LabTurmaDetalhe,
  type LabTurmaResumo
} from "@my-flux/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { assertAcesso } from "../lab-access.js";
import { registrarAuditoria } from "./auditoria.js";
import { errosDoCadastro } from "./erros.js";
import { colaboradorNoEscopo } from "./escopo.js";
import { selecaoDoParticipante, visaoDoParticipante } from "./visoes.js";

const selecaoDaTurma = {
  id: true,
  nome: true,
  ativa: true,
  criadoEm: true,
  _count: { select: { participantes: true } }
} satisfies Prisma.LabTurmaSelect;
type TurmaLida = Prisma.LabTurmaGetPayload<{ select: typeof selecaoDaTurma }>;

function resumo(t: TurmaLida): LabTurmaResumo {
  return {
    id: t.id,
    nome: t.nome,
    ativa: t.ativa,
    criadaEm: t.criadoEm.toISOString(),
    nParticipantes: t._count.participantes
  };
}

export class TurmasDoLab {
  constructor(private readonly db: PrismaClient) {}

  /** As turmas do próprio curador, as ativas primeiro. */
  async listar(user: AuthenticatedUser, ator: LabAtor): Promise<LabTurmaResumo[]> {
    assertAcesso(ator, "turma:listar");
    const linhas = await this.db.labTurma.findMany({
      where: user.role === "DEV" ? {} : { curadorId: user.id },
      select: selecaoDaTurma,
      orderBy: [{ ativa: "desc" }, { criadoEm: "desc" }, { id: "asc" }]
    });
    return linhas.map(resumo);
  }

  async detalhar(user: AuthenticatedUser, ator: LabAtor, id: string): Promise<LabTurmaDetalhe> {
    assertAcesso(ator, "turma:listar");
    const turma = await this.db.labTurma.findFirst({
      where: user.role === "DEV" ? { id } : { id, curadorId: user.id },
      select: {
        ...selecaoDaTurma,
        participantes: {
          select: { participante: { select: selecaoDoParticipante } },
          orderBy: [{ participante: { employee: { name: "asc" } } }, { participanteId: "asc" }]
        }
      }
    });
    if (!turma) throw errosDoCadastro.naoEncontrado();
    return {
      ...resumo(turma),
      participantes: turma.participantes.map((p) => visaoDoParticipante(p.participante))
    };
  }

  async criar(
    user: AuthenticatedUser,
    ator: LabAtor,
    entrada: LabCriarTurmaEntrada
  ): Promise<LabTurmaResumo> {
    assertAcesso(ator, "turma:criar");
    return this.db.$transaction(async (tx) => {
      const criada = await tx.labTurma.create({
        data: { nome: entrada.nome, curadorId: user.id },
        select: selecaoDaTurma
      });
      await registrarAuditoria(tx, user, {
        acao: "CREATE",
        entidade: "LabTurma",
        entidadeId: criada.id,
        depois: { nome: criada.nome, ativa: criada.ativa }
      });
      return resumo(criada);
    });
  }

  /** Renomeia e/ou encerra e reabre a turma. */
  async atualizar(
    user: AuthenticatedUser,
    ator: LabAtor,
    id: string,
    entrada: LabAtualizarTurmaEntrada
  ): Promise<LabTurmaResumo> {
    assertAcesso(ator, "turma:atualizar");
    const atual = await this.turmaDoCuradorOuFalha(user, id);
    const dados = {
      ...(entrada.nome !== undefined ? { nome: entrada.nome } : {}),
      ...(entrada.ativa !== undefined ? { ativa: entrada.ativa } : {})
    };
    const mudou =
      (entrada.nome !== undefined && entrada.nome !== atual.nome) ||
      (entrada.ativa !== undefined && entrada.ativa !== atual.ativa);
    if (!mudou) return this.resumoDe(id);

    return this.db.$transaction(async (tx) => {
      const nova = await tx.labTurma.update({ where: { id }, data: dados, select: selecaoDaTurma });
      await registrarAuditoria(tx, user, {
        acao: "UPDATE",
        entidade: "LabTurma",
        entidadeId: id,
        antes: { nome: atual.nome, ativa: atual.ativa },
        depois: { nome: nova.nome, ativa: nova.ativa }
      });
      return resumo(nova);
    });
  }

  /** Inclui um participante ATIVO, de colaborador do escopo do RH, numa turma ATIVA. */
  async incluir(
    user: AuthenticatedUser,
    ator: LabAtor,
    id: string,
    entrada: LabIncluirNaTurmaEntrada
  ): Promise<LabTurmaDetalhe> {
    assertAcesso(ator, "turma:atualizar");
    const turma = await this.turmaDoCuradorOuFalha(user, id);

    const participante = await this.db.labParticipante.findUnique({
      where: { id: entrada.participanteId },
      select: selecaoDoParticipante
    });
    if (!participante) throw errosDoCadastro.naoEncontrado();
    // O curador só põe na turma quem ele pode enxergar no cadastro: o mesmo escopo.
    assertAcesso(ator, "participante:listar", {
      dentroDoEscopoDoRh: colaboradorNoEscopo(user, participante.employee.operation)
    });

    if (!turma.ativa) throw errosDoCadastro.turmaInativa();
    if (!participante.ativo) throw errosDoCadastro.participanteInativo();

    try {
      await this.db.$transaction(async (tx) => {
        await tx.labTurmaParticipante.create({
          data: { turmaId: id, participanteId: participante.id }
        });
        await registrarAuditoria(tx, user, {
          acao: "UPDATE",
          entidade: "LabTurma",
          entidadeId: id,
          operacao: participante.employee.operation,
          depois: { participanteIncluido: participante.id }
        });
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw errosDoCadastro.participanteJaNaTurma();
      }
      throw erro;
    }
    return this.detalhar(user, ator, id);
  }

  /** Tira um participante da turma. Quem não está nela responde "não encontrado". */
  async remover(
    user: AuthenticatedUser,
    ator: LabAtor,
    id: string,
    participanteId: string
  ): Promise<LabTurmaDetalhe> {
    assertAcesso(ator, "turma:atualizar");
    await this.turmaDoCuradorOuFalha(user, id);

    await this.db.$transaction(async (tx) => {
      const { count } = await tx.labTurmaParticipante.deleteMany({
        where: { turmaId: id, participanteId }
      });
      if (count === 0) throw errosDoCadastro.naoEncontrado();
      await registrarAuditoria(tx, user, {
        acao: "UPDATE",
        entidade: "LabTurma",
        entidadeId: id,
        antes: { participanteNaTurma: participanteId },
        depois: { participanteRemovido: participanteId }
      });
    });
    return this.detalhar(user, ator, id);
  }

  private async turmaDoCuradorOuFalha(user: AuthenticatedUser, id: string) {
    const turma = await this.db.labTurma.findFirst({
      where: user.role === "DEV" ? { id } : { id, curadorId: user.id },
      select: { id: true, nome: true, ativa: true }
    });
    if (!turma) throw errosDoCadastro.naoEncontrado();
    return turma;
  }

  private async resumoDe(id: string): Promise<LabTurmaResumo> {
    return resumo(
      await this.db.labTurma.findUniqueOrThrow({ where: { id }, select: selecaoDaTurma })
    );
  }
}
