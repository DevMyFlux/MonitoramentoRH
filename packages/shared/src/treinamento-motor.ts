// Treinamentos Interativos — o motor de regras: das decisões tomadas aos acontecimentos e resultados.
//
// Funções puras (sem banco, sem relógio, sem acaso): as mesmas decisões dão sempre o mesmo
// desfecho. O servidor usa este motor para concluir uma tentativa e para o "e se?" (/simular); a
// tela usa o mesmo cálculo só para desenhar o grafo, nunca para decidir o resultado gravado.
import type {
  TreinoBeat,
  TreinoCenario,
  TreinoCondicao,
  TreinoRegra
} from "./treinamento-schema.js";

/** Decisão cumprida (true) ou não (false), por id de decisão. Todas as 5 são obrigatórias. */
export type TreinoDecisoes = Readonly<Record<string, boolean>>;
/** Alternativa escolhida (0 a 3) por id de pergunta. */
export type TreinoEscolhas = Readonly<Record<string, number>>;
export type TreinoNivel = "ok" | "warn" | "bad";

/** Uma condição avaliada: o que a regra pedia e se valeu. É a "cadeia de causas" do grafo. */
export type TreinoCausa = TreinoCondicao & { valeu: boolean };

export type TreinoAcontecimento = {
  id: string;
  label: string;
  tone: "good" | "bad";
  aconteceu: boolean;
  /** As condições que decidiram este resultado (as que valeram, se aconteceu; as que falharam, se não). */
  causas: TreinoCausa[];
};

export type TreinoResultado = {
  id: string;
  label: string;
  nivel: TreinoNivel;
  /** O texto do nível alcançado (levels.ok/warn/bad). */
  texto: string;
  causas: TreinoCausa[];
};

export type TreinoDesfecho = {
  events: TreinoAcontecimento[];
  outcomes: TreinoResultado[];
};

/** Erro de uso do motor (decisões incompletas, escolha fora da faixa...), com código TREINO_. */
export class TreinoErroDoMotor extends Error {
  constructor(
    readonly code: "TREINO_DECISOES_INCOMPLETAS" | "TREINO_ESCOLHA_INVALIDA",
    message: string
  ) {
    super(message);
    this.name = "TreinoErroDoMotor";
  }
}

function valorDa(
  condicao: TreinoCondicao,
  decisoes: TreinoDecisoes,
  eventos: ReadonlyMap<string, boolean>
): boolean {
  const atual = "decision" in condicao ? decisoes[condicao.decision] : eventos.get(condicao.event);
  return atual === condicao.is;
}

/**
 * Avalia uma regra: TODAS as condições de `all` e AO MENOS UMA de `any` (quando houver). Devolve
 * também as causas: se a regra valeu, as condições que a sustentaram; se não, as que falharam.
 */
function avaliarRegra(
  regra: TreinoRegra,
  decisoes: TreinoDecisoes,
  eventos: ReadonlyMap<string, boolean>
): { valeu: boolean; causas: TreinoCausa[] } {
  const todas = (regra.all ?? []).map((c) => ({ ...c, valeu: valorDa(c, decisoes, eventos) }));
  const alguma = (regra.any ?? []).map((c) => ({ ...c, valeu: valorDa(c, decisoes, eventos) }));
  const todasValem = todas.every((c) => c.valeu);
  const algumaVale = alguma.length === 0 || alguma.some((c) => c.valeu);
  const valeu = todasValem && algumaVale;
  const causas = valeu
    ? [...todas, ...alguma.filter((c) => c.valeu)]
    : [...todas.filter((c) => !c.valeu), ...(algumaVale ? [] : alguma)];
  return { valeu, causas };
}

function exigirDecisoes(cenario: TreinoCenario, decisoes: TreinoDecisoes): void {
  const faltando = cenario.decisions.filter((d) => typeof decisoes[d.id] !== "boolean");
  if (faltando.length)
    throw new TreinoErroDoMotor(
      "TREINO_DECISOES_INCOMPLETAS",
      `Faltam decisões: ${faltando.map((d) => d.id).join(", ")}.`
    );
}

