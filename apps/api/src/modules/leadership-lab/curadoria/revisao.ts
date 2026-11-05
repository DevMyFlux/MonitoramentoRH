// Leadership Lab — a revisão dos resultados pelo curador: a fila, a ficha e a validação.
//
// O curador só enxerga participantes das turmas ATIVAS dele (a matriz "turma"). A fila e as
// contagens filtram por esse conjunto, e cada ação sobre um resultado confere o dono dele; fora da
// turma responde 404, igual a "não existe". Um resultado só é revisável com o teste concluído.
//
// Validar é definitivo: o resultado vira "validado" (ou "ajustado", se o curador trocou o nível de
// alguma skill, com justificativa) e não se valida de novo. A decisão e o registro de quem validou
// andam juntos, numa transação que trava o resultado, então dois curadores não validam o mesmo
// resultado ao mesmo tempo (o segundo recebe 409).
import {
  type LabAtor,
  type LabFichaDeRevisao,
  type LabItemDaRevisao,
  type LabPendencias,
  type LabValidarResultadoEntrada,
  labEstilos,
  labFlexibilidades,
  labLimiteDasListasDoCurador,
  labSkillsPiloto,
  labValidarResultadoEntradaSchema
} from "@my-flux/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { z } from "zod";
import { registrarAuditoria } from "../cadastro/auditoria.js";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { recursoInexistente } from "./acesso.js";
import { errosDaCuradoria } from "./erros.js";
import {
  carregarNomes,
  dentroDe,
  participanteResumido,
  selecaoDaContestacao,
  selecaoDaContribuicao,
  selecaoDoAlerta,
  selecaoDoParticipanteResumido,
  statusDeValidacao,
  visaoDaContestacao,
  visaoDaContribuicao,
  visaoDoAlerta
} from "./visoes.js";

const niveisDoBanco = z.record(
  z.string(),
  z.object({ nivel: z.int().min(1).max(5), media: z.number(), nEvidencias: z.int().min(1) })
);
const opcoesDoBanco = z.array(z.object({ id: z.enum(["A", "B", "C"]), texto: z.string() }));
const textosDoBanco = z.array(z.string());
const ordemDasSkills = new Map<string, number>(labSkillsPiloto.map((s, i) => [s.id, i]));

type FiltroDeStatus = "aguardando_validacao" | "validado" | "ajustado" | "todos";

export class RevisaoDoLab {
  constructor(private readonly db: PrismaClient) {}

