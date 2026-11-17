// Dica (tooltip) em CSS puro, para siglas e códigos ("5x2", "Par/Ímpar", iniciais). Escrita do zero.
// Por quê: o atributo title não aparece no toque e é lento no mouse. Aqui a dica abre ao passar o
// mouse OU ao focar (teclado e toque), e o texto também vai em aria-label para o leitor de tela.
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = { texto: string; children: ReactNode; className?: string };

export function Dica({ texto, children, className }: Props) {
  return (
    <span
      tabIndex={0}
      aria-label={texto}
      className={cn(
        "group/dica relative cursor-help rounded underline decoration-dotted decoration-mf-texto-3/60 underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-mf-azul",
        className
      )}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 translate-y-1 rounded-lg bg-mf-tinta px-2.5 py-1.5 text-center text-xs font-normal leading-4 text-white opacity-0 shadow-lg transition duration-150 group-hover/dica:translate-y-0 group-hover/dica:opacity-100 group-focus-visible/dica:translate-y-0 group-focus-visible/dica:opacity-100 motion-reduce:transition-none"
      >
        {texto}
      </span>
    </span>
  );
}
