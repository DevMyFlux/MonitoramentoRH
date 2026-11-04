// Leadership Lab — cadastro dos participantes: ligar um login (perfil COMUM) a um colaborador.
//
// Quem faz é o RH (curador), e só para colaboradores das operações do seu escopo. A regra de acesso
// é a da matriz (participante:*); a consulta filtra pelo escopo e cada ação sobre um alvo confere
// o escopo dele, respondendo "não encontrado" (404) igual ao que não existe.
//
// Nada é apagado: desativar tira o acesso e preserva o histórico (a política de retenção é decisão
// aberta com o jurídico). Toda mudança grava o AuditLog na mesma transação.
import {
  type LabAtor,
  type LabAtualizarParticipanteEntrada,
  type LabCadastrarParticipanteEntrada,
  type LabColaboradorDoCadastro,
  type LabParticipanteDoCadastro,
  type LabUsuarioElegivel,
  labLimiteDeBusca
} from "@my-flux/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { assertAcesso } from "../lab-access.js";
import { registrarAuditoria } from "./auditoria.js";
import { errosDoCadastro } from "./erros.js";
import { colaboradorNoEscopo, operacoesAtivasDoEscopo, operacoesDoEscopo } from "./escopo.js";
import {
  selecaoDoColaborador,
  selecaoDoParticipante,
  visaoDoColaborador,
  visaoDoParticipante
} from "./visoes.js";

/** Quem está de licença ou de férias continua sendo colaborador; desligado e inativo, não. */
const SITUACOES_ELEGIVEIS = ["ACTIVE", "ON_LEAVE", "VACATION"] as const;

/** Trava de segurança da listagem. O piloto tem de 8 a 12 líderes; isto só impede resposta enorme. */
const LIMITE_DA_LISTA = 500;

export class ParticipantesDoLab {
  constructor(private readonly db: PrismaClient) {}

  /** Os participantes (ativos e desativados) das operações do escopo do RH. */
  async listar(user: AuthenticatedUser, ator: LabAtor): Promise<LabParticipanteDoCadastro[]> {
    assertAcesso(ator, "participante:listar");
    const linhas = await this.db.labParticipante.findMany({
      where: { employee: { operation: operacoesDoEscopo(user) } },
      select: selecaoDoParticipante,
      orderBy: [{ ativo: "desc" }, { employee: { name: "asc" } }, { id: "asc" }],
      take: LIMITE_DA_LISTA
    });
    return linhas.map(visaoDoParticipante);
  }

  /**
   * Colaboradores que ainda podem virar participante: do escopo, ativos, de operação ativa e sem
   * vínculo. Só responde a uma BUSCA (o mínimo de letras é do contrato): não lista todo mundo.
   */
  async colaboradoresElegiveis(
    user: AuthenticatedUser,
    ator: LabAtor,
    busca: string
  ): Promise<LabColaboradorDoCadastro[]> {
    assertAcesso(ator, "participante:listar");
    const linhas = await this.db.employee.findMany({
      where: {
        recordStatus: "ACTIVE",
        status: { in: [...SITUACOES_ELEGIVEIS] },
        labParticipante: null,
        operation: operacoesAtivasDoEscopo(user),
        OR: [
          { name: { contains: busca, mode: "insensitive" } },
          { identifier: { contains: busca, mode: "insensitive" } }
        ]
      },
      select: selecaoDoColaborador,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: labLimiteDeBusca
    });
    return linhas.map(visaoDoColaborador);
  }

