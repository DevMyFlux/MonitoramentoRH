import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

type MensagemDeErroProps = HTMLAttributes<HTMLDivElement> & {
  /** "caixa": bloco em tom de perigo (erro de uma ação). "texto": uma linha discreta sob o campo. */
  variante?: "caixa" | "texto";
  /** Uma linha em destaque antes da descrição. */
  titulo?: string;
};

const variantes = {
  caixa:
    "rounded-lab-md border border-lab-perigo/20 bg-lab-perigo-suave p-3.5 text-lab-pequeno leading-5 text-lab-perigo-texto",
  texto: "text-lab-pequeno text-lab-perigo-texto"
} as const;

/**
 * O erro de uma ação, dito no lugar onde ela aconteceu. É `role="alert"`: o leitor de tela o anuncia
 * assim que aparece. Para a tela inteira que não carregou, use `ErrorState`.
 */
export function MensagemDeErro({
  children,
  className,
  titulo,
  variante = "caixa",
  ...props
}: MensagemDeErroProps) {
  return (
    <div role="alert" className={cn(variantes[variante], className)} {...props}>
      {titulo ? <p className="font-semibold">{titulo}</p> : null}
      {children}
    </div>
  );
}
