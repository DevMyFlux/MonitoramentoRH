// Magnet: o elemento se aproxima de leve do ponteiro quando ele chega perto, e volta ao lugar quando
// sai. Origem: ideia do "Magnet" do React Bits (reactbits.dev), escrita do zero (sem a biblioteca).
// Por quê: convida a clicar no botão de ajuda, que fica parado no canto. Só com mouse (no toque não
// há ponteiro "perto") e desligado com prefers-reduced-motion. Não muda o tamanho do alvo clicável.
import { type ReactNode, useEffect, useRef } from "react";

type MagnetProps = {
  children: ReactNode;
  /** A que distância do elemento (em px) o ponteiro já atrai. */
  alcance?: number;
  /** O máximo que o elemento anda (em px). */
  forca?: number;
  className?: string;
};

export function Magnet({ children, alcance = 72, forca = 7, className }: MagnetProps) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    // Sem matchMedia (ambiente antigo ou de teste), o efeito simplesmente não liga.
    if (typeof window.matchMedia !== "function") return;
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!mouse || reduzido) return;

    let quadro = 0;
    const mover = (x: number, y: number) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };
    const aoMover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const perto = Math.hypot(dx, dy) < Math.max(r.width, r.height) / 2 + alcance;
      if (!perto) return mover(0, 0);
      const limite = (v: number) => Math.max(-forca, Math.min(forca, v * 0.25));
      mover(limite(dx), limite(dy));
    };
    const aoSair = () => mover(0, 0);

    window.addEventListener("pointermove", aoMover, { passive: true });
    document.addEventListener("pointerleave", aoSair);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerleave", aoSair);
      el.style.transform = "";
    };
  }, [alcance, forca]);

  return (
    <div
      ref={caixa}
      className={className}
      style={{ transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      {children}
    </div>
  );
}
