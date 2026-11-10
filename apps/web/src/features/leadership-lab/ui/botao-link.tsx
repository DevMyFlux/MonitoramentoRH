import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { type ButtonSize, type ButtonVariant, classeDoBotao } from "./classe-do-botao";

type BotaoLinkProps = LinkProps & {
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** Um link com a aparência de botão (um `<a>` de verdade, sem botão dentro de link). */
export function BotaoLink({
  children,
  className,
  icon,
  size = "md",
  variant = "primary",
  ...props
}: BotaoLinkProps) {
  return (
    <Link className={cn(classeDoBotao(variant, size), "active:scale-[0.97]", className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
