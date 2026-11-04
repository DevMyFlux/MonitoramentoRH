// Leadership Lab — o contrato da curadoria do RH e da contestação do participante.
//
// Mesma ideia de leadership-lab-api.ts e leadership-lab-cadastro-api.ts: uma definição só, usada
// nas duas pontas. A API valida o que recebe com os schemas de ENTRADA (estritos) e prova, nos
// testes, que o que envia obedece aos de SAÍDA; o front valida cada resposta e usa os limites das
// entradas nos formulários.
//
// A ficha de revisão é a ÚNICA visão que mostra ao curador a avaliação por situação (aderência,
// estilo, justificativa). Ela só existe para teste concluído e de participante de turma ativa dele.
// Durante o teste, o curador vê apenas alertas e contribuições (que nascem na hora, para ele ser
// avisado), nunca a avaliação.
import { z } from "zod";
import {
  labAlertaCores,
  labAlertaStatus,
  labContestacaoStatus,
  labContribuicaoStatus,
  labEscolhas,
  labEstilos,
  labFlexibilidades,
  labSkillTipos,
  labStatusValidacao
} from "./leadership-lab.js";

const dataIso = z.iso.datetime();
const inteiro = z.int();

// ---------------------------------------------------------------------------
// Limites (a tela os mostra e o servidor os impõe)
// ---------------------------------------------------------------------------

export const labLimitesDeTexto = {
  /** Justificativa de um ajuste de nível, nota de alerta e nota da decisão de uma contestação. */
  nota: 1000,
  /** O que o participante contesta (um ponto do resultado). */
  ponto: 200,
  /** Por que o participante contesta. */
  motivo: 1000
} as const;

/** Trava das listas do curador. O piloto tem de 8 a 12 líderes; isto só impede resposta enorme. */
export const labLimiteDasListasDoCurador = 200;

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export const labFiltroDaRevisaoSchema = z.strictObject({
  status: z.enum([...labStatusValidacao, "todos"]).default("aguardando_validacao")
});
export const labFiltroDeAlertasSchema = z.strictObject({
  status: z.enum([...labAlertaStatus, "todos"]).default("aberto")
});
export const labFiltroDeContribuicoesSchema = z.strictObject({
  status: z.enum([...labContribuicaoStatus, "todas"]).default("pendente")
});
export const labFiltroDeContestacoesSchema = z.strictObject({
  status: z.enum([...labContestacaoStatus, "todas"]).default("pendente")
});

const texto = (max: number) => z.string().trim().min(1).max(max);

/**
 * POST /resultados/:id/validacao. Sem `ajustes`, valida o resultado como está. Com ajustes, valida
 * com o nível dessas skills trocado e a justificativa é obrigatória (o servidor confere e responde
 * LAB_JUSTIFICATIVA_OBRIGATORIA). `ajustes` pode ser omitido.
 */
export const labValidarResultadoEntradaSchema = z.strictObject({
  ajustes: z
    .array(z.strictObject({ skillId: z.string().min(1).max(60), nivel: z.int().min(1).max(5) }))
    .max(20)
    .default([]),
  justificativa: texto(labLimitesDeTexto.nota).optional()
});
export type LabValidarResultadoEntrada = z.input<typeof labValidarResultadoEntradaSchema>;

/** POST /alertas/:id/tratamento: encerrar exige a nota da conversa de desenvolvimento. */
export const labTratarAlertaEntradaSchema = z.strictObject({ nota: texto(labLimitesDeTexto.nota) });
export type LabTratarAlertaEntrada = z.infer<typeof labTratarAlertaEntradaSchema>;

export const labDecidirContribuicaoEntradaSchema = z.strictObject({
  decisao: z.enum(["aprovada", "rejeitada"])
});
export type LabDecidirContribuicaoEntrada = z.infer<typeof labDecidirContribuicaoEntradaSchema>;

/** A nota da decisão é obrigatória: é o que explica ao participante o que foi decidido. */
export const labDecidirContestacaoEntradaSchema = z.strictObject({
  decisao: z.enum(["aceita", "rejeitada"]),
  nota: texto(labLimitesDeTexto.nota)
});
export type LabDecidirContestacaoEntrada = z.infer<typeof labDecidirContestacaoEntradaSchema>;

/** POST /resultados/:id/contestacoes (participante, só do próprio resultado). */
export const labCriarContestacaoEntradaSchema = z.strictObject({
  ponto: texto(labLimitesDeTexto.ponto),
  motivo: texto(labLimitesDeTexto.motivo)
});
export type LabCriarContestacaoEntrada = z.infer<typeof labCriarContestacaoEntradaSchema>;

// ---------------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------------

/** Quem é o participante, no que o curador precisa para reconhecê-lo. */
export const labParticipanteResumidoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  identificador: z.string(),
  cargo: z.string().nullable(),
  operacao: z.string()
});
export type LabParticipanteResumido = z.infer<typeof labParticipanteResumidoSchema>;

export const labPendenciasSchema = z.object({
  resultadosAguardando: z.int().min(0),
  alertasAbertos: z.int().min(0),
  contestacoesPendentes: z.int().min(0),
  contribuicoesPendentes: z.int().min(0)
});
export type LabPendencias = z.infer<typeof labPendenciasSchema>;

export const labItemDaRevisaoSchema = z.object({
  resultadoId: z.string(),
  sessaoId: z.string(),
  concluidaEm: dataIso,
  statusValidacao: z.enum(labStatusValidacao),
  participante: labParticipanteResumidoSchema,
  moldeNome: z.string(),
  aderenciaGeral: z.number(),
  agilidade: z.number(),
  alertasAbertos: z.int().min(0),
  contestacoesPendentes: z.int().min(0)
});
export type LabItemDaRevisao = z.infer<typeof labItemDaRevisaoSchema>;

