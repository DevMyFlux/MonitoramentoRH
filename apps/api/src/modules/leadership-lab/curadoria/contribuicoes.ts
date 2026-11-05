// Leadership Lab — as contribuições dos participantes (ideias que melhoram o procedimento).
//
// Nascem durante o teste, já tratadas pela Guarda (texto bloqueado nunca é gravado), e entram na fila
// do curador. Aprovar ou rejeitar é definitivo e não tem efeito automático sobre mais nada: é o
// registro da decisão. De dois curadores simultâneos, um decide e o outro recebe 409.
import {
  type LabAtor,
  type LabContribuicaoDoCurador,
  labDecidirContribuicaoEntradaSchema,
  labLimiteDasListasDoCurador
} from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { registrarAuditoria } from "../cadastro/auditoria.js";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { recursoInexistente } from "./acesso.js";
import { errosDaCuradoria } from "./erros.js";
import { carregarNomes, selecaoDaContribuicao, visaoDaContribuicao } from "./visoes.js";

export class ContribuicoesDoLab {
  constructor(private readonly db: PrismaClient) {}

  async listar(
    user: AuthenticatedUser,
    ator: LabAtor,
    status: "pendente" | "aprovada" | "rejeitada" | "todas"
  ): Promise<LabContribuicaoDoCurador[]> {
    assertAcesso(ator, "contribuicao:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id, user.role))];
    const linhas = await this.db.labContribuicao.findMany({
      where: {
        ...(status === "todas" ? {} : { status }),
        sessao: { participanteId: { in: participantes } }
      },
      select: selecaoDaContribuicao,
      orderBy: [{ criadoEm: status === "pendente" ? "asc" : "desc" }, { id: "asc" }],
      take: labLimiteDasListasDoCurador
    });
    const nomes = await carregarNomes(
      this.db,
      linhas.map((l) => l.decididoPor)
    );
    return linhas.map((l) => visaoDaContribuicao(l, nomes));
  }

  async decidir(
    user: AuthenticatedUser,
    ator: LabAtor,
    contribuicaoId: string,
    entradaBruta: unknown
  ): Promise<LabContribuicaoDoCurador> {
    assertAcesso(ator, "contribuicao:listar");
    const entrada = labDecidirContribuicaoEntradaSchema.parse(entradaBruta);
    const contribuicao = await this.db.labContribuicao.findUnique({
      where: { id: contribuicaoId },
      select: selecaoDaContribuicao
    });
    if (!contribuicao) recursoInexistente(ator, "contribuicao:decidir");
    const participantesDasTurmas = await carregarParticipantesDasTurmas(
      this.db,
      user.id,
      user.role
    );
    assertAcesso(ator, "contribuicao:decidir", {
      participanteId: contribuicao.sessao.participante.id,
      participantesDasTurmas
    });

    await this.db.$transaction(async (tx) => {
      const { count } = await tx.labContribuicao.updateMany({
        where: { id: contribuicaoId, status: "pendente" },
        data: { status: entrada.decisao, decididoPor: user.id, decididoEm: new Date() }
      });
      if (count === 0) throw errosDaCuradoria.jaDecidido();
      await registrarAuditoria(tx, user, {
        acao: entrada.decisao === "aprovada" ? "APPROVE" : "REJECT",
        entidade: "LabContribuicao",
        entidadeId: contribuicaoId,
        operacao: contribuicao.sessao.participante.employee.operation,
        antes: { status: "pendente" },
        depois: { status: entrada.decisao }
      });
    });

    const atual = await this.db.labContribuicao.findUniqueOrThrow({
      where: { id: contribuicaoId },
      select: selecaoDaContribuicao
    });
    return visaoDaContribuicao(atual, await carregarNomes(this.db, [atual.decididoPor]));
  }
}
