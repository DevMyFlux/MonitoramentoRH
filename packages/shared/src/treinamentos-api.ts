// Treinamentos Interativos — o contrato das requisições HTTP (/api/v1/treinamentos). Uma definição
// só: a API valida cada corpo com estes schemas e a tela monta os corpos com os mesmos tipos.
import { z } from "zod";
import { niveisDeGovernanca } from "./conta.js";
import { TREINO_ALTERNATIVAS, treinoPublicos } from "./treinamento-schema.js";

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

/** Quantos cenários cabem numa importação em lote (os 40 do Lab cabem com folga). */
export const TREINO_IMPORTACAO_MAXIMA = 100;

/** Importação em lote: cada item é um cenário bruto (formato do projeto ou do pacote do Lab). */
export const treinoImportarBodySchema = z.strictObject({
  cenarios: z.array(z.unknown()).min(1).max(TREINO_IMPORTACAO_MAXIMA)
});

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

// ---------------------------------------------------------------------------
// Configuração do teste do Lab (ADMIN e DEV editam; RH lê)
// ---------------------------------------------------------------------------

/** Uma regra de público: nível + área -> público. Nulo = qualquer; ao menos um dos dois é exigido. */
export const treinoRegraDePublicoSchema = z
  .strictObject({
    nivelGovernanca: z.enum(niveisDeGovernanca).nullable(),
    areaId: z.uuid().nullable(),
    publico: z.enum(treinoPublicos),
    ativa: z.boolean()
  })
  .refine((r) => r.nivelGovernanca !== null || r.areaId !== null, {
    message: "Informe o nível, a área, ou os dois.",
    path: ["nivelGovernanca"]
  });

/** A tabela inteira de regras: salvar substitui a anterior. */
export const treinoRegrasDePublicoBodySchema = z.strictObject({
  regras: z.array(treinoRegraDePublicoSchema).max(60)
});

/** Quantos cenários compõem o teste de um público (e, opcionalmente, de uma turma). */
export const treinoTesteConfigItemSchema = z.strictObject({
  publico: z.enum(treinoPublicos),
  turmaId: z.uuid().nullable(),
  quantidade: z.int().min(1).max(10)
});

export const treinoTesteConfigBodySchema = z
  .strictObject({ itens: z.array(treinoTesteConfigItemSchema).max(100) })
  .superRefine((corpo, ctx) => {
    const vistos = new Set<string>();
    corpo.itens.forEach((item, i) => {
      const chave = `${item.publico}|${item.turmaId ?? ""}`;
      if (vistos.has(chave))
        ctx.addIssue({
          code: "custom",
          path: ["itens", i],
          message: "Já há uma quantidade para este público (e turma)."
        });
      vistos.add(chave);
    });
  });

/** Aprovar várias versões de uma vez (depois da revisão de conteúdo). */
export const treinoAprovarEmLoteBodySchema = z.strictObject({
  itens: z
    .array(z.strictObject({ cenarioId: z.uuid(), versaoId: z.uuid() }))
    .min(1)
    .max(100)
});
