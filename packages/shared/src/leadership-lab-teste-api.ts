// Leadership Lab — o que as rotas do teste por cenários devolvem (/leadership-lab/teste...).
//
// A tela valida cada resposta com estes schemas. NENHUM deles tem o gabarito: as perguntas trazem só o
// texto das alternativas; a reação (tom, título, texto, comandos de cena) só vem DEPOIS de a pessoa
// escolher, e só a da escolhida; as regras e o que cada decisão cumpria só vêm no resultado.
import { z } from "zod";
import { labOrigens } from "./leadership-lab-teste.js";
import { treinoPublicos } from "./treinamento-schema.js";

const publico = z.enum(treinoPublicos);
const origem = z.enum(labOrigens);

/** O cenário como o participante o vê durante o teste (visaoDoParticipante). */
export const labCenarioDoTesteSchema = z.object({
  slug: z.string(),
  area: z.string(),
  title: z.string(),
  summary: z.string(),
  exemplo: z.boolean(),
  scenePack: z.string(),
  intro: z.object({ title: z.string(), captions: z.array(z.string()) }),
  questions: z.array(
    z.object({
      id: z.string(),
      shot: z.string(),
      time: z.string(),
      narration: z.string(),
      prompt: z.string(),
      alternatives: z.array(z.object({ indice: z.number().int(), text: z.string() }))
    })
  )
});

/** A reação de uma alternativa: aparece só depois de escolher. */
export const labReacaoSchema = z.object({
  tone: z.enum(["good", "warn", "bad"]),
  title: z.string(),
  text: z.string(),
  scene: z.record(z.string(), z.string()).default({})
});

export const labRespostaDoCenarioSchema = z.object({
  perguntaId: z.string(),
  alternativa: z.number().int(),
  reacao: labReacaoSchema
});
export type LabRespostaDoCenario = z.infer<typeof labRespostaDoCenarioSchema>;

export const labTrilhaSchema = z.object({
  sessaoId: z.string(),
  origem,
  publico,
  total: z.number().int(),
  /** A ordem (1 a N) do cenário em andamento. */
  atual: z.number().int(),
  concluidos: z.number().int(),
  cenarios: z.array(
    z.object({ ordem: z.number().int(), status: z.enum(["pendente", "em_andamento", "concluida"]) })
  )
});
export type LabTrilha = z.infer<typeof labTrilhaSchema>;

export const labMotivosSemTeste = [
  "termo-pendente",
  "cadastro-incompleto",
  "sem-cenarios",
  "limite-diario",
  "teste-legado-em-andamento"
] as const;
export type LabMotivoSemTeste = (typeof labMotivosSemTeste)[number];

export const labCenarioEmAndamentoSchema = z.object({
  tipo: z.literal("cenario"),
  trilha: labTrilhaSchema,
  cenario: labCenarioDoTesteSchema,
  tentativa: z.object({
    id: z.string(),
    iniciadaEm: z.string(),
    respostas: z.array(labRespostaDoCenarioSchema)
  })
});
export type LabCenarioEmAndamento = z.infer<typeof labCenarioEmAndamentoSchema>;

/** GET /teste/proxima e POST /teste: a trilha em andamento, ou o que iniciar faria. */
export const labTesteProximaSchema = z.discriminatedUnion("tipo", [
  labCenarioEmAndamentoSchema,
  z.object({
    tipo: z.literal("sem-teste"),
    podeIniciar: z.boolean(),
    motivo: z.enum(labMotivosSemTeste).nullable(),
    publico: publico.nullable(),
    total: z.number().int(),
    /** DEV, ADMIN e RH escolhem o público; o COMUM nunca. */
    publicosEscolhiveis: z.array(publico)
  })
]);
export type LabTesteProxima = z.infer<typeof labTesteProximaSchema>;

/** POST /teste/:id/respostas. */
export const labRespostaDeCenarioSchema = labRespostaDoCenarioSchema.extend({
  respondidas: z.number().int()
});

const desfechoSchema = z.object({
  events: z.array(
    z
      .object({ id: z.string(), label: z.string(), tone: z.string(), aconteceu: z.boolean() })
      .passthrough()
  ),
  outcomes: z.array(
    z
      .object({
        id: z.string(),
        label: z.string(),
        nivel: z.enum(["ok", "warn", "bad"]),
        texto: z.string()
      })
      .passthrough()
  )
});
export type LabDesfechoDoCenario = z.infer<typeof desfechoSchema>;

/** POST /teste/:id/concluir. */
export const labConclusaoDoCenarioSchema = z.object({
  ordem: z.number().int(),
  desfecho: desfechoSchema,
  proximo: labCenarioEmAndamentoSchema.nullable(),
  /** Quando era o último cenário: a sessão cujo resultado está pronto. */
  resultadoDaSessao: z.string().nullable()
});
export type LabConclusaoDoCenario = z.infer<typeof labConclusaoDoCenarioSchema>;

/** O resultado de um teste por cenários (GET /sessoes/:id/resultado e /teste/:id/resultado). */
export const labResultadoDosCenariosSchema = z.object({
  modo: z.literal("cenarios"),
  sessaoId: z.string(),
  resultadoId: z.string(),
  origem,
  publico,
  concluidaEm: z.string().nullable(),
  statusValidacao: z.enum(["aguardando_validacao", "validado", "ajustado"]),
  experimental: z.boolean(),
  aderenciaGeral: z.number(),
  agilidade: z.number(),
  resumo: z.string(),
  pontoForte: z.string().nullable(),
  pontoDesenvolvimento: z.string().nullable(),
  sugestoes: z.array(z.string()),
  cenarios: z.array(
    z.object({
      ordem: z.number().int(),
      titulo: z.string(),
      area: z.string(),
      exemplo: z.boolean(),
      scenePack: z.string(),
      versao: z.number().int(),
      decisoes: z.array(
        z.object({ id: z.string(), label: z.string(), procedure: z.string(), cumpriu: z.boolean() })
      ),
      respostas: z.array(
        z.object({
          perguntaId: z.string(),
          prompt: z.string(),
          alternativa: z.number().int(),
          texto: z.string(),
          reacao: labReacaoSchema,
          tempoMs: z.number().nullable()
        })
      ),
      desfecho: desfechoSchema
    })
  )
});
export type LabResultadoDosCenarios = z.infer<typeof labResultadoDosCenariosSchema>;
