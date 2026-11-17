// Botão principal com borda de luz giratória. Origem: ideia do "Star Border" do React Bits
// (reactbits.dev), escrita do zero em CSS (um gradiente cônico girando atrás do botão).
// Por quê: marca a ação principal da tela ("Novo colaborador") e só ela, para o olho achá-la rápido.
// Usa só esmeralda e azul da paleta. Desativado ou com prefers-reduced-motion, a borda fica parada.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  /** Classes do envoltório da borda (posição na grade, ordem). */
  envoltorio?: string;
};

export function BotaoEstrela({
  children,
  className,
  envoltorio,
  icon,
  type = "button",
  disabled,
  ...props
}: Props) {
  return (
    <span
      className={cn("borda-estrela inline-flex shrink-0", envoltorio)}
      data-desativado={disabled || undefined}
    >
      <button
        type={type}
        disabled={disabled}
        className={cn(
          "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.625rem] bg-mf-primaria px-4 py-2 text-sm font-semibold text-white transition hover:bg-mf-primaria/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mf-azul focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px motion-reduce:transform-none",
          className
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    </span>
  );
}