  /** Usuários de perfil comum, ativos e ainda sem vínculo. Também só responde a uma busca. */
  async usuariosElegiveis(ator: LabAtor, busca: string): Promise<LabUsuarioElegivel[]> {
    assertAcesso(ator, "participante:listar");
    const linhas = await this.db.user.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        role: { name: "COMUM" },
        labParticipante: null,
        OR: [
          { name: { contains: busca, mode: "insensitive" } },
          { email: { contains: busca, mode: "insensitive" } }
        ]
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: labLimiteDeBusca
    });
    return linhas.map((u) => ({ id: u.id, nome: u.name, email: u.email }));
  }

  async cadastrar(
    user: AuthenticatedUser,
    ator: LabAtor,
    entrada: LabCadastrarParticipanteEntrada
  ): Promise<LabParticipanteDoCadastro> {
    assertAcesso(ator, "participante:cadastrar");

    const colaborador = await this.db.employee.findUnique({
      where: { id: entrada.employeeId },
      select: { ...selecaoDoColaborador, recordStatus: true, status: true }
    });
    if (!colaborador) throw errosDoCadastro.naoEncontrado();
    assertAcesso(ator, "participante:cadastrar", {
      dentroDoEscopoDoRh: colaboradorNoEscopo(user, colaborador.operation)
    });

    const operacao = await this.db.operation.findUniqueOrThrow({
      where: { id: colaborador.operation.id },
      select: { status: true }
    });
    const colaboradorElegivel =
      colaborador.recordStatus === "ACTIVE" &&
      (SITUACOES_ELEGIVEIS as readonly string[]).includes(colaborador.status) &&
      operacao.status === "ACTIVE";
    if (!colaboradorElegivel) throw errosDoCadastro.colaboradorNaoElegivel();

    const usuario = await this.db.user.findUnique({
      where: { id: entrada.userId },
      select: { id: true, isActive: true, status: true, role: { select: { name: true } } }
    });
    if (
      !usuario ||
      !usuario.isActive ||
      usuario.status !== "ACTIVE" ||
      usuario.role.name !== "COMUM"
    ) {
      throw errosDoCadastro.usuarioNaoElegivel();
    }

    try {
      return await this.db.$transaction(async (tx) => {
        const criado = await tx.labParticipante.create({
          data: { userId: usuario.id, employeeId: colaborador.id, criadoPor: user.id },
          select: selecaoDoParticipante
        });
        await registrarAuditoria(tx, user, {
          acao: "CREATE",
          entidade: "LabParticipante",
          entidadeId: criado.id,
          operacao: colaborador.operation,
          depois: { participanteId: criado.id, userId: usuario.id, employeeId: colaborador.id }
        });
        return visaoDoParticipante(criado);
      });
    } catch (erro) {
      // user_id e employee_id são únicos: o login ou o colaborador já tem vínculo (inclusive o de
      // uma requisição simultânea, que a leitura acima não enxerga).
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw errosDoCadastro.participanteJaCadastrado();
      }
      throw erro;
    }
  }

  /** Desativa ou reativa. Mudar para o mesmo valor não faz nada e não gera registro. */
  async atualizar(
    user: AuthenticatedUser,
    ator: LabAtor,
    id: string,
    entrada: LabAtualizarParticipanteEntrada
  ): Promise<LabParticipanteDoCadastro> {
    const atual = await this.db.labParticipante.findUnique({
      where: { id },
      select: selecaoDoParticipante
    });
    if (!atual) {
      // O mesmo erro do "fora do escopo", depois de conferir o perfil.
      assertAcesso(ator, "participante:atualizar");
      throw errosDoCadastro.naoEncontrado();
    }
    assertAcesso(ator, "participante:atualizar", {
      dentroDoEscopoDoRh: colaboradorNoEscopo(user, atual.employee.operation)
    });
    if (atual.ativo === entrada.ativo) return visaoDoParticipante(atual);

    return this.db.$transaction(async (tx) => {
      const novo = await tx.labParticipante.update({
        where: { id },
        data: { ativo: entrada.ativo },
        select: selecaoDoParticipante
      });
      await registrarAuditoria(tx, user, {
        acao: "UPDATE",
        entidade: "LabParticipante",
        entidadeId: id,
        operacao: atual.employee.operation,
        antes: { ativo: atual.ativo },
        depois: { ativo: novo.ativo }
      });
      return visaoDoParticipante(novo);
    });
  }
}
