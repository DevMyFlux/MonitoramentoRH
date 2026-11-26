// Leadership Lab — o teste por cenários (a trilha de Treinamentos dentro do Lab).
//
// O teste do Lab deixa de ter perguntas soltas: ele é uma TRILHA de N cenários de treinamento
// (cada um com 5 decisões, no Palco), escolhidos pelo PÚBLICO da pessoa. Aqui moram as regras puras
// (sem banco): o modo do teste, a origem do resultado, o público de cada pessoa e o molde do nível.
// O servidor as usa para montar a trilha; a tela só mostra o que ele devolve.
import { z } from "zod";
import type { NivelDeGovernanca } from "./conta.js";
import { type TreinoPublico, treinoPublicos } from "./treinamento-schema.js";

/**
 * O modo do teste. "cenarios" (padrão): a trilha de cenários. "legado": as situações A/B/C
 * conduzidas pela IA, que continuam no código só para reverter (LAB_TESTE_MODO=legado).
 */
export const labModosDeTeste = ["cenarios", "legado"] as const;
export type LabModoDeTeste = (typeof labModosDeTeste)[number];

/** Quantos cenários compõem um teste, se a configuração não disser outra coisa. */
export const LAB_CENARIOS_POR_TESTE_PADRAO = 3;
export const LAB_CENARIOS_POR_TESTE_MAXIMO = 10;

/**
 * A origem de um resultado: "participante" (feito por quem é COMUM) ou "interno" (DEV, ADMIN e RH, para
 * validar e demonstrar). Resultado interno NUNCA entra em métrica, comparação ou ranking de
 * participantes: o filtro é do servidor, na consulta.
 */
export const labOrigens = ["participante", "interno"] as const;
export type LabOrigem = (typeof labOrigens)[number];

export function origemDoPerfil(perfil: string): LabOrigem {
  return perfil === "COMUM" ? "participante" : "interno";
}

/** O público de uma pessoa e de onde veio a decisão (a tabela da regra ou o nível, quando a combinação não está nela). */
export type PublicoDaPessoa = { publico: TreinoPublico; regra: "tabela" | "nivel" };

/**
 * Nível de governança + área -> público do treinamento (seção "Criação de contas" do prompt):
 *
 *   supervisor   | Manutenção ou Administrativo   -> supervisor-manutencao-adm
 *   coordenador  | Administrativo                 -> coordenador-administrativo
 *   qualquer     | RH                             -> rh
 *   assistente   | Administrativo e demais        -> administrativo-geral
 *
 * Combinação fora da tabela (por exemplo, coordenador de Compras) cai pelo NÍVEL: supervisor ->
 * supervisor-manutencao-adm; coordenador e diretoria -> coordenador-administrativo; assistente ->
 * administrativo-geral. Quem faz a regra editável é a configuração (Fase 7); este é o padrão.
 */
export function publicoDoCadastro(cadastro: {
  nivelGovernanca: NivelDeGovernanca;
  /** O slug da área (rh, administrativo, compras, manutencao, financeiro...). */
  areaSlug: string;
}): PublicoDaPessoa {
  const { nivelGovernanca: nivel, areaSlug: area } = cadastro;
  if (area === "rh") return { publico: "rh", regra: "tabela" };
  if (nivel === "supervisor" && (area === "manutencao" || area === "administrativo"))
    return { publico: "supervisor-manutencao-adm", regra: "tabela" };
  if (nivel === "coordenador" && area === "administrativo")
    return { publico: "coordenador-administrativo", regra: "tabela" };
  if (nivel === "assistente") return { publico: "administrativo-geral", regra: "tabela" };
  // Fora da tabela: pelo nível (o assistente já saiu acima, em qualquer área).
  return {
    publico: nivel === "supervisor" ? "supervisor-manutencao-adm" : "coordenador-administrativo",
    regra: "nivel"
  };
}

/** O molde do Lab (encarregado, supervisor, coordenador) que corresponde ao nível de governança. */
export function moldeDoNivel(
  nivel: NivelDeGovernanca
): "encarregado" | "supervisor" | "coordenador" {
  return nivel === "assistente"
    ? "encarregado"
    : nivel === "supervisor"
      ? "supervisor"
      : "coordenador";
}

/** Uma regra configurada: nível + área -> público (nulo = qualquer). */
export type RegraDePublico = {
  nivelGovernanca: NivelDeGovernanca | null;
  areaId: string | null;
  publico: TreinoPublico;
  ativa: boolean;
};

