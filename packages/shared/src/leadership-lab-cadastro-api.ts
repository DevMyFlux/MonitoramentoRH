// Leadership Lab — o contrato dos cadastros do RH e da configuração dos moldes.
//
// Mesma ideia de leadership-lab-api.ts: uma definição só, usada nas duas pontas. A API valida o
// que recebe com os schemas de ENTRADA (estritos: campo desconhecido é recusado) e prova, nos
// testes, que o que envia obedece aos de SAÍDA; o front valida cada resposta com os de saída e usa
// os limites das entradas nos formulários, para a tela e o servidor nunca discordarem.
//
// Nada aqui carrega resultado de teste: o cadastro mostra quem é o participante (nome, matrícula,
// cargo, operação) e a que molde o cargo pertence. A avaliação continua só nas telas de curadoria.
import { z } from "zod";
import { labMoldeNiveis } from "./leadership-lab.js";

const dataIso = z.iso.datetime();

// ---------------------------------------------------------------------------
// Limites (a tela os mostra e o servidor os impõe)
// ---------------------------------------------------------------------------

export const labNomeDaTurmaLimites = { min: 2, max: 80 } as const;

/** Mínimo de letras para buscar. Impede listar todo mundo de uma vez. */
export const labBuscaMinimaCaracteres = 2;
export const labBuscaMaximaCaracteres = 80;

/** Quantos colaboradores ou usuários uma busca devolve. */
export const labLimiteDeBusca = 20;

/**
 * Faixa aceita para o tempo por situação. O valor em si é decisão de negócio e fica em aberto: isto
 * é só uma trava contra erro de digitação (9000 em vez de 90), sem sugerir nenhum tempo.
 */
export const labTempoLimiteFaixaS = { min: 1, max: 3600 } as const;

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export const labBuscaSchema = z.strictObject({
  busca: z.string().trim().min(labBuscaMinimaCaracteres).max(labBuscaMaximaCaracteres)
});

/** POST /participantes: liga um login (perfil COMUM) a um colaborador. */
export const labCadastrarParticipanteEntradaSchema = z.strictObject({
  userId: z.uuid(),
  employeeId: z.uuid()
});
export type LabCadastrarParticipanteEntrada = z.infer<typeof labCadastrarParticipanteEntradaSchema>;

/** PATCH /participantes/:id: desativar ou reativar. Nada é apagado. */
export const labAtualizarParticipanteEntradaSchema = z.strictObject({ ativo: z.boolean() });
export type LabAtualizarParticipanteEntrada = z.infer<typeof labAtualizarParticipanteEntradaSchema>;

const nomeDaTurma = z.string().trim().min(labNomeDaTurmaLimites.min).max(labNomeDaTurmaLimites.max);

export const labCriarTurmaEntradaSchema = z.strictObject({ nome: nomeDaTurma });
export type LabCriarTurmaEntrada = z.infer<typeof labCriarTurmaEntradaSchema>;

/** PATCH /turmas/:id: renomear e/ou encerrar/reabrir. Ao menos um campo. */
export const labAtualizarTurmaEntradaSchema = z
  .strictObject({ nome: nomeDaTurma.optional(), ativa: z.boolean().optional() })
  .refine((v) => v.nome !== undefined || v.ativa !== undefined, {
    message: "Informe o nome ou a situação da turma."
  });
export type LabAtualizarTurmaEntrada = z.infer<typeof labAtualizarTurmaEntradaSchema>;

export const labIncluirNaTurmaEntradaSchema = z.strictObject({ participanteId: z.uuid() });
export type LabIncluirNaTurmaEntrada = z.infer<typeof labIncluirNaTurmaEntradaSchema>;

/**
 * PUT /config/moldes/:nivel: o estado desejado do molde, inteiro. `tempoLimiteS` nulo só vale com o
 * molde desligado (o banco também recusa ativar sem tempo); `cargoIds` é a lista COMPLETA dos cargos
 * do molde, e quem não está nela deixa o molde.
 */
export const labAtualizarMoldeEntradaSchema = z.strictObject({
  tempoLimiteS: z.int().min(labTempoLimiteFaixaS.min).max(labTempoLimiteFaixaS.max).nullable(),
  ativo: z.boolean(),
  cargoIds: z.array(z.uuid()).max(500)
});
export type LabAtualizarMoldeEntrada = z.infer<typeof labAtualizarMoldeEntradaSchema>;

