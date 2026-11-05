// Leadership Lab — os alertas do curador.
//
// O alerta vermelho nasce na hora em que a escolha é avaliada, para o curador ser avisado sem
// esperar o fim do teste; por isso a lista inclui testes em andamento (e diz isso). Alertas são
// pedagógicos, não disciplinares: encerrar um alerta exige a nota da conversa de desenvolvimento
// (o banco também exige). Encerrar é definitivo e disputado com `updateMany` condicional: de dois
// curadores simultâneos, um encerra e o outro recebe 409.
import {
  type LabAlertaDoCurador,
  type LabAtor,
  labLimiteDasListasDoCurador,
  labTratarAlertaEntradaSchema
} from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { registrarAuditoria } from "../cadastro/auditoria.js";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { recursoInexistente } from "./acesso.js";
import { errosDaCuradoria } from "./erros.js";
import { carregarNomes, selecaoDoAlerta, visaoDoAlerta } from "./visoes.js";

export class AlertasDoLab {
  constructor(private readonly db: PrismaClient) {}

  /** Os alertas dos participantes das turmas do curador. Os vermelhos primeiro, depois os mais antigos. */
  async listar(
    user: AuthenticatedUser,
    ator: LabAtor,
    status: "aberto" | "encerrado" | "todos"
  ): Promise<LabAlertaDoCurador[]> {
    assertAcesso(ator, "alerta:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id, user.role))];
    const linhas = await this.db.labAlerta.findMany({
      where: {
        ...(status === "todos" ? {} : { status }),
        sessao: { participanteId: { in: participantes } }
      },
      select: selecaoDoAlerta,
      orderBy: [{ criadoEm: status === "encerrado" ? "desc" : "asc" }, { id: "asc" }],
      take: labLimiteDasListasDoCurador
    });
    const nomes = await carregarNomes(
      this.db,
      linhas.map((l) => l.tratadoPor)
    );
    const alertas = linhas.map((l) => visaoDoAlerta(l, nomes));
    // Vermelho antes de amarelo, mantendo a ordem de espera dentro de cada cor.
    return [...alertas].sort((a, b) => Number(b.cor === "vermelho") - Number(a.cor === "vermelho"));
  }

  /** Encerra o alerta com a nota da conversa de desenvolvimento. */
  async tratar(
    user: AuthenticatedUser,
    ator: LabAtor,
    alertaId: string,
    entradaBruta: unknown
  ): Promise<LabAlertaDoCurador> {
    assertAcesso(ator, "alerta:listar");
    const entrada = labTratarAlertaEntradaSchema.parse(entradaBruta);
    const alerta = await this.db.labAlerta.findUnique({
      where: { id: alertaId },
      select: selecaoDoAlerta
    });
    if (!alerta) recursoInexistente(ator, "alerta:tratar");
    const participantesDasTurmas = await carregarParticipantesDasTurmas(
      this.db,
      user.id,
      user.role
    );
    assertAcesso(ator, "alerta:tratar", {
      participanteId: alerta.sessao.participante.id,
      participantesDasTurmas
    });

    await this.db.$transaction(async (tx) => {
      const { count } = await tx.labAlerta.updateMany({
        where: { id: alertaId, status: "aberto" },
        data: {
          status: "encerrado",
          tratadoPor: user.id,
          tratadoEm: new Date(),
          nota: entrada.nota
        }
      });
      if (count === 0) throw errosDaCuradoria.alertaJaTratado();
      await registrarAuditoria(tx, user, {
        acao: "UPDATE",
        entidade: "LabAlerta",
        entidadeId: alertaId,
        operacao: alerta.sessao.participante.employee.operation,
        antes: { status: "aberto" },
        depois: { status: "encerrado", cor: alerta.cor }
      });
    });

    const atual = await this.db.labAlerta.findUniqueOrThrow({
      where: { id: alertaId },
      select: selecaoDoAlerta
    });
    return visaoDoAlerta(atual, await carregarNomes(this.db, [atual.tratadoPor]));
  }
}
