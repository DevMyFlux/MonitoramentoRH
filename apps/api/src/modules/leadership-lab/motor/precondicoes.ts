// Leadership Lab — "este participante pode iniciar um teste agora e, se não, por quê?".
//
// Uma só fonte de verdade para essa pergunta. É usada por quem INICIA o teste (iniciar() traduz
// cada estado num erro) e por quem só MOSTRA o botão (o painel traduz cada estado num aviso).
// Assim o botão nunca promete o que o servidor vai recusar, nem recusa o que o servidor aceitaria.
//
// A ordem das verificações define quem recebe qual erro e não deve mudar sem decisão explícita:
// termo -> teste em andamento (retoma) -> cargo -> molde do cargo -> molde liberado -> limite do dia.
import type { LabMolde, LabSessao, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { ConfigDoMotor } from "./config.js";
import { inicioDoDia } from "./tempo-do-dia.js";

/** O cliente do Prisma ou uma transação dele: as consultas valem nos dois. */
export type Db = PrismaClient | Prisma.TransactionClient;

export type SessaoComMolde = LabSessao & { molde: LabMolde };

export type MoldePronto = { temas: string[]; tempoLimiteS: number };

/** Molde utilizável: ativo, com tempo limite e com temas. Nulo se não estiver. */
export function moldePronto(molde: LabMolde): MoldePronto | null {
  const temas = z.array(z.string().trim().min(1)).safeParse(molde.temas);
  if (!molde.ativo || molde.tempoLimiteS === null || !temas.success || temas.data.length === 0) {
    return null;
  }
  return { temas: temas.data, tempoLimiteS: molde.tempoLimiteS };
}

/** O molde do cargo do participante, ou o que falta no cadastro para haver um. */
export async function resolverMoldeDoParticipante(
  db: Db,
  participanteId: string
): Promise<{ molde: LabMolde } | { falta: "cargo" | "mapeamento" }> {
  const participante = await db.labParticipante.findUniqueOrThrow({
    where: { id: participanteId },
    select: { employee: { select: { functionId: true } } }
  });
  const funcao = participante.employee.functionId;
  if (funcao === null) return { falta: "cargo" };
  const mapeado = await db.labMoldeCargo.findUnique({
    where: { jobFunctionId: funcao },
    include: { molde: true }
  });
  return mapeado ? { molde: mapeado.molde } : { falta: "mapeamento" };
}

export async function buscarSessaoAtiva(
  db: Db,
  participanteId: string
): Promise<SessaoComMolde | null> {
  return db.labSessao.findFirst({
    where: { participanteId, status: "em_andamento" },
    include: { molde: true }
  });
}

export type EstadoDoInicio =
  /** O termo de ciência da versão atual ainda não foi aceito. */
  | { tipo: "termo-pendente" }
  /** Há um teste em andamento: iniciar de novo o retoma. */
  | { tipo: "continuar"; sessao: SessaoComMolde }
  | { tipo: "cargo-nao-informado" }
  | { tipo: "molde-nao-mapeado" }
  /** O molde do cargo existe, mas não está liberado (desativado, sem tempo ou sem temas). */
  | { tipo: "molde-inativo"; molde: LabMolde }
  | { tipo: "limite-diario"; molde: LabMolde; limite: number }
  | { tipo: "iniciar"; molde: LabMolde; temas: string[] };

export async function avaliarInicio(
  db: Db,
  args: {
    participanteId: string;
    config: Pick<ConfigDoMotor, "versaoTermo" | "limiteTestesDia" | "fusoHorario">;
    agora: Date;
  }
): Promise<EstadoDoInicio> {
  const { participanteId, config, agora } = args;

  const termo = await db.labTermoAceite.findUnique({
    where: { participanteId_versaoTermo: { participanteId, versaoTermo: config.versaoTermo } }
  });
  if (!termo) return { tipo: "termo-pendente" };

  const ativa = await buscarSessaoAtiva(db, participanteId);
  if (ativa) return { tipo: "continuar", sessao: ativa };

  const resolvido = await resolverMoldeDoParticipante(db, participanteId);
  if ("falta" in resolvido) {
    return { tipo: resolvido.falta === "cargo" ? "cargo-nao-informado" : "molde-nao-mapeado" };
  }
  const { molde } = resolvido;

  const pronto = moldePronto(molde);
  if (!pronto) return { tipo: "molde-inativo", molde };

  if (config.limiteTestesDia !== null) {
    const desde = inicioDoDia(agora, config.fusoHorario);
    const hoje = await db.labSessao.count({
      where: {
        participanteId,
        iniciadaEm: { gte: desde },
        status: { in: ["em_andamento", "concluida"] }
      }
    });
    if (hoje >= config.limiteTestesDia) {
      return { tipo: "limite-diario", molde, limite: config.limiteTestesDia };
    }
  }

  return { tipo: "iniciar", molde, temas: pronto.temas };
}
