import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { duracao, easing, useAnimacaoReduzida } from "./movimento";

export type TomDeProgresso = "destaque" | "info" | "aviso" | "perigo";

const traco: Record<TomDeProgresso, string> = {
  destaque: "stroke-lab-destaque",
  info: "stroke-lab-info",
  aviso: "stroke-lab-aviso",
  perigo: "stroke-lab-perigo"
};

const preenchimento: Record<TomDeProgresso, string> = {
  destaque: "bg-lab-destaque",
  info: "bg-lab-info",
  aviso: "bg-lab-aviso",
  perigo: "bg-lab-perigo"
};

function limitar(valor: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, valor));
}

type AnelProps = {
  /** De 0 a 100. */
  valor: number;
  /** Lado do desenho, em pixels. */
  tamanho?: number;
  espessura?: number;
  tom?: TomDeProgresso;
  /** O que fica no centro (um número, um ícone). */
  children?: ReactNode;
  className?: string;
};

/**
 * Anel de progresso. É só desenho (`aria-hidden`): o valor também precisa estar escrito em algum
 * lugar da tela, e é lá que o leitor de tela o encontra. O arco "se desenha" ao aparecer.
 */
export function AnelDeProgresso({
  valor,
  tamanho = 88,
  espessura = 7,
  tom = "destaque",
  children,
  className
}: AnelProps) {
  const reduzida = useAnimacaoReduzida();
  const raio = (tamanho - espessura) / 2;
  const fracao = limitar(valor) / 100;
  return (
    <div
      aria-hidden="true"
      className={cn("relative shrink-0", className)}
      style={{ width: tamanho, height: tamanho }}
    >
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          className="stroke-lab-linha"
        />
        <motion.circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          strokeLinecap="round"
          className={traco[tom]}
          transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
          initial={{ pathLength: reduzida ? fracao : 0 }}
          animate={{ pathLength: fracao }}
          transition={{ duration: duracao.lenta * 2.4, ease: easing.saida, delay: 0.1 }}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
      ) : null}
    </div>
  );
}

type BarraProps = {
  /** De 0 a 100. */
  valor: number;
  tom?: TomDeProgresso;
  className?: string;
  /** Altura da barra, em classe do Tailwind. */
  altura?: string;
};

/** Barra de progresso fina. Também é só desenho; preenche da esquerda para a direita ao aparecer. */
export function BarraDeProgresso({
  valor,
  tom = "destaque",
  className,
  altura = "h-1.5"
}: BarraProps) {
  const reduzida = useAnimacaoReduzida();
  const fracao = limitar(valor) / 100;
  return (
    <div
      aria-hidden="true"
      className={cn("overflow-hidden rounded-full bg-lab-superficie-3", altura, className)}
    >
      <motion.div
        className={cn("h-full origin-left rounded-full", preenchimento[tom])}
        style={{ width: "100%" }}
        initial={{ scaleX: reduzida ? fracao : 0 }}
        animate={{ scaleX: fracao }}
        transition={{ duration: duracao.lenta * 1.6, ease: easing.saida, delay: 0.08 }}
      />
    </div>
  );
}

type NivelProps = {
  /** De 1 a `maximo`; `null` = ainda sem evidência. */
  nivel: number | null;
  maximo?: number;
  className?: string;
};

/**
 * O nível de uma skill em segmentos (de 1 a 5). Desenho puro, sem texto: o nível por extenso
 * (`Nível 4 de 5`) fica com quem usa, para leitor de tela.
 */
export function NivelEmSegmentos({ nivel, maximo = 5, className }: NivelProps) {
  const reduzida = useAnimacaoReduzida();
  return (
    <span aria-hidden="true" className={cn("flex gap-1", className)}>
      {Array.from({ length: maximo }, (_, i) => i + 1).map((n) => {
        const cheio = nivel !== null && n <= nivel;
        return (
          <span
            key={n}
            className="relative h-1.5 w-5 overflow-hidden rounded-full bg-lab-superficie-3"
          >
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-lab-destaque"
              initial={{ scaleX: reduzida || !cheio ? (cheio ? 1 : 0) : 0 }}
              animate={{ scaleX: cheio ? 1 : 0 }}
              transition={{ duration: duracao.lenta, ease: easing.saida, delay: 0.08 + n * 0.07 }}
            />
          </span>
        );
      })}
    </span>
  );
}
