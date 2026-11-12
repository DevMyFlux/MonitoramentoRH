// Leadership Lab — o histórico individual, resumido para a IA.
//
// A IA não recebe o histórico completo: recebe um resumo curto, sem identificação, só com o que
// ajuda a adaptar a próxima situação (as skills mais relevantes, a tendência de cada uma e a
// dificuldade sugerida). Descreve COMPORTAMENTOS e EVIDÊNCIAS de testes, nunca personalidade. Um
// resultado ainda não validado pelo RH entra, mas sempre marcado como provisório.
//
// `resumirHistorico` é pura (testável sem banco). `carregarPerfilResumido` só lê os dados DESTE
// participante: a consulta é filtrada pelo id dele, então o histórico de outra pessoa nunca entra.
import type { PrismaClient } from "@prisma/client";
import {
  type LabDificuldade,
  type LabMoldeNivel,
  type LabSkillId,
  labEnquadramentoPorMolde,
  labSkillsPiloto
} from "@my-flux/shared";

export type Tendencia = "subindo" | "estavel" | "caindo" | "sem_base";

export type SkillDoPerfilResumido = {
  skill: LabSkillId;
  /** O nível que vale (o validado pelo RH, quando houver; senão, o calculado). */
  nivel: number;
  tendencia: Tendencia;
  /** Quantos testes concluídos têm evidência desta skill. */
  testes: number;
  /** O nível vem de um resultado que o RH ainda não validou. */
  provisorio: boolean;
  /** Escolhas fracas (aderência até 40) nesta skill, somando os testes. */
  escolhasFracas: number;
  /** Fraca de forma recorrente: nível até 2 nos dois últimos testes, ou 2+ escolhas fracas. */
  recorrente: boolean;
};

export type PerfilResumido = {
  testesConsiderados: number;
  testesProvisorios: number;
  skills: SkillDoPerfilResumido[];
  dificuldadeSugerida: LabDificuldade;
};

/** Uma linha de perfil_skill (um nível de uma skill num teste concluído), da mais antiga à mais nova. */
export type LinhaDeNivel = {
  skillId: string;
  nivel: number;
  nivelValidado: number | null;
  validado: boolean;
  sessaoId: string;
};

export type EscolhasFracasPorSkill = ReadonlyMap<string, number>;

/** Máximo de skills no resumo: as mais úteis para adaptar, não o quadro todo. */
export const MAX_SKILLS_NO_RESUMO = 5;

const ehSkillConhecida = new Set<string>(labSkillsPiloto.map((s) => s.id));

function nivelQueVale(l: LinhaDeNivel): number {
  return l.validado && l.nivelValidado !== null ? l.nivelValidado : l.nivel;
}

function tendenciaDe(niveis: readonly number[]): Tendencia {
  if (niveis.length < 2) return "sem_base";
  const delta = niveis[niveis.length - 1]! - niveis[niveis.length - 2]!;
  return delta >= 1 ? "subindo" : delta <= -1 ? "caindo" : "estavel";
}

/** Dificuldade pela média dos níveis nas skills de foco do cargo. Sem histórico: a base. */
export function dificuldadeSugerida(niveisDeFoco: readonly number[]): LabDificuldade {
  if (niveisDeFoco.length === 0) return 1;
  const media = niveisDeFoco.reduce((a, b) => a + b, 0) / niveisDeFoco.length;
  return media >= 3.8 ? 3 : media >= 2.5 ? 2 : 1;
}

