import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "../../../lib/cn";
import { duracao, easing, useAnimacaoReduzida } from "./movimento";

type ExpansivelProps = {
  /** O que fica sempre visível: o botão que abre e fecha. */
  cabecalho: ReactNode;
  children: ReactNode;
  /** Começa aberto. Padrão: fechado. */
  abertoNoInicio?: boolean;
  className?: string;
  /** Nome para tecnologia assistiva do bloco que abre. */
  rotuloDoConteudo?: string;
};

/**
 * Um bloco que abre e fecha com animação de altura (o "expandir cartão" do produto). O cabeçalho é
 * um botão com `aria-expanded`/`aria-controls`; o conteúdo, uma região. Não anima na primeira
 * renderização, só nas trocas.
 */
export function Expansivel({
  cabecalho,
  children,
  abertoNoInicio = false,
  className,
  rotuloDoConteudo
}: ExpansivelProps) {
  const [aberto, setAberto] = useState(abertoNoInicio);
  const id = useId();
  const reduzida = useAnimacaoReduzida();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="group flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="min-w-0 flex-1">{cabecalho}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-lab-tinta-3 transition-transform duration-lab ease-lab group-hover:text-lab-tinta motion-reduce:transition-none",
            aberto && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {aberto ? (
          <motion.div
            key="conteudo"
            id={id}
            role="region"
            {...(rotuloDoConteudo ? { "aria-label": rotuloDoConteudo } : {})}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduzida ? 0 : duracao.base + 0.05, ease: easing.saida }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
