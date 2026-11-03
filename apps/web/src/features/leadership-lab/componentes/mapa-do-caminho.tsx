import { Check, Flag } from "lucide-react";
import { cn } from "../../../lib/cn";

type MapaDoCaminhoProps = {
  total: number;
  /** A situação em que o participante está agora (começa em 1). */
  atual: number;
  /** A situação que é o marco do teste. */
  marco: number;
};

/** O caminho do teste: as situações já feitas, a atual, as que faltam e onde fica o marco. */
export function MapaDoCaminho({ total, atual, marco }: MapaDoCaminhoProps) {
  const passos = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Situação {atual} de {total}
      </p>
      <ol aria-label="Mapa do caminho" className="flex items-center">
        {passos.map((n) => {
          const estado = n < atual ? "feita" : n === atual ? "atual" : "proxima";
          const ultimo = n === total;
          return (
            <li
              key={n}
              aria-current={estado === "atual" ? "step" : undefined}
              className={cn("flex items-center", ultimo ? "" : "flex-1")}
            >
              <span
                className={cn(
                  "relative grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                  estado === "feita" && "border-emerald-700 bg-emerald-700 text-white",
                  estado === "atual" &&
                    "border-emerald-700 bg-white text-emerald-800 ring-4 ring-emerald-100",
                  estado === "proxima" && "border-slate-300 bg-white text-slate-400"
                )}
              >
                {estado === "feita" ? <Check size={16} aria-hidden="true" /> : n}
                {n === marco ? (
                  <Flag
                    size={14}
                    aria-hidden="true"
                    className="absolute -right-1.5 -top-2 fill-amber-400 text-amber-600"
                  />
                ) : null}
                <span className="sr-only">
                  Situação {n}
                  {n === marco ? ", marco" : ""}:{" "}
                  {estado === "feita" ? "feita" : estado === "atual" ? "em andamento" : "a seguir"}
                </span>
              </span>
              {ultimo ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 h-0.5 flex-1",
                    estado === "feita" ? "bg-emerald-700" : "bg-slate-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
