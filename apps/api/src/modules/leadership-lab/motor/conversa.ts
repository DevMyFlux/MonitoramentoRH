// Leadership Lab — peças puras da conversa com o facilitador (sem banco, sem IA): o contexto que
// vai para a IA e o tratamento do histórico. O motor orquestra; aqui mora o que dá para testar
// sem infraestrutura.
import type { LabMensagemDaConversa } from "@my-flux/shared";
import type { ConversaIaRequest } from "../ia/ia-contrato.js";
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
export function contextoDaConversa(visao: VisaoDoResultado): ConversaIaRequest["resultado"] {
  return {
    resumo: visao.resumo,
    ponto_forte: visao.pontoForte,
    ponto_desenvolvimento: visao.pontoDesenvolvimento,
    sugestoes: visao.sugestoes,
    skills: visao.niveisPorSkill.map((s) => ({
      skill: s.skillId as ConversaIaRequest["resultado"]["skills"][number]["skill"],
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
