import type { InputHTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

type MarcacaoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "checkbox" | "radio";
};

/**
 * A caixa de marcar (ou o botão de opção) do Lab, na cor de destaque. É só o controle: o rótulo fica
 * com quem usa, num `<label>` em volta.
 */
export function Marcacao({ className, type = "checkbox", ...props }: MarcacaoProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--lab-destaque))] disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}
