// Assistente de suporte — a consulta `meus_resultados`: o que a IA pode saber dos resultados do
// Leadership Lab de QUEM ESTÁ PERGUNTANDO, e de ninguém mais.
//
// Princípios:
//  1. O dado nasce do painel do próprio participante (consultarPainel, filtrado pelo vínculo da
//     conta que perguntou e só de testes CONCLUÍDOS): não existe caminho para o resultado de outra
//     pessoa, de uma turma ou da empresa.
//  2. Só o necessário e sem identificação: nada de nome, e-mail, matrícula nem ids. Datas só do dia.
//  3. Os números são os que o sistema calculou (a IA os repete, nunca os recalcula).
//  4. Sem vínculo com um colaborador ou sem testes concluídos, a resposta diz isso, sem inventar.
import type { PainelDoParticipante } from "../leadership-lab/painel/tipos.js";

type Json = Record<string, unknown>;

const dia = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

export const LIMITE_DE_TESTES_NO_RESUMO = 10;

/** Sem vínculo com um colaborador: não há resultado a mostrar. */
export function resumoSemResultados(motivo: "sem_vinculo" | "sem_testes"): Json {
  return {
    resultados_disponiveis: false,
    motivo,
    observacao:
      motivo === "sem_vinculo"
        ? "A conta ainda não está ligada a um colaborador no Leadership Lab; o RH resolve em Participantes."
        : "Ainda não há testes concluídos."
  };
}

export function resumirMeusResultados(painel: PainelDoParticipante, limite: number): Json {
  if (painel.indicadores.testesFeitos === 0) return resumoSemResultados("sem_testes");
  const testes = painel.evolucao.pontos.slice(
    -Math.max(1, Math.min(limite, LIMITE_DE_TESTES_NO_RESUMO))
  );
  const perfil = painel.tipoDePerfil;
  return {
    resultados_disponiveis: true,
    testes_feitos: painel.indicadores.testesFeitos,
    testes_validados_pelo_rh: painel.indicadores.testesValidados,
    aderencia_media: painel.indicadores.aderenciaMedia,
    agilidade_media: painel.indicadores.agilidadeMedia,
    ultimo_teste_em: dia(painel.indicadores.ultimoTesteEm),
    // Do mais antigo ao mais recente (o último é o teste mais novo).
    testes_recentes: testes.map((t) => ({
      concluido_em: dia(t.concluidaEm),
      aderencia_geral: t.aderenciaGeral,
      agilidade: t.agilidade,
      situacoes: t.nSituacoes,
      validado_pelo_rh: t.statusValidacao !== "aguardando_validacao"
    })),
    nivel_por_competencia: painel.skills
      .filter((s) => s.nivel !== null)
      .map((s) => ({
        competencia: s.nome,
        nivel_de_1_a_5: s.nivel,
        validado_pelo_rh: s.validado
      })),
    perfil_de_lideranca: perfil.disponivel
      ? {
          disponivel: true,
          estilo_predominante: perfil.estiloPredominante,
          estilos_empatados: perfil.estilosEmpatados,
          flexibilidade: perfil.flexibilidade,
          flexibilidade_pct: perfil.flexibilidadePct
        }
      : {
          disponivel: false,
          testes_feitos: perfil.testesFeitos,
          testes_necessarios: perfil.testesNecessarios
        },
    alertas: painel.alertas.map((a) => ({
      cor: a.cor,
      competencia: a.skill?.nome ?? null,
      situacao: a.situacao,
      criado_em: dia(a.criadoEm)
    })),
    sugestoes_do_ultimo_debriefing: painel.sugestoes.itens
  };
}
