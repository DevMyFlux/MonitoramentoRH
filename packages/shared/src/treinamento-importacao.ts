// Treinamentos Interativos — a importação de cenários escritos no formato do pacote de autoria do
// Leadership Lab (os 40 cenários em docs/cenarios-lab/).
//
// Esse formato é quase o do projeto (treinamento-schema.ts), mas escrito à parte, e difere em pontos
// pequenos e mecânicos. Em vez de duplicar o schema, este adaptador (PURO, sem banco) converte um
// cenário do formato do pacote para o do projeto e o resultado passa pelo MESMO validador de autoria
// (validarCenario): uma só regra de validação, no servidor e na tela.
//
//  pacote                      -> projeto
//  id                          -> slug
//  (não existe)                -> summary  (derivado: a primeira legenda da introdução)
//  (não existe)                -> intro.title (= title)
//  locale, status              -> descartados (a situação do cenário é do banco, nasce "rascunho")
//  publico                     -> publico  (opcional, mantido)
//  (não existe)                -> exemplo: true (texto de EXEMPLO até a área responsável aprovar)
//
// O que já é igual (decisões, perguntas, alternativas, acontecimentos, resultados) passa intacto. Um
// cenário que já está no formato do projeto (tem `slug`) também é aceito e não é alterado.
import {
  validarCenario,
  type TreinoCenario,
  type TreinoProblemaDeAutoria
} from "./treinamento-schema.js";

type Objeto = Record<string, unknown>;

const ehObjeto = (valor: unknown): valor is Objeto =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** A primeira frase de um texto, até `max` caracteres (para o resumo derivado). */
function primeiraFrase(texto: string, max: number): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  const fim = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("? "), corte.lastIndexOf("! "));
  return fim > 40 ? corte.slice(0, fim + 1) : `${corte.slice(0, max - 1).trimEnd()}…`;
}

/** O cenário no formato do pacote vira o do projeto. Entrada que não é objeto passa como está (o validador recusa). */
export function adaptarCenarioDoPacote(bruto: unknown): unknown {
  if (!ehObjeto(bruto)) return bruto;
  // Já no formato do projeto: nada a adaptar.
  if ("slug" in bruto) return bruto;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, locale, status, ...resto } = bruto;
  const intro = ehObjeto(resto.intro) ? resto.intro : {};
  const legendas = Array.isArray(intro.captions) ? intro.captions : [];
  const titulo = typeof resto.title === "string" ? resto.title : "";
  return {
    ...resto,
    slug: id,
    summary: typeof legendas[0] === "string" ? primeiraFrase(legendas[0], 240) : titulo,
    exemplo: true,
    intro: { title: titulo, ...intro }
  };
}

export type ResultadoDaImportacao =
  { ok: true; cenario: TreinoCenario } | { ok: false; problemas: TreinoProblemaDeAutoria[] };

/** Adapta (se vier no formato do pacote) e valida: o que o servidor e a tela de autoria chamam. */
export function validarCenarioImportado(bruto: unknown): ResultadoDaImportacao {
  return validarCenario(adaptarCenarioDoPacote(bruto));
}

/**
 * O vocabulário do pacote de cena "escritorio-gestao" (os 40 cenários do Lab o usam). Fica aqui, e
 * não só na tela, para o teste de importação conferir que nenhum cenário usa um plano ou um comando
 * que o pacote não desenha. O desenho mora em apps/web/.../palco/mundos.tsx.
 */
export const ESCRITORIO_GESTAO = {
  id: "escritorio-gestao",
  /** Planos de câmera (shot) e, com o mesmo nome, o objeto da cena que cada um comanda. */
  planos: ["mesa", "tela", "reuniao", "documento", "relogio"],
  /** O que cada comando pode valer: realce esmeralda, pulso âmbar, vibração vermelha. */
  comandos: ["ok", "alerta", "falha"]
} as const;