/** O desfecho de um conjunto de decisões: acontecimentos (em ordem) e resultados. Determinístico. */
export function evaluate(cenario: TreinoCenario, decisoes: TreinoDecisoes): TreinoDesfecho {
  exigirDecisoes(cenario, decisoes);
  const ocorridos = new Map<string, boolean>();
  const events = cenario.events.map((evento) => {
    const { valeu, causas } = avaliarRegra(evento.when, decisoes, ocorridos);
    ocorridos.set(evento.id, valeu);
    return { id: evento.id, label: evento.label, tone: evento.tone, aconteceu: valeu, causas };
  });
  const outcomes = cenario.outcomes.map((resultado) => {
    const ok = avaliarRegra(resultado.when.ok, decisoes, ocorridos);
    if (ok.valeu)
      return {
        id: resultado.id,
        label: resultado.label,
        nivel: "ok" as const,
        texto: resultado.levels.ok,
        causas: ok.causas
      };
    const warn = avaliarRegra(resultado.when.warn, decisoes, ocorridos);
    if (warn.valeu)
      return {
        id: resultado.id,
        label: resultado.label,
        nivel: "warn" as const,
        texto: resultado.levels.warn,
        causas: warn.causas
      };
    return {
      id: resultado.id,
      label: resultado.label,
      nivel: "bad" as const,
      texto: resultado.levels.bad,
      causas: [...ok.causas, ...warn.causas]
    };
  });
  return { events, outcomes };
}

/** Converte as alternativas escolhidas (0 a 3 por pergunta) em decisões cumpridas ou não. */
export function takenFromPicks(
  cenario: TreinoCenario,
  picks: TreinoEscolhas
): Record<string, boolean> {
  const decisoes: Record<string, boolean> = {};
  for (const pergunta of cenario.questions) {
    const escolha = picks[pergunta.id];
    if (escolha === undefined)
      throw new TreinoErroDoMotor(
        "TREINO_DECISOES_INCOMPLETAS",
        `Falta a resposta da pergunta "${pergunta.id}".`
      );
    const alternativa = Number.isInteger(escolha) ? pergunta.alternatives[escolha] : undefined;
    if (!alternativa)
      throw new TreinoErroDoMotor(
        "TREINO_ESCOLHA_INVALIDA",
        `Alternativa ${String(escolha)} não existe na pergunta "${pergunta.id}".`
      );
    decisoes[pergunta.decision] = alternativa.taken;
  }
  return decisoes;
}

/** A reação de uma alternativa (o que a pessoa vê logo depois de responder). */
export function reacaoDaAlternativa(
  cenario: TreinoCenario,
  perguntaId: string,
  alternativa: number
): TreinoBeat {
  const pergunta = cenario.questions.find((q) => q.id === perguntaId);
  const escolhida =
    pergunta && Number.isInteger(alternativa) ? pergunta.alternatives[alternativa] : undefined;
  if (!escolhida)
    throw new TreinoErroDoMotor(
      "TREINO_ESCOLHA_INVALIDA",
      `Alternativa ${String(alternativa)} não existe na pergunta "${perguntaId}".`
    );
  return escolhida.beat;
}

/**
 * O que o participante pode ver ANTES de responder: textos da cena e das perguntas, sem o
 * gabarito. Ficam de fora: `taken`, `beat` (tom e reação), a decisão ligada a cada pergunta, as
 * decisões com seus procedimentos e as regras de acontecimentos e resultados. Montado campo a
 * campo (lista do que entra), para um campo novo no cenário não vazar por engano.
 */
export function visaoDoParticipante(cenario: TreinoCenario) {
  return {
    slug: cenario.slug,
    area: cenario.area,
    title: cenario.title,
    summary: cenario.summary,
    exemplo: cenario.exemplo,
    scenePack: cenario.scenePack,
    intro: { title: cenario.intro.title, captions: [...cenario.intro.captions] },
    questions: cenario.questions.map((q) => ({
      id: q.id,
      shot: q.shot,
      time: q.time,
      narration: q.narration,
      prompt: q.prompt,
      alternatives: q.alternatives.map((a, indice) => ({ indice, text: a.text }))
    }))
  };
}
export type TreinoVisaoDoParticipante = ReturnType<typeof visaoDoParticipante>;
