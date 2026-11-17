// Interruptor (liga/desliga) acessível. Origem: inspirado nos "Switch" da galeria Uiverse
// (uiverse.io), escrito do zero com Tailwind sobre um <input type="checkbox" role="switch">, então o
// teclado, o foco e o leitor de tela são os nativos. Por quê: "Mostrar desligados" é um estado
// ligado ou desligado, e o interruptor diz isso melhor que uma caixinha. Alvo de toque de 44 px.
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & { rotulo: string };

export function Interruptor({ rotulo, className, ...props }: Props) {
  return (
    <label
      className={cn(
        "group inline-flex min-h-11 cursor-pointer select-none items-center gap-3 text-sm text-mf-texto-2",
        className
      )}
    >
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-mf-linha ring-1 ring-inset ring-mf-texto-3/20 transition-colors duration-200 peer-checked:bg-mf-primaria peer-focus-visible:ring-[3px] peer-focus-visible:ring-mf-azul peer-focus-visible:ring-offset-2 peer-disabled:opacity-60 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
      />
      <span className="group-hover:text-mf-tinta">{rotulo}</span>
    </label>
  );
}
