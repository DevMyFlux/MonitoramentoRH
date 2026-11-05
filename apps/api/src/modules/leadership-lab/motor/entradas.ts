// Leadership Lab — o que o participante pode enviar ao motor. Estrito: campo desconhecido é
// recusado (a aderência, por exemplo, nunca é aceita de fora).
import { labEscolhas, labLimiteCaracteresCampoLivre, labTemaIdSchema } from "@my-flux/shared";
import { z } from "zod";

/** Teto do campo livre. Definido em packages/shared, para a tela mostrar o mesmo limite. */
export const LIMITE_CARACTERES_CAMPO_LIVRE = labLimiteCaracteresCampoLivre;

const numeroDaSituacao = z.int().min(1).max(10);

export const iniciarEntradaSchema = z.strictObject({
  /** O molde que o participante confirma. Deve ser o do cargo dele; vazio = o do cargo. */
  moldeId: z.uuid().optional(),
  /**
   * O tema da simulação local, escolhido pelo participante. Só vale no modo demonstração; fora
   * dele, ou com um tema que a biblioteca não tem, o início é recusado (LAB_TEMA_INVALIDO).
   */
  categoriaId: labTemaIdSchema.optional()
});
export type IniciarEntrada = z.infer<typeof iniciarEntradaSchema>;

export const responderEntradaSchema = z.strictObject({
  numero: numeroDaSituacao,
  escolha: z.enum(labEscolhas),
  /** Opcional e sem cronômetro. Em branco não é texto: omita ou envie null. */
  textoLivre: z.string().trim().min(1).max(LIMITE_CARACTERES_CAMPO_LIVRE).nullish()
});
export type ResponderEntrada = z.infer<typeof responderEntradaSchema>;

export const tempoEsgotadoEntradaSchema = z.strictObject({ numero: numeroDaSituacao });
export type TempoEsgotadoEntrada = z.infer<typeof tempoEsgotadoEntradaSchema>;
