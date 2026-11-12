// Leadership Lab — peças puras da conversa com o facilitador (sem banco, sem IA): o contexto que
// vai para a IA e o tratamento do histórico. O motor orquestra; aqui mora o que dá para testar
// sem infraestrutura.
import {
  type LabMensagemDaConversa,
  type LabMoldeNivel,
  fundamentacaoFinal,
  labEnquadramentoPorMolde,
  labRubrica
} from "@my-flux/shared";
import type { BaseDaSituacao, ContextoPedagogicoIa, ConversaIaRequest } from "../ia/ia-contrato.js";
import type { PerfilResumido } from "../personalizacao/perfil-resumido.js";
import type { VisaoDoResultado } from "./visoes.js";

/** O que o participante lê quando a Guarda não deixa a mensagem dele seguir. */
export const RESPOSTA_BLOQUEADA =
  "Não consegui usar essa mensagem. Evite incluir dados pessoais (nomes, matrículas, contatos) e reformule a pergunta sobre o seu resultado.";

/** No lugar de uma mensagem antiga que a Guarda bloqueou: o histórico mantém a ordem, sem o texto. */
export const MENSAGEM_REMOVIDA = "[mensagem removida]";

/**
 * O resultado como a IA o recebe: o mesmo que o participante já viu, sem identificadores, sem
 * aderência nem tempos, e sem nada das opções que ele não escolheu. O nível que vale é o validado
 * pelo RH, quando há.
 */
export function contextoDaConversa(
  visao: VisaoDoResultado
): NonNullable<ConversaIaRequest["resultado"]> {
  return {
    resumo: visao.resumo,
    ponto_forte: visao.pontoForte,
    ponto_desenvolvimento: visao.pontoDesenvolvimento,
    sugestoes: visao.sugestoes,
    skills: visao.niveisPorSkill.map((s) => ({
      skill: s.skillId as NonNullable<ConversaIaRequest["resultado"]>["skills"][number]["skill"],
      nivel: s.nivelValidado ?? s.nivel
    })),
    situacoes: visao.situacoes.map((s) => ({
      numero: s.numero,
      marco: s.marco,
      texto: s.texto,
      opcoes: s.opcoes.map((o) => ({ id: o.id, texto: o.texto })),
      escolha: s.escolha,
      tempo_esgotado: s.tempoEsgotado,
      justificativa: s.justificativa
    }))
  };
}

/**
 * Monta o histórico enviado à IA. As mensagens do participante só entram com o texto que a Guarda
 * liberou (`seguros`, na mesma ordem das mensagens do participante; nulo = bloqueada). As do
 * facilitador vêm do navegador e valem como DADO: a IA não as trata como instrução.
 */
export function historicoSeguro(
  historico: readonly LabMensagemDaConversa[],
  seguros: readonly (string | null)[]
): ConversaIaRequest["historico"] {
  let i = 0;
  return historico.map((m) => {
    if (m.papel === "facilitador") return { papel: m.papel, texto: m.texto };
    const liberado = seguros[i++];
    return { papel: m.papel, texto: liberado ?? MENSAGEM_REMOVIDA };
  });
}

/**
 * O que o cargo cobra, a rubrica em vigor e o histórico resumido, no formato que a IA recebe. É a
 * única porta por onde o enquadramento chega à IA: o que não está aqui, ela não sabe.
 */
export function contextoPedagogico(
  molde: LabMoldeNivel,
  perfil: PerfilResumido | null
): ContextoPedagogicoIa {
  const e = labEnquadramentoPorMolde[molde];
  return {
    rubrica_versao: labRubrica.versao,
    responsabilidades: [...e.responsabilidades],
    foco: [...e.foco],
    profundidade_tecnica: Object.entries(e.profundidadeTecnica).map(([skill, profundidade]) => ({
      skill: skill as ContextoPedagogicoIa["foco"][number],
      profundidade
    })),
    limite_tecnico: e.limiteTecnico,
    dificuldade_base: perfil?.dificuldadeSugerida ?? 1,
    perfil:
      perfil === null || perfil.testesConsiderados === 0
        ? null
        : {
            testes_considerados: perfil.testesConsiderados,
            testes_provisorios: perfil.testesProvisorios,
            skills: perfil.skills.map((s) => ({
              skill: s.skill,
              nivel: s.nivel,
              tendencia: s.tendencia,
              testes: s.testes,
              provisorio: s.provisorio,
              escolhas_fracas: s.escolhasFracas,
              recorrente: s.recorrente
            }))
          }
  };
}

/**
 * A base pedagógica de uma situação como o banco a guarda. A fundamentação que vale é a do backend
 * (`fundamentacaoFinal`): a da IA só conta se a rubrica em vigor também estiver validada. Situação
 * sem `base` (IA antiga, resposta incompleta) é experimental.
 */
export function dadosDaBase(base: BaseDaSituacao | undefined): {
  basePedagogica: { competencias: string[]; dificuldade: number; fontes: string[] } | undefined;
  fundamentacao: "validada" | "experimental";
} {
  return {
    basePedagogica: base
      ? { competencias: base.competencias, dificuldade: base.dificuldade, fontes: base.fontes }
      : undefined,
    fundamentacao: fundamentacaoFinal(base?.fundamentacao)
  };
}
