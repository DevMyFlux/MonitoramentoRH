// Leadership Lab — fechamento do teste, dentro da transação que aplica a última avaliação.
//
// Os números vêm de calcularResultado (nunca da IA); da IA só entra o texto do debriefing.
// O resultado nasce "aguardando validação": nada vira histórico oficial sem o curador.
import {
  type LabEstilo,
  type TurnoResolvido,
  calcularResultado,
  deveGerarAlertaAmarelo
} from "@my-flux/shared";
import type { LabMolde, LabSessao, Prisma } from "@prisma/client";
import { z } from "zod";
import type { RespostaTurnoIa } from "../ia/ia-contrato.js";

type RespostaFinal = Extract<RespostaTurnoIa, { tipo: "resultado" }>;

const mediasDoResultado = z.record(z.string(), z.object({ media: z.number() }));

export async function fecharTeste(
  tx: Prisma.TransactionClient,
  args: { sessao: LabSessao; molde: LabMolde; agora: Date; resposta: RespostaFinal }
): Promise<void> {
  const { sessao, molde, agora, resposta } = args;

  const turnos = await tx.labTurno.findMany({
    where: { sessaoId: sessao.id },
    orderBy: { numero: "asc" },
    include: { skills: true }
  });
  if (turnos.length !== molde.numeroSituacoes) {
    throw new Error(
      `Fechamento da sessão ${sessao.id}: ${turnos.length} situações, o molde pede ${molde.numeroSituacoes}.`
    );
  }
  if (molde.tempoLimiteS === null) {
    throw new Error(`Fechamento da sessão ${sessao.id}: molde sem tempo limite.`);
  }

  const resolvidos: TurnoResolvido[] = turnos.map((t) => {
    if (t.aderencia === null || t.justificativa === null) {
      throw new Error(`Fechamento da sessão ${sessao.id}: situação ${t.numero} sem avaliação.`);
    }
    return {
      numero: t.numero,
      aderencia: t.aderencia,
      tempoEsgotado: t.tempoEsgotado,
      tempoRespostaMs: t.tempoRespostaMs,
      estilo: t.estilo as LabEstilo | null,
      estiloAdequado: t.estiloAdequado as LabEstilo,
      skills: t.skills.map((s) => s.skillId)
    };
  });

  const calculo = calcularResultado(resolvidos, { tempoLimiteS: molde.tempoLimiteS });

  await tx.labResultado.create({
    data: {
      sessaoId: sessao.id,
      aderenciaGeral: calculo.aderenciaGeral,
      agilidade: calculo.agilidade,
      estiloPredominante: calculo.estiloPredominante,
      flexibilidadePct: calculo.flexibilidadePct,
      flexibilidade: calculo.flexibilidade,
      niveisPorSkill: calculo.niveisPorSkill as unknown as Prisma.InputJsonValue,
      resumo: resposta.resultado.resumo,
      pontoForte: resposta.resultado.ponto_forte,
      pontoDesenvolvimento: resposta.resultado.ponto_desenvolvimento,
      sugestoes: resposta.resultado.sugestoes,
      respostaIa: resposta as unknown as Prisma.InputJsonValue
    }
  });

  const skills = Object.entries(calculo.niveisPorSkill);
  if (skills.length > 0) {
    await tx.labPerfilSkill.createMany({
      data: skills.map(([skillId, n]) => ({
        participanteId: sessao.participanteId,
        skillId,
        sessaoId: sessao.id,
        nivel: n.nivel,
        nEvidencias: n.nEvidencias
      }))
    });
  }

  // Alerta amarelo: a mesma skill com média abaixo de 50 em dois testes seguidos. A série é a
  // dos testes em que a skill teve evidência, então basta olhar o teste anterior dela.
  for (const [skillId, atual] of skills) {
    const anterior = await tx.labPerfilSkill.findFirst({
      where: {
        participanteId: sessao.participanteId,
        skillId,
        sessaoId: { not: sessao.id },
        sessao: { status: "concluida" }
      },
      orderBy: { criadoEm: "desc" },
      include: { sessao: { include: { resultado: { select: { niveisPorSkill: true } } } } }
    });
    const medias = mediasDoResultado.safeParse(anterior?.sessao.resultado?.niveisPorSkill);
    const mediaAnterior = medias.success ? medias.data[skillId]?.media : undefined;
    if (mediaAnterior !== undefined && deveGerarAlertaAmarelo([mediaAnterior, atual.media])) {
      await tx.labAlerta.create({ data: { sessaoId: sessao.id, cor: "amarelo", skillId } });
    }
  }

  await tx.labSessao.update({
    where: { id: sessao.id },
    data: { status: "concluida", concluidaEm: agora }
  });
}
