import { motion } from "motion/react";
import { createContext, type ComponentPropsWithoutRef, type ReactNode, useContext } from "react";
import { transicao, variantesDeEntrada, variantesDeLista } from "./movimento";

type Etiqueta = "div" | "section" | "ul" | "ol" | "li";

const componentes = {
  div: motion.div,
  section: motion.section,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li
} as const;

const DentroDeEscalonar = createContext(false);

type RevelarProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  as?: Etiqueta;
  /** Segundos de espera antes de entrar. Dentro de um `Escalonar`, o escalonamento já cuida disso. */
  atraso?: number;
  children?: ReactNode;
};

/**
 * Animação de entrada: o bloco aparece subindo 12px. Sozinho, anima ao montar; dentro de um
 * `Escalonar`, entra na sua vez. Com "reduzir movimento", só o fade permanece (MotionConfig).
 */
export function Revelar({ as = "div", atraso = 0, children, ...props }: RevelarProps) {
  const escalonado = useContext(DentroDeEscalonar);
  const Componente = componentes[as] as typeof motion.div;
  return (
    <Componente
      variants={variantesDeEntrada}
      {...(escalonado ? {} : { initial: "oculto", animate: "visivel" })}
      transition={{ ...transicao.lenta, delay: escalonado ? 0 : atraso }}
      {...(props as object)}
    >
      {children}
    </Componente>
  );
}

type EscalonarProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  as?: Etiqueta;
  children?: ReactNode;
};

/** Container que faz os `Revelar` filhos entrarem um depois do outro. */
export function Escalonar({ as = "div", children, ...props }: EscalonarProps) {
  const Componente = componentes[as] as typeof motion.div;
  return (
    <DentroDeEscalonar.Provider value>
      <Componente
        variants={variantesDeLista}
        initial="oculto"
        animate="visivel"
        {...(props as object)}
      >
        {children}
      </Componente>
    </DentroDeEscalonar.Provider>
  );
}