export type PublicoPelasRegras = {
  publico: TreinoPublico;
  /** "regra": uma regra configurada serviu; "padrao": nenhuma serviu e valeu o padrão do código. */
  origem: "regra" | "padrao";
};

/**
 * O público de uma conta pelas regras CONFIGURADAS (a tabela editável da configuração). Vale a regra
 * ativa mais específica: nível e área juntos (3), só a área (2), só o nível (1); em empate, a primeira da
 * lista. Se nenhuma serve (tabela vazia, por exemplo), vale o padrão do código (publicoDoCadastro).
 */
export function publicoPelasRegras(
  regras: readonly RegraDePublico[],
  conta: { nivelGovernanca: NivelDeGovernanca; areaId: string; areaSlug: string }
): PublicoPelasRegras {
  let melhor: { regra: RegraDePublico; pontos: number } | null = null;
  for (const regra of regras) {
    if (!regra.ativa) continue;
    if (regra.nivelGovernanca !== null && regra.nivelGovernanca !== conta.nivelGovernanca) continue;
    if (regra.areaId !== null && regra.areaId !== conta.areaId) continue;
    const pontos = (regra.areaId !== null ? 2 : 0) + (regra.nivelGovernanca !== null ? 1 : 0);
    if (pontos === 0) continue;
    if (melhor === null || pontos > melhor.pontos) melhor = { regra, pontos };
  }
  if (melhor) return { publico: melhor.regra.publico, origem: "regra" };
  return {
    publico: publicoDoCadastro({ nivelGovernanca: conta.nivelGovernanca, areaSlug: conta.areaSlug })
      .publico,
    origem: "padrao"
  };
}

/**
 * O molde do Lab que a sessão de cenários usa (a sessão exige um molde; o conteúdo vem dos cenários, não
 * dele): o público de supervisores usa o de supervisor, o de coordenadores usa o de coordenador, o
 * administrativo geral usa o de encarregado e o RH usa o de supervisor.
 */
export function moldeDoPublico(
  publico: TreinoPublico
): "encarregado" | "supervisor" | "coordenador" {
  switch (publico) {
    case "coordenador-administrativo":
      return "coordenador";
    case "administrativo-geral":
      return "encarregado";
    case "supervisor-manutencao-adm":
    case "rh":
      return "supervisor";
  }
}

// ---------------------------------------------------------------------------
// Corpos das requisições
// ---------------------------------------------------------------------------

/** Iniciar o teste. `publico` só vale para DEV, ADMIN e RH (que podem testar qualquer público). */
export const labTesteIniciarEntradaSchema = z.strictObject({
  publico: z.enum(treinoPublicos).optional()
});
export type LabTesteIniciarEntrada = z.infer<typeof labTesteIniciarEntradaSchema>;

export const labTesteRespostaEntradaSchema = z.strictObject({
  perguntaId: z.string().min(1).max(60),
  alternativa: z.int().min(0).max(3)
});
export type LabTesteRespostaEntrada = z.infer<typeof labTesteRespostaEntradaSchema>;

/**
 * Referência de tempo por pergunta para a "agilidade" do teste por cenários. Os cenários não têm
 * relógio; a agilidade compara o tempo real de cada resposta com esta referência (em segundos).
 * Responder em tempo zero vale 100; na referência ou depois, 0.
 */
export const LAB_TEMPO_DE_REFERENCIA_S = 60;

/** Agilidade (0 a 100) de uma lista de tempos de resposta, em milissegundos. Sem respostas: 0. */
export function agilidadeDosCenarios(
  temposMs: readonly number[],
  referenciaS = LAB_TEMPO_DE_REFERENCIA_S
): number {
  if (temposMs.length === 0) return 0;
  const limite = referenciaS * 1000;
  const medias = temposMs.map((t) => Math.max(0, 1 - Math.max(0, t) / limite));
  const total = medias.reduce((soma, valor) => soma + valor, 0) / medias.length;
  return Math.round(total * 10000) / 100;
}

/** Aderência (0 a 100) do teste: a % de decisões cumpridas em todos os cenários. */
export function aderenciaDosCenarios(decisoesCumpridas: number, decisoesTotais: number): number {
  if (decisoesTotais <= 0) return 0;
  return Math.round((decisoesCumpridas / decisoesTotais) * 10000) / 100;
}
