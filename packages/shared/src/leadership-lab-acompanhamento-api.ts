// Leadership Lab — o contrato do acompanhamento unificado (visão geral, pessoas, cenários, CSV).
//
// Uma tela só para o RH, o ADMIN e o DEV acompanharem o teste por cenários. Quem vê o quê:
//  - DEV e ADMIN leem tudo;
//  - o RH lê só as pessoas das turmas ATIVAS que acompanha;
//  - quem faz o teste (COMUM) nunca chega aqui: só vê o próprio resultado.
// Os testes "internos" (DEV, ADMIN e RH testando o sistema) nunca entram nas médias, nos funis nem
// na comparação com o grupo: aparecem à parte.
import { z } from "zod";
import { niveisDeGovernanca } from "./conta.js";
import { labContestacaoStatus, labStatusValidacao } from "./leadership-lab.js";
import { treinoPublicos } from "./treinamento-schema.js";

const dataIso = z.iso.datetime();
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.");

/** O teto das listas do acompanhamento (a tela avisa quando há mais do que isto). */
export const labLimiteDoAcompanhamento = 500;

export const labStatusDoAcompanhamento = ["em_andamento", "concluida"] as const;

/** Os filtros, iguais em todas as visões e na exportação. Tudo opcional. */
export const labFiltroDoAcompanhamentoSchema = z.strictObject({
  turmaId: z.uuid().optional(),
  publico: z.enum(treinoPublicos).optional(),
  nivel: z.enum(niveisDeGovernanca).optional(),
  areaId: z.uuid().optional(),
  /** Início do período (dia da sessão, inclusive). */
  de: dia.optional(),
  /** Fim do período (inclusive). */
  ate: dia.optional(),
  status: z.enum(labStatusDoAcompanhamento).optional()
});
export type LabFiltroDoAcompanhamento = z.infer<typeof labFiltroDoAcompanhamentoSchema>;

export const labVisoesDeExportacao = ["sessoes", "cenarios"] as const;
export const labExportacaoEntradaSchema = labFiltroDoAcompanhamentoSchema.extend({
  visao: z.enum(labVisoesDeExportacao).default("sessoes")
});

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

const mediaOuNula = z.number().nullable();

export const labAcompanhamentoResumoSchema = z.object({
  /** Totais só de participantes (origem "participante"). */
  totais: z.object({
    participantes: z.int().min(0),
    iniciaram: z.int().min(0),
    emAndamento: z.int().min(0),
    concluidas: z.int().min(0),
    aderenciaMedia: mediaOuNula,
    agilidadeMedia: mediaOuNula,
    contestacoesAbertas: z.int().min(0)
  }),
  /** Do cadastro ao teste concluído: onde as pessoas ficam pelo caminho. */
  funil: z.object({
    cadastrados: z.int().min(0),
    iniciaram: z.int().min(0),
    concluiram: z.int().min(0)
  }),
  porTurma: z.array(
    z.object({
      turmaId: z.string(),
      nome: z.string(),
      participantes: z.int().min(0),
      iniciaram: z.int().min(0),
      concluiram: z.int().min(0),
      aderenciaMedia: mediaOuNula
    })
  ),
  porPublico: z.array(
    z.object({
      publico: z.enum(treinoPublicos),
      sessoes: z.int().min(0),
      concluidas: z.int().min(0),
      aderenciaMedia: mediaOuNula
    })
  ),
  /** Testes internos (DEV, ADMIN e RH testando o sistema): à parte, fora de qualquer média. */
  internos: z.object({
    sessoes: z.int().min(0),
    concluidas: z.int().min(0)
  }),
  /** As opções dos filtros, já restritas ao que quem pergunta pode ver. */
  opcoes: z.object({
    turmas: z.array(z.object({ id: z.string(), nome: z.string() })),
    areas: z.array(z.object({ id: z.string(), nome: z.string() }))
  })
});
export type LabAcompanhamentoResumo = z.infer<typeof labAcompanhamentoResumoSchema>;

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

const ultimaSessaoSchema = z.object({
  sessaoId: z.string(),
  status: z.enum(labStatusDoAcompanhamento),
  publico: z.enum(treinoPublicos).nullable(),
  iniciadaEm: dataIso,
  concluidaEm: dataIso.nullable(),
  aderenciaGeral: mediaOuNula,
  agilidade: mediaOuNula,
  experimental: z.boolean(),
  /** O resultado foi contestado e a contestação, deferida: o teste não vale e pode ser refeito. */
  contestadoDeferido: z.boolean()
});

export const labAcompanhamentoPessoaSchema = z.object({
  participanteId: z.string(),
  nome: z.string(),
  identificador: z.string(),
  cargo: z.string().nullable(),
  nivel: z.enum(niveisDeGovernanca).nullable(),
  area: z.string().nullable(),
  turmas: z.array(z.string()),
  sessoes: z.int().min(0),
  concluidas: z.int().min(0),
  contestacoesAbertas: z.int().min(0),
  ultima: ultimaSessaoSchema.nullable()
});
export type LabAcompanhamentoPessoa = z.infer<typeof labAcompanhamentoPessoaSchema>;

