// Leadership Lab — as cores usadas dentro de SVG (Recharts), que não herdam as classes do Tailwind.
// Espelham os tokens de tokens.css; `cores.test.ts` falha se os dois divergirem.
export const cores = {
  tinta: "#1d1d1f",
  tinta2: "#636369",
  linha: "#e8e8ed",
  destaque: "#047857",
  destaqueSuave: "#ecf7f2",
  info: "#1d4ed8",
  aviso: "#b45309",
  perigo: "#b91c1c"
} as const;

/** "#047857" -> "4 120 87", o formato dos tokens CSS. */
export function hexParaCanais(hex: string): string {
  const limpo = hex.replace("#", "");
  const n = Number.parseInt(limpo, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
