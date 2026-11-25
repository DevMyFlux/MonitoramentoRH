// Assistente de suporte do MY FLUX (POST /api/v1/suporte/conversa).
//
// Um agente de ajuda disponível em todas as telas, para qualquer perfil: explica como usar cada
// módulo (Colaboradores, Escalas, Leadership Lab, Usuários...) e o que o perfil da pessoa pode fazer.
// Não lê nem altera dados do sistema: só orienta. A tela manda a mensagem, o histórico recente da
// conversa e ONDE a pessoa está (o caminho e o nome da tela); o servidor acrescenta o perfil.
import { z } from "zod";

export const suporteLimites = {
  /** Caracteres de uma mensagem da pessoa. */
  mensagem: 600,
  /** Caracteres de uma mensagem do histórico (a resposta do assistente é maior). */
  textoDoHistorico: 1500,
  /** Quantas mensagens do histórico recente vão junto (as mais novas). */
  historico: 6,
  /** Caracteres do caminho e do título da tela. */
  pagina: 120
} as const;

export const suportePapeis = ["usuario", "assistente"] as const;
export type SuportePapel = (typeof suportePapeis)[number];

export const suporteMensagemSchema = z.strictObject({
  papel: z.enum(suportePapeis),
  texto: z.string().trim().min(1).max(suporteLimites.textoDoHistorico)
});
export type SuporteMensagem = z.infer<typeof suporteMensagemSchema>;

export const suporteEntradaSchema = z.strictObject({
  mensagem: z.string().trim().min(1).max(suporteLimites.mensagem),
  historico: z.array(suporteMensagemSchema).max(suporteLimites.historico).default([]),
  pagina: z.strictObject({
    caminho: z.string().trim().min(1).max(suporteLimites.pagina),
    titulo: z.string().trim().min(1).max(suporteLimites.pagina)
  })
});
export type SuporteEntrada = z.input<typeof suporteEntradaSchema>;

export const suporteRespostaSchema = z.strictObject({
  /** "bloqueada": a mensagem tinha dado sensível e não foi enviada à IA. */
  /**
   * "respondida"; "bloqueada" (a mensagem tinha dado sensível e não foi enviada à IA); "restrita" (a
   * pergunta pede dados de pessoas e o perfil da conta não pode vê-los); "fora_do_escopo" (conta COMUM
   * perguntou de algo que não é o Leadership Lab nem o resultado dela: recusa curta, sem consultar nada).
   */
  desfecho: z.enum(["respondida", "bloqueada", "restrita", "fora_do_escopo"]),
  resposta: z.string()
});
export type SuporteResposta = z.infer<typeof suporteRespostaSchema>;
