// Leadership Lab — a lógica pura da navegação do layout, fora dos componentes para ser testada à parte.
import type { Role } from "@my-flux/types";
import {
  itemVisivelPara,
  type NavigationGroup,
  type NavigationItem,
  navigationGroups
} from "../../navigation/nav-items";

/** Qual item do menu corresponde à página: o de endereço mais específico que a contém. */
export function itemAtivo(pathname: string, itens: readonly NavigationItem[]): string | null {
  const candidatos = itens
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return candidatos.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Os grupos do menu que este perfil enxerga. O Desenvolvimento (onde mora o Lab) vem primeiro: é
 * a casa de quem está aqui. Nada some do menu: só muda a ordem.
 */
export function gruposDoMenu(perfil: Role | undefined, modoDeTeste: boolean): NavigationGroup[] {
  const visiveis = navigationGroups
    .filter((grupo) => !grupo.hidden)
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter(
        (item) => !item.hidden && itemVisivelPara(item, perfil, modoDeTeste)
      )
    }))
    .filter((grupo) => grupo.items.length > 0);
  return [
    ...visiveis.filter((g) => g.label === "Desenvolvimento"),
    ...visiveis.filter((g) => g.label !== "Desenvolvimento")
  ];
}

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