export function resumirHistorico(
  molde: LabMoldeNivel,
  linhas: readonly LinhaDeNivel[],
  fracas: EscolhasFracasPorSkill = new Map()
): PerfilResumido {
  const foco = labEnquadramentoPorMolde[molde].foco;
  const porSkill = new Map<string, LinhaDeNivel[]>();
  for (const l of linhas) {
    if (!ehSkillConhecida.has(l.skillId)) continue;
    porSkill.set(l.skillId, [...(porSkill.get(l.skillId) ?? []), l]);
  }

  const todas: SkillDoPerfilResumido[] = [...porSkill.entries()].map(([skillId, hist]) => {
    const niveis = hist.map(nivelQueVale);
    const ultimo = hist[hist.length - 1]!;
    const nFracas = fracas.get(skillId) ?? 0;
    const dois = niveis.slice(-2);
    return {
      skill: skillId as LabSkillId,
      nivel: niveis[niveis.length - 1]!,
      tendencia: tendenciaDe(niveis),
      testes: hist.length,
      provisorio: !ultimo.validado,
      escolhasFracas: nFracas,
      recorrente: (dois.length === 2 && dois.every((n) => n <= 2)) || nFracas >= 2
    };
  });

  // Relevância: primeiro as recorrentes e fracas, dando preferência às skills de foco do cargo;
  // depois a mais forte (para o agente reconhecer o que já foi demonstrado).
  const prioridadeDeFoco = (s: SkillDoPerfilResumido) => {
    const i = foco.indexOf(s.skill);
    return i === -1 ? foco.length : i;
  };
  const fracasPrimeiro = [...todas].sort(
    (a, b) =>
      Number(b.recorrente) - Number(a.recorrente) ||
      a.nivel - b.nivel ||
      prioridadeDeFoco(a) - prioridadeDeFoco(b)
  );
  const escolhidas = fracasPrimeiro.slice(0, MAX_SKILLS_NO_RESUMO - 1);
  const maisForte = [...todas]
    .filter((s) => !escolhidas.includes(s))
    .sort((a, b) => b.nivel - a.nivel || prioridadeDeFoco(a) - prioridadeDeFoco(b))[0];
  const skills = maisForte ? [...escolhidas, maisForte] : escolhidas;

  const sessoes = new Set(linhas.map((l) => l.sessaoId));
  const provisorias = new Set(linhas.filter((l) => !l.validado).map((l) => l.sessaoId));
  const niveisDeFoco = todas.filter((s) => foco.includes(s.skill)).map((s) => s.nivel);

  return {
    testesConsiderados: sessoes.size,
    testesProvisorios: provisorias.size,
    skills,
    dificuldadeSugerida: dificuldadeSugerida(niveisDeFoco)
  };
}

type LinhaBruta = {
  skill_id: string;
  nivel: number;
  nivel_validado: number | null;
  validado: boolean;
  sessao_id: string;
};

/** Lê o histórico DESTE participante e o resume. Nenhuma outra pessoa entra na consulta. */
export async function carregarPerfilResumido(
  db: PrismaClient,
  participanteId: string,
  molde: LabMoldeNivel
): Promise<PerfilResumido> {
  const [niveis, fracas] = await Promise.all([
    db.$queryRaw<LinhaBruta[]>`
      SELECT ps.skill_id, ps.nivel, ps.nivel_validado, ps.validado, ps.sessao_id::text AS sessao_id
        FROM leadership_lab.perfil_skill ps
        JOIN leadership_lab.sessao s ON s.id = ps.sessao_id AND s.status = 'concluida'
       WHERE ps.participante_id = ${participanteId}::uuid
       ORDER BY s.concluida_em ASC, ps.id ASC`,
    db.$queryRaw<Array<{ skill_id: string; n: number }>>`
      SELECT ts.skill_id, COUNT(*)::int AS n
        FROM leadership_lab.turno t
        JOIN leadership_lab.sessao s ON s.id = t.sessao_id AND s.status = 'concluida'
        JOIN leadership_lab.turno_skill ts ON ts.turno_id = t.id
       WHERE s.participante_id = ${participanteId}::uuid AND t.aderencia IS NOT NULL AND t.aderencia <= 40
       GROUP BY ts.skill_id`
  ]);
  return resumirHistorico(
    molde,
    niveis.map((l) => ({
      skillId: l.skill_id,
      nivel: l.nivel,
      nivelValidado: l.nivel_validado,
      validado: l.validado,
      sessaoId: l.sessao_id
    })),
    new Map(fracas.map((f) => [f.skill_id, f.n]))
  );
}
