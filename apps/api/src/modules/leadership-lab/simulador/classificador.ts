// Leadership Lab — o classificador do texto livre ("Qual problema você está enfrentando?").
//
// Determinístico e local: normaliza o texto (minúsculas, sem acento, só letras e números) e soma
// pontos por palavra-chave encontrada (forte = 3, fraca = 1). Não chama nada, não guarda nada e não
// registra o texto: ele só serve para propor um tema. Quando não há correspondência confiável,
// devolve os temas para escolha manual; nunca inventa uma situação fora da biblioteca.
//
// Palavra de uma só palavra com 6 letras ou mais casa também como início de palavra (pega plural e
// variações: "autoclave" casa "autoclaves"); as curtas só casam inteiras. Expressões casam inteiras.
import type { CategoriaDaBiblioteca } from "./tipos.js";

const PESO_FORTE = 3;
const PESO_FRACO = 1;
/** Pontuação mínima do melhor tema para ser proposto. */
export const PONTUACAO_MINIMA = 3;
/** O segundo colocado com pelo menos esta fração do melhor torna o resultado ambíguo. */
const FRACAO_DE_AMBIGUIDADE = 0.7;
const MAXIMO_DE_SUGESTOES = 3;

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function casa(textoNormalizado: string, tokens: readonly string[], palavra: string): boolean {
  const alvo = normalizar(palavra);
  if (alvo === "") return false;
  if (alvo.includes(" ")) return ` ${textoNormalizado} `.includes(` ${alvo} `);
  if (alvo.length >= 6) return tokens.some((t) => t.startsWith(alvo));
  return tokens.includes(alvo);
}

export type PontuacaoDaCategoria = { categoriaId: string; pontos: number };

export function pontuar(
  descricao: string,
  categorias: readonly CategoriaDaBiblioteca[]
): PontuacaoDaCategoria[] {
  const normalizado = normalizar(descricao);
  const tokens = normalizado.split(" ").filter(Boolean);
  return categorias
    .map((c) => {
      const fortes = c.palavrasFortes.filter((w) => casa(normalizado, tokens, w)).length;
      const fracas = c.palavrasFracas.filter((w) => casa(normalizado, tokens, w)).length;
      return { categoriaId: c.id, pontos: fortes * PESO_FORTE + fracas * PESO_FRACO };
    })
    .sort((a, b) => b.pontos - a.pontos || a.categoriaId.localeCompare(b.categoriaId));
}

export type ResultadoDaClassificacao =
  | { resultado: "encontrado"; categoriaId: string }
  | { resultado: "ambiguo"; categoriaIds: string[] }
  | { resultado: "sem-correspondencia" };

export function classificar(
  descricao: string,
  categorias: readonly CategoriaDaBiblioteca[]
): ResultadoDaClassificacao {
  const ranking = pontuar(descricao, categorias);
  const melhor = ranking[0];
  if (!melhor || melhor.pontos < PONTUACAO_MINIMA) return { resultado: "sem-correspondencia" };

  const proximos = ranking.filter(
    (r) => r.categoriaId !== melhor.categoriaId && r.pontos >= melhor.pontos * FRACAO_DE_AMBIGUIDADE
  );
  if (proximos.length === 0) return { resultado: "encontrado", categoriaId: melhor.categoriaId };
  return {
    resultado: "ambiguo",
    categoriaIds: [melhor, ...proximos].slice(0, MAXIMO_DE_SUGESTOES).map((r) => r.categoriaId)
  };
}
