// Leadership Lab — notificações do curador (GET /notificacoes e POST /notificacoes/leitura).
//
// As notificações são DERIVADAS do que espera decisão (resultados aguardando validação, alertas
// abertos, contestações e contribuições pendentes) e só dos participantes das turmas do curador. Cada
// item tem uma chave estável ("alerta:<id>"): é ela que guarda a leitura, e é ela que impede o mesmo
// fato de aparecer duas vezes. Tratar o item na sua tela (validar, encerrar, decidir) o tira da lista.
import { z } from "zod";

export const labTiposDeNotificacao = ["resultado", "alerta", "contestacao", "contribuicao"] as const;
export type LabTipoDeNotificacao = (typeof labTiposDeNotificacao)[number];

/** Quantos itens a lista traz, no máximo (os mais recentes). */
export const labLimiteDeNotificacoes = 30;
/** Quantas chaves uma marcação de leitura aceita de uma vez. */
export const labLimiteDeLeitura = 100;

export const labChaveDeNotificacaoSchema = z
  .string()
  .regex(/^(resultado|alerta|contestacao|contribuicao):[0-9a-f-]{36}$/);

export const labNotificacaoSchema = z.object({
  chave: labChaveDeNotificacaoSchema,
  tipo: z.enum(labTiposDeNotificacao),
  /** "urgente" = alerta vermelho; o resto é "normal". */
  prioridade: z.enum(["normal", "urgente"]),
  titulo: z.string(),
  descricao: z.string(),
  /** De quem vem (o participante) e de onde (a operação dele). */
  origem: z.object({ participante: z.string(), operacao: z.string() }),
  criadoEm: z.iso.datetime(),
  lida: z.boolean(),
  /** A tela onde o item é tratado. */
  destino: z.string()
});
export type LabNotificacao = z.infer<typeof labNotificacaoSchema>;

export const labNotificacoesSchema = z.object({
  itens: z.array(labNotificacaoSchema),
  naoLidas: z.int().min(0),
  /** Quantos itens pendentes existem no total (a lista traz só os mais recentes). */
  totalPendente: z.int().min(0)
});
export type LabNotificacoes = z.infer<typeof labNotificacoesSchema>;

export const labMarcarLeituraEntradaSchema = z.union([
  z.strictObject({ chaves: z.array(labChaveDeNotificacaoSchema).min(1).max(labLimiteDeLeitura) }),
  z.strictObject({ todas: z.literal(true) })
]);
export type LabMarcarLeituraEntrada = z.input<typeof labMarcarLeituraEntradaSchema>;