export const labAcompanhamentoPessoasSchema = z.object({
  pessoas: z.array(labAcompanhamentoPessoaSchema),
  /** Há mais pessoas do que o teto: refine os filtros. */
  truncado: z.boolean()
});
export type LabAcompanhamentoPessoas = z.infer<typeof labAcompanhamentoPessoasSchema>;

// ---------------------------------------------------------------------------
// Uma pessoa
// ---------------------------------------------------------------------------

const decisaoDoCenarioSchema = z.object({
  id: z.string(),
  label: z.string(),
  cumpriu: z.boolean()
});

const respostaDoCenarioSchema = z.object({
  perguntaId: z.string(),
  prompt: z.string(),
  alternativa: z.int(),
  texto: z.string(),
  tempoMs: z.int().nullable()
});

const desfechoDoCenarioSchema = z.object({
  nivel: z.enum(["ok", "warn", "bad"]),
  texto: z.string()
});

export const labAcompanhamentoCenarioDaSessaoSchema = z.object({
  ordem: z.int(),
  titulo: z.string(),
  area: z.string(),
  versao: z.int(),
  exemplo: z.boolean(),
  status: z.enum(["pendente", "em_andamento", "concluida"]),
  iniciadoEm: dataIso.nullable(),
  concluidoEm: dataIso.nullable(),
  tempoTotalMs: z.int().nullable(),
  decisoes: z.array(decisaoDoCenarioSchema),
  respostas: z.array(respostaDoCenarioSchema),
  /** Os desfechos calculados no servidor (um por tema do cenário). */
  desfechos: z.array(desfechoDoCenarioSchema)
});

export const labAcompanhamentoSessaoSchema = z.object({
  sessaoId: z.string(),
  origem: z.enum(["participante", "interno"]),
  publico: z.enum(treinoPublicos).nullable(),
  status: z.enum(labStatusDoAcompanhamento),
  iniciadaEm: dataIso,
  concluidaEm: dataIso.nullable(),
  resultadoId: z.string().nullable(),
  aderenciaGeral: mediaOuNula,
  agilidade: mediaOuNula,
  experimental: z.boolean(),
  statusValidacao: z.enum(labStatusValidacao).nullable(),
  contestadoDeferido: z.boolean(),
  cenarios: z.array(labAcompanhamentoCenarioDaSessaoSchema)
});
export type LabAcompanhamentoSessao = z.infer<typeof labAcompanhamentoSessaoSchema>;

export const labAcompanhamentoContestacaoSchema = z.object({
  id: z.string(),
  resultadoId: z.string(),
  ponto: z.string(),
  motivo: z.string(),
  status: z.enum(labContestacaoStatus),
  criadoEm: dataIso,
  decididoEm: dataIso.nullable(),
  nota: z.string().nullable()
});

export const labAcompanhamentoPessoaDetalheSchema = z.object({
  pessoa: labAcompanhamentoPessoaSchema,
  /** A mais recente primeiro (a linha do tempo). */
  sessoes: z.array(labAcompanhamentoSessaoSchema),
  contestacoes: z.array(labAcompanhamentoContestacaoSchema),
  /**
   * A comparação com o grupo (as outras pessoas, de origem "participante", do mesmo público): só
   * existe se a pessoa tem teste concluído de participante e há mais alguém no grupo.
   */
  comparacao: z
    .object({
      publico: z.enum(treinoPublicos),
      pessoas: z.int().min(0),
      aderenciaDaPessoa: z.number(),
      aderenciaDoGrupo: z.number(),
      agilidadeDaPessoa: z.number(),
      agilidadeDoGrupo: z.number()
    })
    .nullable()
});
export type LabAcompanhamentoPessoaDetalhe = z.infer<typeof labAcompanhamentoPessoaDetalheSchema>;

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

export const labAcompanhamentoCenarioSchema = z.object({
  cenarioId: z.string(),
  /** Cada versão aprovada é contada à parte: o texto das alternativas pode mudar entre elas. */
  versao: z.int(),
  slug: z.string(),
  titulo: z.string(),
  area: z.string(),
  publico: z.enum(treinoPublicos).nullable(),
  vezes: z.int().min(0),
  pessoas: z.int().min(0),
  aderenciaMedia: mediaOuNula,
  /** As decisões que mais deixam de ser cumpridas (taxa de 0 a 100), da pior para a melhor. */
  decisoes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      vezes: z.int().min(0),
      descumpridas: z.int().min(0),
      taxaDeDescumprimento: z.number()
    })
  ),
  /** Para cada pergunta, quantas vezes cada alternativa foi escolhida. */
  perguntas: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      alternativas: z.array(
        z.object({ indice: z.int(), texto: z.string(), escolhas: z.int().min(0), pct: z.number() })
      )
    })
  )
});
export type LabAcompanhamentoCenario = z.infer<typeof labAcompanhamentoCenarioSchema>;

export const labAcompanhamentoCenariosSchema = z.object({
  cenarios: z.array(labAcompanhamentoCenarioSchema)
});
export type LabAcompanhamentoCenarios = z.infer<typeof labAcompanhamentoCenariosSchema>;
