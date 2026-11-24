// O fluxo de uma sessão no Palco, em funções puras: em que ponto a pessoa está (para recarregar
// não reiniciar) e como fica a cena depois das reações já vistas.
import type { TreinoVisaoDoParticipante } from "@my-flux/shared";
import type { RespostaDada } from "./api";

export type EtapaDoPalco =
  | { tipo: "abertura" }
  | { tipo: "cena-de-abertura" }
  | { tipo: "pergunta"; indice: number }
  | { tipo: "reacao"; indice: number }
  | { tipo: "concluir" };

export type EstadoDaCena = Readonly<Record<string, string>>;

/** Aplica os comandos de cena sobre o estado atual (o que não vem no comando fica como estava). */
export function aplicarCena(estado: EstadoDaCena, comandos: Readonly<Record<string, string>>) {
  return { ...estado, ...comandos };
}

/** O estado da cena depois de reaplicar, em ordem de pergunta, as reações já vistas. */
export function cenaDepoisDas(
  visao: TreinoVisaoDoParticipante,
  respostas: readonly RespostaDada[],
  inicial: EstadoDaCena = {}
): EstadoDaCena {
  const porPergunta = new Map(respostas.map((r) => [r.perguntaId, r]));
  return visao.questions.reduce<EstadoDaCena>((estado, pergunta) => {
    const resposta = porPergunta.get(pergunta.id);
    return resposta ? aplicarCena(estado, resposta.reacao.scene) : estado;
  }, inicial);
}

/**
 * Onde retomar: sem tentativa, a tela de abertura; com tentativa, a primeira pergunta ainda sem
 * resposta (pula a cena de abertura, que já foi vista); com as 5 respondidas, concluir.
 */
export function etapaDeRetomada(
  visao: TreinoVisaoDoParticipante,
  tentativa: { respostas: readonly RespostaDada[] } | null
): EtapaDoPalco {
  if (!tentativa) return { tipo: "abertura" };
  const respondidas = new Set(tentativa.respostas.map((r) => r.perguntaId));
  const indice = visao.questions.findIndex((q) => !respondidas.has(q.id));
  return indice === -1 ? { tipo: "concluir" } : { tipo: "pergunta", indice };
}

/** A próxima etapa depois de ver a reação da pergunta `indice`. */
export function depoisDaReacao(visao: TreinoVisaoDoParticipante, indice: number): EtapaDoPalco {
  return indice + 1 < visao.questions.length
    ? { tipo: "pergunta", indice: indice + 1 }
    : { tipo: "concluir" };
}
