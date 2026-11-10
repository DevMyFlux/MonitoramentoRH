import { useEffect, useRef, type RefObject } from "react";

const FOCAVEIS =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [data-foco-inicial]';

/**
 * Mantém o foco do teclado dentro de um painel sobreposto (modal, menu lateral no celular).
 * Enquanto ativo: foca o primeiro controle (ou o marcado com `data-foco-inicial`), prende o Tab no
 * painel, fecha com Esc, trava a rolagem da página e devolve o foco a quem o tinha ao fechar.
 */
export function useArmadilhaDeFoco<T extends HTMLElement>(
  ativa: boolean,
  aoFechar: () => void
): RefObject<T | null> {
  const painel = useRef<T>(null);
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    const raiz = painel.current;
    if (!ativa || !raiz) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;

    const focaveis = () =>
      Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (el) =>
          !(el as HTMLButtonElement).disabled && !el.hidden && !el.closest("[hidden], [inert]")
      );

    (raiz.querySelector<HTMLElement>("[data-foco-inicial]") ?? focaveis()[0] ?? raiz).focus();
    document.body.style.overflow = "hidden";

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        fechar.current();
        return;
      }
      if (evento.key !== "Tab") return;
      const itens = focaveis();
      const primeiro = itens[0];
      const ultimo = itens.at(-1);
      if (!primeiro || !ultimo) {
        evento.preventDefault();
        return;
      }
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
      anterior?.focus();
    };
  }, [ativa]);

  return painel;
}
