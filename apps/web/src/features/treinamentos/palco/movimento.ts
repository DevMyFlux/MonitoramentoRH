// Movimento reduzido no Palco: a preferência do sistema (prefers-reduced-motion), via motion.
import { useReducedMotion } from "motion/react";

export function useMovimentoReduzido(): boolean {
  return useReducedMotion() === true;
}
