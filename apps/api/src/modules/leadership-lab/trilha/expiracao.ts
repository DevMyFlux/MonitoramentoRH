// O teste interno (DEV, ADMIN, RH) parado por tempo demais expira sozinho: um teste de validação
// abandonado não pode prender a conta (nem bloquear o assistente e a aprendizagem). Não há tarefa
// agendada: a conta é conferida quando o dono volta a usar o Lab ou o assistente. O teste do
// participante (COMUM) nunca expira. Nada é apagado: a sessão vira "cancelada", com auditoria.
import { type LabAtor, origemDoPerfil } from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";

export const EXPIRACAO_DO_TESTE_INTERNO_PADRAO_H = 24;

/** Cancela o teste interno em andamento do ator que esteja sem atividade há mais que o prazo. */
export async function expirarTesteInternoParado(
  db: PrismaClient,
  ator: Pick<LabAtor, "userId" | "role" | "participanteId">,
  agora: Date,
  prazoH: number = EXPIRACAO_DO_TESTE_INTERNO_PADRAO_H
): Promise<void> {
  const { participanteId, role, userId } = ator;
  if (participanteId === null || origemDoPerfil(role) !== "interno") return;

  await db.$transaction(async (tx) => {
    const ativa = await tx.labSessao.findFirst({
      where: { participanteId, status: "em_andamento" },
      select: {
        id: true,
        modo: true,
        iniciadaEm: true,
        cenarios: {
          select: { iniciadaEm: true, respostas: { select: { respondidaEm: true } } }
        },
        turnos: { select: { apresentadaEm: true, respondidaEm: true } }
      }
    });
    if (!ativa) return;

    // A última atividade: começar o teste, abrir um cenário ou uma situação, ou responder. Só
    // olhar a tela não conta.
    const momentos = [
      ativa.iniciadaEm,
      ...ativa.cenarios.flatMap((c) => [c.iniciadaEm, ...c.respostas.map((r) => r.respondidaEm)]),
      ...ativa.turnos.flatMap((t) => [t.apresentadaEm, t.respondidaEm])
    ];
    const ultima = Math.max(...momentos.map((m) => m?.getTime() ?? 0));
    if (agora.getTime() - ultima <= prazoH * 3_600_000) return;

    // Condicional: se o teste terminou neste meio-tempo, não há o que cancelar.
    const { count } = await tx.labSessao.updateMany({
      where: { id: ativa.id, status: "em_andamento" },
      data: { status: "cancelada" }
    });
    if (count === 0) return;
    await tx.auditLog.create({
      data: {
        userId,
        userRole: role,
        action: "UPDATE",
        entity: "LabSessao",
        entityId: ativa.id,
        before: { status: "em_andamento", modo: ativa.modo },
        after: { status: "cancelada", motivo: "expiracao-do-teste-interno", prazoHoras: prazoH },
        origin: "api"
      }
    });
  });
}
