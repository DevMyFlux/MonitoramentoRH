import { Loader2 } from "lucide-react";
import { type HTMLMotionProps, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { type ButtonSize, type ButtonVariant, classeDoBotao } from "./classe-do-botao";
import { mola } from "./movimento";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children?: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Troca o ícone por um indicador de carregamento e trava o botão. */
  loading?: boolean;
};

/** O botão do Lab: pílula, com resposta ao toque (Motion) e estados de carregamento e desabilitado. */
export function Button({
  children,
  className,
  disabled,
  icon,
  loading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const travado = Boolean(disabled) || loading;
  return (
    <motion.button
      className={cn(
        classeDoBotao(variant, size),
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      type={type}
      disabled={travado}
      aria-busy={loading || undefined}
      {...(travado ? {} : { whileTap: { scale: 0.97 } })}
      transition={mola.viva}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
    </motion.button>
  );
}
