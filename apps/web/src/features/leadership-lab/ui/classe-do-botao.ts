import { cn } from "../../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-lab-destaque text-white shadow-lab-1 hover:bg-lab-destaque-forte",
  secondary:
    "border border-lab-linha-forte bg-lab-superficie text-lab-tinta shadow-lab-1 hover:bg-lab-superficie-2",
  soft: "bg-lab-destaque-suave text-lab-destaque-texto hover:bg-lab-destaque/15",
  ghost: "text-lab-tinta-2 hover:bg-lab-tinta/5 hover:text-lab-tinta",
  danger:
    "border border-lab-perigo/20 bg-lab-perigo-suave text-lab-perigo-texto hover:bg-lab-perigo/10"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-lab-pequeno",
  md: "min-h-11 px-5 py-2 text-lab-pequeno",
  lg: "min-h-12 px-7 py-2.5 text-lab-corpo",
  // Botão quadrado só com ícone (sem padding, para o ícone não ser espremido).
  icon: "h-10 w-10 p-0"
};

/** As classes de um botão, para o que parece botão mas é link (BotaoLink). */
export function classeDoBotao(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-medium transition-colors duration-lab-rapida",
    variants[variant],
    sizes[size]
  );
}
