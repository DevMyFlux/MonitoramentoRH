// Treinamentos Interativos — o contrato de um cenário (o JSON que a autoria escreve).
//
// Um cenário serve a qualquer gestão (manutenção, RH, segurança, operação): o código não muda por
// cenário, só este conteúdo. Ele tem sempre a mesma forma:
//  - 5 DECISÕES (o que se espera que a pessoa faça) e 5 PERGUNTAS, uma por decisão;
//  - cada pergunta tem 4 alternativas; cada alternativa diz se CUMPRE a decisão (`taken`) e qual é a
//    reação dela na cena (`beat`: tom, título, texto e comandos de cena);
//  - ACONTECIMENTOS (`events`), avaliados em ordem, que dependem das decisões e de acontecimentos
//    anteriores;
//  - RESULTADOS (`outcomes`) em três níveis (ok/atenção/ruim), que dependem dos dois.
//
// As validações de autoria (superRefine) recusam um cenário incoerente antes de ele chegar a alguém,
// com o caminho exato do problema (ex.: questions.2.alternatives.1.beat.tone). O cálculo do desfecho
// mora em treinamento-motor.ts (funções puras). O gabarito (`taken`, `beat`, regras) NUNCA vai ao
// navegador antes da hora: veja visaoDoParticipante().
import { z } from "zod";

/** Quantidades fixas do formato (uma sessão é sempre igual: 5 perguntas de 4 alternativas). */
export const TREINO_DECISOES = 5;
export const TREINO_ALTERNATIVAS = 4;

/** Áreas conhecidas (para filtros e rótulos). O schema aceita outras, no mesmo formato de slug. */
export const treinoAreasConhecidas = ["manutencao", "rh", "seguranca", "operacao"] as const;
export const treinoTons = ["good", "warn", "bad"] as const;
export const treinoTonsDeAcontecimento = ["good", "bad"] as const;
export const treinoStatusDoCenario = ["rascunho", "em_revisao", "aprovado", "arquivado"] as const;

const slug = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,47}$/, "Use letras minúsculas, números, _ ou - (até 48).");
const textoCurto = z.string().trim().min(1).max(160);
const textoLongo = z.string().trim().min(1).max(600);

const condicaoSchema = z.union([
  z.strictObject({ decision: slug, is: z.boolean() }),
  z.strictObject({ event: slug, is: z.boolean() })
]);

const regraSchema = z
  .strictObject({
    all: z.array(condicaoSchema).min(1).optional(),
    any: z.array(condicaoSchema).min(1).optional()
  })
  .refine((regra) => regra.all !== undefined || regra.any !== undefined, {
    message: "A regra precisa de 'all' ou 'any'."
  });

/** Comandos de cena: chave e valor curtos (o pacote de cena decide o que cada um faz). */
const cenaSchema = z.record(z.string().regex(/^[a-z][a-zA-Z0-9_]{0,23}$/), z.string().max(80));

const beatSchema = z.strictObject({
  tone: z.enum(treinoTons),
  title: textoCurto,
  text: textoLongo,
  scene: cenaSchema.default({})
});

const alternativaSchema = z.strictObject({
  text: z.string().trim().min(1).max(240),
  taken: z.boolean(),
  beat: beatSchema
});

const perguntaSchema = z.strictObject({
  id: slug,
  decision: slug,
  /** Plano de câmera do pacote de cena (wide, icu, lever...). Desconhecido = plano geral. */
  shot: slug,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário no formato HH:MM."),
  narration: textoLongo,
  prompt: textoCurto,
  alternatives: z.array(alternativaSchema).length(TREINO_ALTERNATIVAS)
});

const decisaoSchema = z.strictObject({
  id: slug,
  label: textoCurto,
  procedure: textoLongo
});

const acontecimentoSchema = z.strictObject({
  id: slug,
  label: textoCurto,
  tone: z.enum(treinoTonsDeAcontecimento),
  when: regraSchema
});

const resultadoSchema = z.strictObject({
  id: slug,
  label: textoCurto,
  levels: z.strictObject({ ok: textoCurto, warn: textoCurto, bad: textoCurto }),
  when: z.strictObject({ ok: regraSchema, warn: regraSchema })
});

const cenarioBaseSchema = z.strictObject({
  slug,
  area: slug,
  title: textoCurto,
  summary: textoLongo,
  /** Conteúdo ainda não validado por segurança do trabalho, RH ou jurídico. A tela avisa. */
  exemplo: z.boolean().default(false),
  /** Vocabulário visual (hospital-energia, hospital-escala...). Desconhecido = pacote genérico. */
  scenePack: slug,
  intro: z.strictObject({
    title: textoCurto,
    captions: z.array(textoLongo).min(1).max(12)
  }),
  decisions: z.array(decisaoSchema).length(TREINO_DECISOES),
  questions: z.array(perguntaSchema).length(TREINO_DECISOES),
  events: z.array(acontecimentoSchema).min(1).max(30),
  outcomes: z.array(resultadoSchema).min(1).max(10)
});

type Regra = z.infer<typeof regraSchema>;

