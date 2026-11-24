// Treinamentos Interativos — o contrato das requisições HTTP (/api/v1/treinamentos). Uma definição
// só: a API valida cada corpo com estes schemas e a tela monta os corpos com os mesmos tipos.
import { z } from "zod";
import { TREINO_ALTERNATIVAS } from "./treinamento-schema.js";

const id = z.uuid();

export const treinoRespostaBodySchema = z.strictObject({
  perguntaId: z.string().min(1).max(48),
  alternativa: z
    .int()
    .min(0)
    .max(TREINO_ALTERNATIVAS - 1)
});

/** "E se?": as 5 decisões, cumpridas ou não, por id. */
export const treinoSimularBodySchema = z.strictObject({
  decisoes: z.record(z.string().min(1).max(48), z.boolean())
});

export const treinoValidarTentativaBodySchema = z.strictObject({
  nota: z.string().trim().max(2000).optional()
});

/** Conteúdo de cenário vindo da autoria: o formato é conferido por validarCenario(). */
export const treinoConteudoBodySchema = z.strictObject({ conteudo: z.unknown() });

export const treinoAprovarBodySchema = z.strictObject({ versaoId: id });

export const treinoAtribuirBodySchema = z.strictObject({
  versaoId: id,
  turmaId: id,
  prazo: z.iso.datetime().nullable().optional()
});

export const treinoFiltrosDoRhSchema = z.object({
  situacao: z.enum(["pendentes", "validadas", "todas"]).default("todas"),
  atribuicaoId: id.optional()
});

export type TreinoRespostaBody = z.infer<typeof treinoRespostaBodySchema>;
export type TreinoSimularBody = z.infer<typeof treinoSimularBodySchema>;
export type TreinoAtribuirBody = z.infer<typeof treinoAtribuirBodySchema>;
export type TreinoFiltrosDoRh = z.infer<typeof treinoFiltrosDoRhSchema>;