// ---------------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------------

export const labMoldeDoCadastroSchema = z.object({
  nivel: z.enum(labMoldeNiveis),
  nome: z.string(),
  /** Liberado = ativo e com tempo definido: o participante consegue iniciar o teste. */
  liberado: z.boolean()
});
export type LabMoldeDoCadastro = z.infer<typeof labMoldeDoCadastroSchema>;

/** Um colaborador, para o RH escolher ou conferir quem é o participante. */
export const labColaboradorDoCadastroSchema = z.object({
  id: z.string(),
  nome: z.string(),
  identificador: z.string(),
  cargo: z.string().nullable(),
  operacao: z.string(),
  /** O molde do cargo dele; nulo se não tem cargo ou o cargo ainda não está em nenhum molde. */
  molde: labMoldeDoCadastroSchema.nullable()
});
export type LabColaboradorDoCadastro = z.infer<typeof labColaboradorDoCadastroSchema>;

export const labUsuarioElegivelSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string()
});
export type LabUsuarioElegivel = z.infer<typeof labUsuarioElegivelSchema>;

export const labParticipanteDoCadastroSchema = z.object({
  id: z.string(),
  ativo: z.boolean(),
  vinculadoEm: dataIso,
  colaborador: labColaboradorDoCadastroSchema,
  usuario: labUsuarioElegivelSchema
});
export type LabParticipanteDoCadastro = z.infer<typeof labParticipanteDoCadastroSchema>;

export const labTurmaResumoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  ativa: z.boolean(),
  criadaEm: dataIso,
  nParticipantes: z.int().min(0)
});
export type LabTurmaResumo = z.infer<typeof labTurmaResumoSchema>;

export const labTurmaDetalheSchema = labTurmaResumoSchema.extend({
  participantes: z.array(labParticipanteDoCadastroSchema)
});
export type LabTurmaDetalhe = z.infer<typeof labTurmaDetalheSchema>;

export const labMoldeConfiguradoSchema = z.object({
  id: z.string(),
  nivel: z.enum(labMoldeNiveis),
  nome: z.string(),
  temas: z.array(z.string()),
  numeroSituacoes: z.int(),
  tempoLimiteS: z.int().nullable(),
  ativo: z.boolean(),
  /** Os cargos do RH ligados a este molde. */
  cargoIds: z.array(z.string()),
  /** Testes em andamento neste molde: enquanto houver, o tempo não pode mudar. */
  testesEmAndamento: z.int().min(0)
});
export type LabMoldeConfigurado = z.infer<typeof labMoldeConfiguradoSchema>;

export const labCargoDoCadastroSchema = z.object({
  id: z.string(),
  nome: z.string(),
  /** O molde a que o cargo pertence hoje; nulo se ainda não pertence a nenhum. */
  moldeNivel: z.enum(labMoldeNiveis).nullable()
});
export type LabCargoDoCadastro = z.infer<typeof labCargoDoCadastroSchema>;

export const labConfigDosMoldesSchema = z.object({
  moldes: z.array(labMoldeConfiguradoSchema),
  cargos: z.array(labCargoDoCadastroSchema)
});
export type LabConfigDosMoldes = z.infer<typeof labConfigDosMoldesSchema>;

/** Códigos de erro novos dos cadastros, além dos de labCodigosDeErro. */
export const labCodigosDeErroDoCadastro = [
  "LAB_PARTICIPANTE_JA_CADASTRADO",
  "LAB_USUARIO_NAO_ELEGIVEL",
  "LAB_COLABORADOR_NAO_ELEGIVEL",
  "LAB_TURMA_INATIVA",
  "LAB_PARTICIPANTE_INATIVO",
  "LAB_PARTICIPANTE_JA_NA_TURMA",
  "LAB_MOLDE_COM_TESTES_EM_ANDAMENTO",
  "LAB_MOLDE_SEM_TEMPO",
  "LAB_CARGO_EM_OUTRO_MOLDE",
  "LAB_CARGO_INEXISTENTE"
] as const;
export type LabCodigoDeErroDoCadastro = (typeof labCodigosDeErroDoCadastro)[number];