export const treinoCenarioSchema = cenarioBaseSchema.superRefine((cenario, ctx) => {
  const problema = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  // Ids únicos em cada lista.
  for (const lista of ["decisions", "questions", "events", "outcomes"] as const) {
    const vistos = new Set<string>();
    cenario[lista].forEach((item, i) => {
      if (vistos.has(item.id)) problema([lista, i, "id"], `Id repetido: "${item.id}".`);
      vistos.add(item.id);
    });
  }

  // Uma pergunta por decisão, e cada pergunta aponta para uma decisão que existe.
  const decisoes = new Set(cenario.decisions.map((d) => d.id));
  const perguntasPorDecisao = new Map<string, number>();
  cenario.questions.forEach((pergunta, i) => {
    if (!decisoes.has(pergunta.decision))
      problema(["questions", i, "decision"], `Decisão inexistente: "${pergunta.decision}".`);
    perguntasPorDecisao.set(
      pergunta.decision,
      (perguntasPorDecisao.get(pergunta.decision) ?? 0) + 1
    );
  });
  cenario.decisions.forEach((decisao, i) => {
    const total = perguntasPorDecisao.get(decisao.id) ?? 0;
    if (total !== 1)
      problema(
        ["decisions", i, "id"],
        total === 0
          ? `A decisão "${decisao.id}" não tem pergunta.`
          : `A decisão "${decisao.id}" tem ${total} perguntas; deve ter uma.`
      );
  });

  // Alternativas: de 1 a 3 cumprem a decisão (ao menos uma não), e o tom combina com isso.
  cenario.questions.forEach((pergunta, i) => {
    const cumprem = pergunta.alternatives.filter((a) => a.taken).length;
    if (cumprem < 1)
      problema(["questions", i, "alternatives"], "Nenhuma alternativa cumpre a decisão.");
    if (cumprem > TREINO_ALTERNATIVAS - 1)
      problema(
        ["questions", i, "alternatives"],
        "Toda alternativa cumpre a decisão; ao menos uma deve falhar."
      );
    pergunta.alternatives.forEach((alternativa, j) => {
      const caminho = ["questions", i, "alternatives", j, "beat", "tone"];
      if (alternativa.taken && alternativa.beat.tone === "bad")
        problema(caminho, "Alternativa que cumpre a decisão não pode ter tom 'bad'.");
      if (!alternativa.taken && alternativa.beat.tone === "good")
        problema(caminho, "Alternativa que não cumpre a decisão não pode ter tom 'good'.");
    });
  });

  // Regras: só citam decisões que existem; acontecimentos só citam acontecimentos ANTERIORES
  // (o motor avalia em ordem); resultados citam qualquer acontecimento.
  const verificarRegra = (
    regra: Regra,
    caminho: (string | number)[],
    eventosPermitidos: ReadonlySet<string>
  ) => {
    for (const parte of ["all", "any"] as const) {
      regra[parte]?.forEach((condicao, k) => {
        if ("decision" in condicao && !decisoes.has(condicao.decision))
          problema(
            [...caminho, parte, k, "decision"],
            `Decisão inexistente: "${condicao.decision}".`
          );
        if ("event" in condicao && !eventosPermitidos.has(condicao.event))
          problema(
            [...caminho, parte, k, "event"],
            `O acontecimento "${condicao.event}" não existe ou vem depois deste.`
          );
      });
    }
  };
  const anteriores = new Set<string>();
  cenario.events.forEach((evento, i) => {
    verificarRegra(evento.when, ["events", i, "when"], anteriores);
    anteriores.add(evento.id);
  });
  cenario.outcomes.forEach((resultado, i) => {
    verificarRegra(resultado.when.ok, ["outcomes", i, "when", "ok"], anteriores);
    verificarRegra(resultado.when.warn, ["outcomes", i, "when", "warn"], anteriores);
  });
});

export type TreinoCenario = z.infer<typeof treinoCenarioSchema>;
export type TreinoCenarioEntrada = z.input<typeof treinoCenarioSchema>;
export type TreinoRegra = Regra;
export type TreinoCondicao = z.infer<typeof condicaoSchema>;
export type TreinoTom = (typeof treinoTons)[number];
export type TreinoBeat = z.infer<typeof beatSchema>;

/** Um problema de autoria, pronto para a tela: caminho legível e mensagem. */
export type TreinoProblemaDeAutoria = { caminho: string; mensagem: string };

/**
 * Valida um cenário vindo da autoria. Devolve o cenário normalizado ou a lista de problemas com o
 * caminho de cada um (é o que POST /treinamentos/cenarios/validar devolve em `details`).
 */
export function validarCenario(
  entrada: unknown
): { ok: true; cenario: TreinoCenario } | { ok: false; problemas: TreinoProblemaDeAutoria[] } {
  const resultado = treinoCenarioSchema.safeParse(entrada);
  if (resultado.success) return { ok: true, cenario: resultado.data };
  return {
    ok: false,
    problemas: resultado.error.issues.map((issue) => ({
      caminho: issue.path.map(String).join(".") || "(raiz)",
      mensagem: issue.message
    }))
  };
}
