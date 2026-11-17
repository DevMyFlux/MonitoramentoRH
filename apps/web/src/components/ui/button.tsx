import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border border-mf-primaria bg-mf-primaria text-white shadow-sm hover:bg-mf-primaria/90",
  secondary: "border border-mf-linha bg-white text-mf-texto shadow-sm hover:bg-slate-50",
  ghost: "text-mf-texto-2 hover:bg-slate-100 hover:text-mf-tinta",
  danger: "border border-mf-perigo/25 bg-mf-perigo-suave text-mf-perigo hover:bg-mf-perigo/10"
};

const sizes: Record<ButtonSize, string> = {
  // No toque (pointer: coarse) o alvo sobe para 44 px; com mouse, fica compacto.
  sm: "h-9 px-3 text-sm [@media(pointer:coarse)]:min-h-11",
  md: "min-h-11 px-4 py-2 text-sm"
};

export function Button({
  children,
  className,
  icon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mf-azul focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px motion-reduce:transform-none",
        variants[variant],
        sizes[size],
        className
      )}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
