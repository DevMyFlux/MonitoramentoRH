// Cartão com luz que segue o mouse. Origem: ideia do "Spotlight Card" do React Bits (reactbits.dev),
// escrita do zero (CSS + um onPointerMove que só grava duas variáveis), sem copiar o código deles.
// Por quê: dá vida aos indicadores e mostra qual cartão está em foco. A luz usa só o verde da paleta
// com transparência, nunca esconde conteúdo, e no toque (sem ponteiro) simplesmente não aparece.
import { type HTMLAttributes, type PointerEvent, forwardRef } from "react";
import { cn } from "../../lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** A cor da luz: verde (padrão) ou azul. Só as duas da paleta. */
  tom?: "verde" | "azul";
};

export const CartaoSpotlight = forwardRef<HTMLDivElement, Props>(function CartaoSpotlight(
  { className, onPointerMove, tom = "verde", style, ...props },
  ref
) {
  function seguir(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
    onPointerMove?.(e);
  }
  return (
    <div
      ref={ref}
      onPointerMove={seguir}
      style={{
        ...style,
        ["--spot" as string]: tom === "azul" ? "var(--mf-azul)" : "var(--mf-brilho)"
      }}
      className={cn(
        "spotlight rounded-2xl border border-mf-linha bg-mf-cartao shadow-[0_1px_2px_rgb(var(--mf-tinta)/0.04)]",
        className
      )}
      {...props}
    />
  );
});