  /** Quanto espera uma decisão do curador. Alimenta os números das abas. */
  async pendencias(user: AuthenticatedUser, ator: LabAtor): Promise<LabPendencias> {
    assertAcesso(ator, "revisao:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id, user.role))];
    const doParticipante = { participanteId: { in: participantes } };
    const [resultadosAguardando, alertasAbertos, contestacoesPendentes, contribuicoesPendentes] =
      await Promise.all([
        this.db.labResultado.count({
          where: {
            statusValidacao: "aguardando_validacao",
            sessao: { status: "concluida", ...doParticipante }
          }
        }),
        this.db.labAlerta.count({ where: { status: "aberto", sessao: doParticipante } }),
        this.db.labContestacao.count({
          where: { status: "pendente", resultado: { sessao: doParticipante } }
        }),
        this.db.labContribuicao.count({ where: { status: "pendente", sessao: doParticipante } })
      ]);
    return { resultadosAguardando, alertasAbertos, contestacoesPendentes, contribuicoesPendentes };
  }

  /** A fila: os resultados de testes concluídos dos participantes das turmas do curador. */
  async listar(
    user: AuthenticatedUser,
    ator: LabAtor,
    status: FiltroDeStatus
  ): Promise<LabItemDaRevisao[]> {
    assertAcesso(ator, "revisao:listar");
    const participantes = [...(await carregarParticipantesDasTurmas(this.db, user.id, user.role))];
    const linhas = await this.db.labResultado.findMany({
      where: {
        ...(status === "todos" ? {} : { statusValidacao: status }),
        sessao: { status: "concluida", participanteId: { in: participantes } }
      },
      select: {
        id: true,
        statusValidacao: true,
        aderenciaGeral: true,
        agilidade: true,
        sessao: {
          select: {
            id: true,
            concluidaEm: true,
            molde: { select: { nome: true } },
            participante: { select: selecaoDoParticipanteResumido }
          }
        }
      },
      // O que espera há mais tempo primeiro; o que já foi decidido, o mais recente primeiro.
      orderBy: [
        { sessao: { concluidaEm: status === "aguardando_validacao" ? "asc" : "desc" } },
        { id: "asc" }
      ],
      take: labLimiteDasListasDoCurador
    });

    const sessoes = linhas.map((l) => l.sessao.id);
    const resultados = linhas.map((l) => l.id);
    const [alertas, contestacoes] = await Promise.all([
      this.db.labAlerta.groupBy({
        by: ["sessaoId"],
        where: { status: "aberto", sessaoId: { in: sessoes } },
        _count: { _all: true }
      }),
      this.db.labContestacao.groupBy({
        by: ["resultadoId"],
        where: { status: "pendente", resultadoId: { in: resultados } },
        _count: { _all: true }
      })
    ]);
    const alertasPorSessao = new Map(alertas.map((a) => [a.sessaoId, a._count._all]));
    const contestacoesPorResultado = new Map(
      contestacoes.map((c) => [c.resultadoId, c._count._all])
    );

    return linhas.flatMap((l) =>
      l.sessao.concluidaEm === null
        ? [] // teste concluído sempre tem data (restrição do banco); isto só estreita o tipo
        : [
            {
              resultadoId: l.id,
              sessaoId: l.sessao.id,
              concluidaEm: l.sessao.concluidaEm.toISOString(),
              statusValidacao: statusDeValidacao(l.statusValidacao),
              participante: participanteResumido(l.sessao.participante),
              moldeNome: l.sessao.molde.nome,
              aderenciaGeral: l.aderenciaGeral,
              agilidade: l.agilidade,
              alertasAbertos: alertasPorSessao.get(l.sessao.id) ?? 0,
              contestacoesPendentes: contestacoesPorResultado.get(l.id) ?? 0
            }
          ]
    );
  }

  /** A ficha de um resultado, com tudo o que o curador precisa para validar. */
  async ficha(
    user: AuthenticatedUser,
    ator: LabAtor,
    resultadoId: string
  ): Promise<LabFichaDeRevisao> {
    assertAcesso(ator, "revisao:listar");
    const dono = await this.donoDoResultado(resultadoId);
    if (!dono) recursoInexistente(ator, "resultado:ler");
    const participantesDasTurmas = await carregarParticipantesDasTurmas(
      this.db,
      user.id,
      user.role
    );
    assertAcesso(ator, "resultado:ler", {
      participanteId: dono.participanteId,
      participantesDasTurmas
    });
    return this.montarFicha(this.db, resultadoId);
  }

  /**
   * Valida o resultado. Sem ajustes, vale como está. Com ajustes, o nível de cada skill ajustada
   * é trocado e a justificativa é obrigatória. As demais skills são validadas com o nível calculado.
   */
  async validar(
    user: AuthenticatedUser,
    ator: LabAtor,
    resultadoId: string,
    entradaBruta: unknown
  ): Promise<LabFichaDeRevisao> {
    assertAcesso(ator, "revisao:listar");
    const entrada = labValidarResultadoEntradaSchema.parse(entradaBruta);
    const dono = await this.donoDoResultado(resultadoId);
    if (!dono) recursoInexistente(ator, "resultado:validar");
    const participantesDasTurmas = await carregarParticipantesDasTurmas(
      this.db,
      user.id,
      user.role
    );
    assertAcesso(ator, "resultado:validar", {
      participanteId: dono.participanteId,
      participantesDasTurmas
    });

    await this.db.$transaction(async (tx) => {
      // Trava o resultado: dois curadores (de turmas diferentes) validando ao mesmo tempo se
      // serializam, e o segundo vê o resultado já validado.
      await tx.$queryRaw`SELECT id FROM leadership_lab.resultado WHERE id = ${resultadoId}::uuid FOR UPDATE`;
      const resultado = await tx.labResultado.findUniqueOrThrow({
        where: { id: resultadoId },
        select: { statusValidacao: true, sessaoId: true }
      });
      if (resultado.statusValidacao !== "aguardando_validacao") {
        throw errosDaCuradoria.resultadoJaValidado();
      }

      const perfis = await tx.labPerfilSkill.findMany({ where: { sessaoId: resultado.sessaoId } });
      const ajustes = this.conferirAjustes(entrada, perfis);

      for (const perfil of perfis) {
        await tx.labPerfilSkill.update({
          where: { id: perfil.id },
          data: { validado: true, nivelValidado: ajustes.get(perfil.skillId)?.para ?? perfil.nivel }
        });
      }
      const status = ajustes.size > 0 ? "ajustado" : "validado";
      await tx.labResultado.update({
        where: { id: resultadoId },
        data: {
          statusValidacao: status,
          validadoPor: user.id,
          validadoEm: new Date(),
          justificativaValidacao: entrada.justificativa ?? null
        }
      });
      await registrarAuditoria(tx, user, {
        acao: "APPROVE",
        entidade: "LabResultado",
        entidadeId: resultadoId,
        operacao: dono.operacao,
        antes: { statusValidacao: "aguardando_validacao" },
        depois: {
          statusValidacao: status,
          ajustes: [...ajustes.entries()].map(([skillId, a]) => ({
            skillId,
            de: a.de,
            para: a.para
          }))
        },
        justificativa: entrada.justificativa
      });
    });

    return this.montarFicha(this.db, resultadoId);
  }

  /** Confere os ajustes contra os níveis calculados. Devolve skill → { de, para }. */
  private conferirAjustes(
    entrada: ReturnType<typeof labValidarResultadoEntradaSchema.parse>,
    perfis: ReadonlyArray<{ skillId: string; nivel: number }>
  ): Map<string, { de: number; para: number }> {
    const ajustes = new Map<string, { de: number; para: number }>();
    const calculados = new Map(perfis.map((p) => [p.skillId, p.nivel]));
    for (const ajuste of entrada.ajustes) {
      const de = calculados.get(ajuste.skillId);
      if (de === undefined) {
        throw errosDaCuradoria.ajusteInvalido("a skill não faz parte deste resultado.");
      }
      if (ajustes.has(ajuste.skillId)) {
        throw errosDaCuradoria.ajusteInvalido("a mesma skill foi ajustada duas vezes.");
      }
      if (ajuste.nivel === de) {
        throw errosDaCuradoria.ajusteInvalido("o nível novo é igual ao calculado.");
      }
      ajustes.set(ajuste.skillId, { de, para: ajuste.nivel });
    }
    if (ajustes.size > 0 && entrada.justificativa === undefined) {
      throw errosDaCuradoria.justificativaObrigatoria();
    }
    return ajustes;
  }

  /** O dono do resultado e a operação dele (para o escopo e para a auditoria). */
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

  private async montarFicha(
    db: PrismaClient | Prisma.TransactionClient,
    resultadoId: string
  ): Promise<LabFichaDeRevisao> {
    const resultado = await db.labResultado.findUniqueOrThrow({
      where: { id: resultadoId },
      include: {
        sessao: {
          select: {
            id: true,
            concluidaEm: true,
            molde: { select: { nome: true } },
            participante: { select: selecaoDoParticipanteResumido }
          }
        }
      }
    });
    const sessaoId = resultado.sessao.id;
    const [turnos, perfis, alertas, contribuicoes, contestacoes] = await Promise.all([
      db.labTurno.findMany({ where: { sessaoId }, orderBy: { numero: "asc" } }),
      db.labPerfilSkill.findMany({ where: { sessaoId } }),
      db.labAlerta.findMany({
        where: { sessaoId },
        select: selecaoDoAlerta,
        orderBy: [{ criadoEm: "asc" }, { id: "asc" }]
      }),
      db.labContribuicao.findMany({
        where: { sessaoId },
        select: selecaoDaContribuicao,
        orderBy: [{ criadoEm: "asc" }, { id: "asc" }]
      }),
      db.labContestacao.findMany({
        where: { resultadoId },
        select: selecaoDaContestacao,
        orderBy: [{ criadoEm: "asc" }, { id: "asc" }]
      })
    ]);
    const nomes = await carregarNomes(db, [
      resultado.validadoPor,
      ...alertas.map((a) => a.tratadoPor),
      ...contribuicoes.map((c) => c.decididoPor),
      ...contestacoes.map((c) => c.decididoPor)
    ]);

    const niveis = niveisDoBanco.parse(resultado.niveisPorSkill);
    const validados = new Map(perfis.map((p) => [p.skillId, p.nivelValidado]));
    const concluidaEm = resultado.sessao.concluidaEm;
    if (concluidaEm === null) throw new Error(`Resultado ${resultadoId} de teste não concluído.`);

    return {
      resultadoId,
      sessaoId,
      concluidaEm: concluidaEm.toISOString(),
      statusValidacao: statusDeValidacao(resultado.statusValidacao),
      participante: participanteResumido(resultado.sessao.participante),
      moldeNome: resultado.sessao.molde.nome,
      aderenciaGeral: resultado.aderenciaGeral,
      agilidade: resultado.agilidade,
      estiloPredominante: resultado.estiloPredominante
        ? dentroDe(labEstilos, resultado.estiloPredominante, "Estilo")
        : null,
      flexibilidade: resultado.flexibilidade
        ? dentroDe(labFlexibilidades, resultado.flexibilidade, "Flexibilidade")
        : null,
      flexibilidadePct: resultado.flexibilidadePct,
      resumo: resultado.resumo,
      pontoForte: resultado.pontoForte,
      pontoDesenvolvimento: resultado.pontoDesenvolvimento,
      sugestoes: textosDoBanco.parse(resultado.sugestoes),
      skills: Object.entries(niveis)
        .map(([skillId, n]) => {
          const conhecida = labSkillsPiloto.find((s) => s.id === skillId);
          return {
            skillId,
            nome: conhecida?.nome ?? skillId,
            tipo: conhecida?.tipo ?? null,
            nivelCalculado: n.nivel,
            media: n.media,
            nEvidencias: n.nEvidencias,
            nivelValidado: validados.get(skillId) ?? null
          };
        })
        .sort(
          (a, b) => (ordemDasSkills.get(a.skillId) ?? 99) - (ordemDasSkills.get(b.skillId) ?? 99)
        ),
      situacoes: turnos.map((t) => ({
        numero: t.numero,
        marco: t.marco,
        texto: t.texto,
        opcoes: opcoesDoBanco.parse(t.opcoes),
        escolha: (t.escolha as "A" | "B" | "C" | null) ?? null,
        tempoEsgotado: t.tempoEsgotado,
        aderencia: t.aderencia ?? 0,
        estilo: t.estilo ? dentroDe(labEstilos, t.estilo, "Estilo") : null,
        alertaVermelho: t.alerta === "vermelho",
        tempoRespostaMs: t.tempoRespostaMs,
        justificativa: t.justificativa,
        consequencia: t.consequencia
      })),
      validacao: {
        validadoPor: resultado.validadoPor ? (nomes.get(resultado.validadoPor) ?? null) : null,
        validadoEm: resultado.validadoEm?.toISOString() ?? null,
        justificativa: resultado.justificativaValidacao
      },
      alertas: alertas.map((a) => visaoDoAlerta(a, nomes)),
      contribuicoes: contribuicoes.map((c) => visaoDaContribuicao(c, nomes)),
      contestacoes: contestacoes.map((c) => visaoDaContestacao(c, nomes))
    };
  }
}

export type { LabValidarResultadoEntrada };
