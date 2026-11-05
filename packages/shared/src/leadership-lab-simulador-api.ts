// Leadership Lab — o contrato do simulador local (modo demonstração).
//
// O simulador é uma biblioteca de situações hospitalares com caminhos ramificados, que roda toda
// no servidor, sem IA e sem nenhum serviço externo. Este arquivo tem só o que atravessa a rede:
// a lista de temas, a classificação do texto livre e a entrada do início do teste. NADA aqui
// carrega avaliação: aderência, estilo, skills e justificativa ficam no servidor.
//
// O texto que o participante digita para descrever o problema só serve para escolher um tema. Ele
// não é gravado, não é registrado em log e não é enviado a nenhum serviço.
import { z } from "zod";

/** Teto da descrição livre do problema. */
export const labLimiteDescricaoDoProblema = 500;

/** Identificador estável de um tema (slug). */
export const labTemaIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "tema inválido")
  .min(3)
  .max(60);

/**
 * Quem aparece em cada cena. É só o que a tela precisa para escolher a ilustração: nunca um nome
 * de pessoa real.
 */
export const labPersonagens = [
  "tecnico",
  "supervisor",
  "responsavel-assistencial",
  "coordenador-contrato",
  "engenharia-clinica",
  "enfermagem",
  "fornecedor",
  "diretoria",
  "seguranca-trabalho",
  "controle-infeccao"
] as const;
export type LabPersonagem = (typeof labPersonagens)[number];

/**
 * A cena de uma situação da simulação local: só o que a tela precisa para escolher a ilustração e
 * mostrar o título. Nada de avaliação. Nula fora da simulação local.
 */
export const labCenaSchema = z.object({
  personagem: z.enum(labPersonagens),
  temaNome: z.string(),
  titulo: z.string()
});
export type LabCena = z.infer<typeof labCenaSchema>;

/** Do resultado: de que simulação o teste foi. Nula fora da simulação local. */
export const labSimulacaoSchema = z.object({ temaNome: z.string(), titulo: z.string() });
export type LabSimulacao = z.infer<typeof labSimulacaoSchema>;

export const labTemaSimuladoSchema = z.object({
  id: labTemaIdSchema,
  nome: z.string(),
  descricao: z.string(),
  /** Frases de exemplo, para o participante reconhecer o tema. */
  exemplos: z.array(z.string())
});
export type LabTemaSimulado = z.infer<typeof labTemaSimuladoSchema>;

/** GET /simulador/temas */
export const labTemasSimuladosSchema = z.object({ temas: z.array(labTemaSimuladoSchema) });
export type LabTemasSimulados = z.infer<typeof labTemasSimuladosSchema>;

/** POST /simulador/classificar */
export const labClassificarEntradaSchema = z.strictObject({
  descricao: z.string().trim().min(3).max(labLimiteDescricaoDoProblema)
});
export type LabClassificarEntrada = z.infer<typeof labClassificarEntradaSchema>;

/**
 * - encontrado: um tema se destacou. A tela o propõe e o participante confirma.
 * - ambiguo: mais de um tema serve. A tela mostra só as `sugestoes`.
 * - sem-correspondencia: nada reconhecido. A tela mostra todos os temas para escolha manual.
 * Nunca se inventa uma situação fora da biblioteca.
 */
export const labClassificacaoSchema = z.discriminatedUnion("resultado", [
  z.object({ resultado: z.literal("encontrado"), tema: labTemaSimuladoSchema }),
  z.object({ resultado: z.literal("ambiguo"), sugestoes: z.array(labTemaSimuladoSchema).min(2) }),
  z.object({
    resultado: z.literal("sem-correspondencia"),
    sugestoes: z.array(labTemaSimuladoSchema)
  })
]);
export type LabClassificacao = z.infer<typeof labClassificacaoSchema>;

export const labCodigosDeErroDoSimulador = ["LAB_TEMA_INVALIDO"] as const;
export type LabCodigoDeErroDoSimulador = (typeof labCodigosDeErroDoSimulador)[number];
