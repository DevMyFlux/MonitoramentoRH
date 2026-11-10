import { Check, Flag } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../../lib/cn";
import { duracao, easing, useAnimacaoReduzida } from "../ui/movimento";

type MapaDoCaminhoProps = {
  total: number;
  /** A situação em que o participante está agora (começa em 1). */
  atual: number;
  /** A situação que é o marco do teste. */
  marco: number;
  /** Versão menor, para caber dentro de um cartão. */
  compacto?: boolean;
};

/**
 * A linha do tempo do teste: as situações já feitas (preenchidas), a atual (em destaque, com um
 * pulso) e as que faltam, com o marco sinalizado. Os trechos entre os passos se preenchem ao
 * aparecer. O estado de cada passo também vai em texto, para leitor de tela.
 */
export function MapaDoCaminho({ total, atual, marco, compacto = false }: MapaDoCaminhoProps) {
  const reduzida = useAnimacaoReduzida();
  const passos = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div>
      <p className="mb-4 text-lab-pequeno font-medium text-lab-tinta-2">
        Situação {atual} de {total}
      </p>
      <ol aria-label="Mapa do caminho" className="flex items-center pt-2">
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
                  "relative grid shrink-0 place-items-center rounded-full text-lab-pequeno font-semibold transition-colors duration-lab",
                  compacto ? "h-8 w-8" : "h-10 w-10",
                  estado === "feita" && "bg-lab-destaque text-white",
                  estado === "atual" &&
                    "bg-lab-superficie text-lab-destaque ring-2 ring-lab-destaque",
                  estado === "proxima" && "bg-lab-superficie-3 text-lab-tinta-3"
                )}
              >
                {estado === "atual" ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-lab-pulso-anel rounded-full ring-2 ring-lab-destaque/60 motion-reduce:animate-none"
                  />
                ) : null}
                {estado === "feita" ? <Check size={compacto ? 15 : 17} aria-hidden="true" /> : n}
                {n === marco ? (
                  <Flag
                    size={14}
                    aria-hidden="true"
                    className="absolute -right-1.5 -top-2.5 fill-lab-aviso/70 text-lab-aviso"
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
                  className="relative mx-1.5 h-0.5 flex-1 overflow-hidden rounded-full bg-lab-linha"
                >
                  <motion.span
                    className="absolute inset-0 origin-left bg-lab-destaque"
                    initial={{ scaleX: reduzida && estado === "feita" ? 1 : 0 }}
                    animate={{ scaleX: estado === "feita" ? 1 : 0 }}
                    transition={{
                      duration: duracao.lenta,
                      ease: easing.saida,
                      delay: 0.1 + n * 0.08
                    }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
