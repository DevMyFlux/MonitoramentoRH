// Leadership Lab — tokens de movimento. Um vocabulário só: toda animação do módulo usa estes
// valores, para o produto ter um ritmo único (rápido, suave, sem exagero).
//
// Motion for React é a solução principal. Quem anima respeita `prefers-reduced-motion`:
//  - `MotionConfig reducedMotion="user"` (no LabShell) desliga transformações e layout;
//  - componentes que animam números e preenchimentos consultam `useAnimacaoReduzida()`.
import { MotionGlobalConfig, useReducedMotion, type Transition, type Variants } from "motion/react";

export type CurvaDeBezier = [number, number, number, number];

/** Saída longa e macia (a de "chegar e assentar"); a padrão é para trocas curtas. */
export const easing: Record<"saida" | "padrao" | "entrada", CurvaDeBezier> = {
  saida: [0.22, 1, 0.36, 1],
  padrao: [0.4, 0, 0.2, 1],
  entrada: [0.4, 0, 1, 1]
};

export const duracao = { rapida: 0.15, base: 0.25, lenta: 0.45 } as const;

export const mola: Record<"suave" | "viva", Transition> = {
  suave: { type: "spring", stiffness: 300, damping: 30, mass: 0.8 },
  viva: { type: "spring", stiffness: 460, damping: 34, mass: 0.7 }
};

export const transicao: Record<"rapida" | "base" | "lenta", Transition> = {
  rapida: { duration: duracao.rapida, ease: easing.padrao },
  base: { duration: duracao.base, ease: easing.saida },
  lenta: { duration: duracao.lenta, ease: easing.saida }
};

/** Quanto cada item de uma lista espera pelo anterior ao entrar. */
export const ESCALONAMENTO = 0.06;

/**
 * A entrada padrão de um bloco: sobe 12px enquanto aparece. A transição (e o atraso) vai na
 * propriedade `transition` do elemento, para o `Escalonar` poder escalonar sem conflito.
 */
export const variantesDeEntrada: Variants = {
  oculto: { opacity: 0, y: 12 },
  visivel: { opacity: 1, y: 0 }
};

/** Container que escalona a entrada dos filhos que usam `variantesDeEntrada`. */
export const variantesDeLista: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: ESCALONAMENTO, delayChildren: 0.04 } }
};

/**
 * Verdadeiro quando não se deve animar: o usuário pediu menos movimento no sistema, ou os testes
 * desligaram as animações (`MotionGlobalConfig.skipAnimations`). Quem anima valores (números,
 * barras) pula direto para o valor final.
 */
export function useAnimacaoReduzida(): boolean {
  const reduzida = useReducedMotion();
  return Boolean(reduzida) || MotionGlobalConfig.skipAnimations === true;
}
