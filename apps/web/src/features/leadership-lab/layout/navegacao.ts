// Leadership Lab — a lógica pura da navegação do layout, fora dos componentes para ser testada à parte.
/** "Ana Souza" -> "AS"; "ana" -> "A". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toLocaleUpperCase("pt-BR");
}

/**
 * A chave que decide quando a página "troca" (e ganha a transição). Entre as abas do
 * acompanhamento do RH o cabeçalho e as abas não devem piscar: lá, quem anima é o conteúdo.
 */
export function chaveDaTransicao(pathname: string): string {
  return pathname.startsWith("/lab/rh") ? "/lab/rh" : pathname;
}
