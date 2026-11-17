import type { PointerEvent } from "react";

/** Grava a posição do ponteiro (--x, --y) no elemento: é o que a luz do `.spotlight` segue. */
export function seguirPonteiro(e: PointerEvent<HTMLElement>): void {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
}
