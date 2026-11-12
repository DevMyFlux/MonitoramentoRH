// Leadership Lab — o facilitador do modo demonstração e dos testes. NÃO é IA: responde por regras,
// só com o que veio no pedido (o resultado que o participante já viu). Serve para exercitar a
// conversa ponta a ponta sem o serviço de IA, com o mesmo contrato.
import { labSkillsPiloto } from "@my-flux/shared";
import type { ConversaIaRequest } from "../ia/ia-contrato.js";

const nomeDaSkill = new Map<string, string>(labSkillsPiloto.map((s) => [s.id, s.nome]));

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const AJUDA =
  'Posso comentar o seu resultado: o resumo, o ponto forte, o que desenvolver, o nível de cada skill, as sugestões ou uma situação específica (por exemplo, "o que aconteceu na situação 2?"). O que você quer ver?';

function listar(itens: readonly string[]): string {
  return itens.map((i) => `• ${i}`).join("\n");
}

function explicarSituacao(r: NonNullable<ConversaIaRequest["resultado"]>, numero: number): string {
  const s = r.situacoes.find((x) => x.numero === numero);
  if (!s) return `Este teste não tem a situação ${numero}. Tente uma de 1 a ${r.situacoes.length}.`;
  const escolhida = s.opcoes.find((o) => o.id === s.escolha);
  const partes = [`Situação ${s.numero}${s.marco ? " (o marco do teste)" : ""}: ${s.texto}`];
  if (s.tempo_esgotado || !escolhida) {
    partes.push("O tempo acabou antes de você responder, então ela contou como omissão.");
  } else {
    partes.push(`Você escolheu a opção ${escolhida.id}: ${escolhida.texto}`);
  }
  if (s.justificativa) partes.push(`A avaliação foi: ${s.justificativa}`);
  return partes.join("\n\n");
}

/** A resposta do facilitador de demonstração. Pura: o mesmo pedido dá a mesma resposta. */
export function responderComoFacilitador(pedido: ConversaIaRequest): string {
  const { resultado: r } = pedido;
  const msg = normalizar(pedido.mensagem);
  if (r === null) return responderAprendizagem(pedido, msg);

  const situacao = /situacao\s*(\d{1,2})/.exec(msg) ?? /\b(?:a|na|da)\s+(\d{1,2})\b/.exec(msg);
  if (situacao?.[1]) return explicarSituacao(r, Number(situacao[1]));

  if (/\bmarco\b/.test(msg)) {
    const marco = r.situacoes.find((s) => s.marco);
    return marco ? explicarSituacao(r, marco.numero) : "Este teste não tem uma situação de marco.";
  }
  if (/ponto forte|forte|acertei|fui bem/.test(msg)) {
    return r.ponto_forte
      ? `O seu ponto forte neste teste: ${r.ponto_forte}`
      : "Este resultado não destacou um ponto forte.";
  }
  if (/desenvolv|melhor|fraco|dificuldade|errei|pior/.test(msg)) {
    return r.ponto_desenvolvimento
      ? `O ponto a desenvolver: ${r.ponto_desenvolvimento}`
      : "Este resultado não destacou um ponto de desenvolvimento.";
  }
  if (/sugest|dica|proximo|o que fazer|como evoluir/.test(msg)) {
    return r.sugestoes.length > 0
      ? `Sugestões para você:\n${listar(r.sugestoes)}`
      : "Este resultado não trouxe sugestões.";
  }
  if (/skill|nivel|competencia|habilidade/.test(msg)) {
    return r.skills.length > 0
      ? `Seus níveis neste teste (de 1 a 5):\n${listar(
          r.skills.map((s) => `${nomeDaSkill.get(s.skill) ?? s.skill}: ${s.nivel}/5`)
        )}`
      : "Este teste não avaliou skills.";
  }
  if (/validad|oficial|\brh\b|contest/.test(msg)) {
    return 'O resultado só passa a valer como oficial depois de validado pelo RH. Se discordar de algum ponto, use "Discorda de algum ponto?" nesta tela: o RH da sua turma analisa e responde.';
  }
  if (/resumo|geral|como fui|resultado/.test(msg)) return r.resumo;
  if (/obrigad|valeu|ok\b/.test(msg))
    return "Por nada! Se quiser, posso comentar outro ponto do seu resultado.";
  return AJUDA;
}

/** O modo aprendizagem da demonstração: orienta pelo que o cargo cobra. Não explica norma nenhuma. */
function responderAprendizagem(pedido: ConversaIaRequest, msg: string): string {
  const c = pedido.contexto;
  if (c === null) return AJUDA_DA_APRENDIZAGEM;
  if (/responsabilidade|cargo|o que (se )?espera|meu papel/.test(msg)) {
    return `Neste cargo, o que se espera:\n${listar(c.responsabilidades)}\n\n${c.limite_tecnico}`;
  }
  if (/foco|estudar|desenvolver|melhorar|evoluir|proximo/.test(msg)) {
    const nomes = c.foco.map((s) => nomeDaSkill.get(s) ?? s);
    const fraca = c.perfil?.skills.find((s) => s.recorrente);
    const extra = fraca
      ? `\n\nNos seus testes, vale reforçar: ${nomeDaSkill.get(fraca.skill) ?? fraca.skill}.`
      : "";
    return `As competências que mais pesam neste cargo:\n${listar(nomes)}${extra}`;
  }
  return AJUDA_DA_APRENDIZAGEM;
}

const AJUDA_DA_APRENDIZAGEM =
  "Estou no modo de demonstração e não tenho a base de conhecimento. Posso dizer o que se espera do seu cargo e quais competências vale desenvolver. Para explicações de gestão e procedimentos, é preciso o facilitador com a IA ligada.";