export const labAlertaDoCuradorSchema = z.object({
  id: z.string(),
  cor: z.enum(labAlertaCores),
  status: z.enum(labAlertaStatus),
  criadoEm: dataIso,
  /** O alerta amarelo é de uma skill; o vermelho, de uma situação. */
  skillNome: z.string().nullable(),
  situacao: inteiro.nullable(),
  participante: labParticipanteResumidoSchema,
  sessaoId: z.string(),
  /** Só existe com o teste concluído: é o que abre a ficha de revisão. */
  resultadoId: z.string().nullable(),
  testeConcluido: z.boolean(),
  tratadoEm: dataIso.nullable(),
  tratadoPor: z.string().nullable(),
  nota: z.string().nullable()
});
export type LabAlertaDoCurador = z.infer<typeof labAlertaDoCuradorSchema>;

export const labContribuicaoDoCuradorSchema = z.object({
  id: z.string(),
  texto: z.string(),
  status: z.enum(labContribuicaoStatus),
  criadoEm: dataIso,
  situacao: inteiro,
  participante: labParticipanteResumidoSchema,
  sessaoId: z.string(),
  resultadoId: z.string().nullable(),
  testeConcluido: z.boolean(),
  decididoEm: dataIso.nullable(),
  decididoPor: z.string().nullable()
});
export type LabContribuicaoDoCurador = z.infer<typeof labContribuicaoDoCuradorSchema>;

export const labContestacaoDoCuradorSchema = z.object({
  id: z.string(),
  ponto: z.string(),
  motivo: z.string(),
  status: z.enum(labContestacaoStatus),
  criadoEm: dataIso,
  participante: labParticipanteResumidoSchema,
  resultadoId: z.string(),
  sessaoId: z.string(),
  /** Estado do resultado contestado: decidir não o altera sozinho (veja a documentação). */
  statusValidacao: z.enum(labStatusValidacao),
  decididoEm: dataIso.nullable(),
  decididoPor: z.string().nullable(),
  nota: z.string().nullable()
});
export type LabContestacaoDoCurador = z.infer<typeof labContestacaoDoCuradorSchema>;

/** O que o participante vê da própria contestação: nunca quem a decidiu. */
export const labContestacaoPropriaSchema = z.object({
  id: z.string(),
  ponto: z.string(),
  motivo: z.string(),
  status: z.enum(labContestacaoStatus),
  criadoEm: dataIso,
  decididoEm: dataIso.nullable(),
  nota: z.string().nullable()
});
export type LabContestacaoPropria = z.infer<typeof labContestacaoPropriaSchema>;

export const labSkillDaFichaSchema = z.object({
  skillId: z.string(),
  nome: z.string(),
  tipo: z.enum(labSkillTipos).nullable(),
  nivelCalculado: z.int().min(1).max(5),
  media: z.number(),
  nEvidencias: z.int().min(1),
  /** O nível que o curador definiu ao validar; nulo enquanto o resultado aguarda validação. */
  nivelValidado: z.int().min(1).max(5).nullable()
});
export type LabSkillDaFicha = z.infer<typeof labSkillDaFichaSchema>;

export const labSituacaoDaFichaSchema = z.object({
  numero: inteiro,
  marco: z.boolean(),
  texto: z.string(),
  opcoes: z.array(z.object({ id: z.enum(labEscolhas), texto: z.string() })),
  escolha: z.enum(labEscolhas).nullable(),
  tempoEsgotado: z.boolean(),
  aderencia: z.number(),
  estilo: z.enum(labEstilos).nullable(),
  alertaVermelho: z.boolean(),
  tempoRespostaMs: inteiro.nullable(),
  justificativa: z.string().nullable(),
  consequencia: z.string().nullable()
});
export type LabSituacaoDaFicha = z.infer<typeof labSituacaoDaFichaSchema>;

export const labFichaDeRevisaoSchema = z.object({
  resultadoId: z.string(),
  sessaoId: z.string(),
  concluidaEm: dataIso,
  statusValidacao: z.enum(labStatusValidacao),
  participante: labParticipanteResumidoSchema,
  moldeNome: z.string(),
  aderenciaGeral: z.number(),
  agilidade: z.number(),
  estiloPredominante: z.enum(labEstilos).nullable(),
  flexibilidade: z.enum(labFlexibilidades).nullable(),
  flexibilidadePct: z.number().nullable(),
  resumo: z.string(),
  pontoForte: z.string().nullable(),
  pontoDesenvolvimento: z.string().nullable(),
  sugestoes: z.array(z.string()),
  skills: z.array(labSkillDaFichaSchema),
  situacoes: z.array(labSituacaoDaFichaSchema),
  validacao: z.object({
    validadoPor: z.string().nullable(),
    validadoEm: dataIso.nullable(),
    justificativa: z.string().nullable()
  }),
  alertas: z.array(labAlertaDoCuradorSchema),
  contribuicoes: z.array(labContribuicaoDoCuradorSchema),
  contestacoes: z.array(labContestacaoDoCuradorSchema)
});
export type LabFichaDeRevisao = z.infer<typeof labFichaDeRevisaoSchema>;

/** Códigos de erro novos da curadoria, além dos de labCodigosDeErro e do cadastro. */
export const labCodigosDeErroDaCuradoria = [
  "LAB_RESULTADO_JA_VALIDADO",
  "LAB_JUSTIFICATIVA_OBRIGATORIA",
  "LAB_AJUSTE_INVALIDO",
  "LAB_ALERTA_JA_TRATADO",
  "LAB_JA_DECIDIDO"
] as const;
export type LabCodigoDeErroDaCuradoria = (typeof labCodigosDeErroDaCuradoria)[number];
