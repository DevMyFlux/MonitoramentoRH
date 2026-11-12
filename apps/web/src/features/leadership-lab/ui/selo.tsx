import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Um pontinho colorido antes do texto: bom para estados (ativo, aberto, pendente). */
  dot?: boolean;
};

const tones: Record<BadgeTone, { caixa: string; ponto: string }> = {
  success: {
    caixa: "bg-lab-sucesso-suave text-lab-sucesso-texto ring-lab-sucesso/15",
    ponto: "bg-lab-sucesso"
  },
  warning: {
    caixa: "bg-lab-aviso-suave text-lab-aviso-texto ring-lab-aviso/20",
    ponto: "bg-lab-aviso"
  },
  danger: {
    caixa: "bg-lab-perigo-suave text-lab-perigo-texto ring-lab-perigo/15",
    ponto: "bg-lab-perigo"
  },
  neutral: {
    caixa: "bg-lab-superficie-3 text-lab-tinta-2 ring-lab-linha-forte/60",
    ponto: "bg-lab-tinta-3"
  },
  info: {
    caixa: "bg-lab-info-suave text-lab-info-texto ring-lab-info/15",
    ponto: "bg-lab-info"
  }
};

/** O selo de estado: pílula em tom suave. Os cinco tons são os semânticos do design system. */
export function Badge({
  children,
  className,
  dot = false,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-lab-legenda font-medium ring-1 ring-inset",
        tones[tone].caixa,
        className
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", tones[tone].ponto)} />
      ) : null}
      {children}
    </span>
  );
}
