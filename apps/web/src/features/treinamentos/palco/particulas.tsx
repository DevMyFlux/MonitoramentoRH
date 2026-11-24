// Partículas do Palco num canvas por cima da cena (blend "screen"): faíscas no arco, brasas no
// quadro quente e poeira no ar. Orçamento: no máximo 400 partículas, um requestAnimationFrame só,
// pausado com a aba oculta e desligado com "reduzir movimento" (aí nem o canvas é desenhado).
import { useEffect, useRef } from "react";
import type { ModoDasParticulas } from "./pacotes";

export const MAXIMO_DE_PARTICULAS = 400;

type Particula = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  r: number;
};

const config: Record<Exclude<ModoDasParticulas, "nenhuma">, { taxa: number; cor: string }> = {
  faiscas: { taxa: 14, cor: "255,236,179" },
  brasas: { taxa: 2, cor: "251,191,36" },
  poeira: { taxa: 1, cor: "226,232,240" }
};

/** Nasce uma partícula do modo, em coordenadas relativas (0–1) ao quadro. */
function nascer(
  modo: Exclude<ModoDasParticulas, "nenhuma">,
  origem: { x: number; y: number }
): Particula {
  if (modo === "poeira")
    return {
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0004,
      vy: -0.0002,
      vida: 0,
      max: 400,
      r: 1.2
    };
  const angulo = Math.random() * Math.PI * 2;
  const velocidade = modo === "faiscas" ? 0.004 + Math.random() * 0.01 : 0.0008;
  return {
    x: origem.x + (Math.random() - 0.5) * 0.02,
    y: origem.y + (Math.random() - 0.5) * 0.02,
    vx: Math.cos(angulo) * velocidade,
    vy:
      modo === "faiscas" ? Math.sin(angulo) * velocidade - 0.004 : -0.0012 - Math.random() * 0.001,
    vida: 0,
    max: modo === "faiscas" ? 40 + Math.random() * 30 : 120,
    r: modo === "faiscas" ? 1.6 : 2.2
  };
}

export function Particulas({
  modo,
  reduzido,
  origem = { x: 0.78, y: 0.53 }
}: {
  modo: ModoDasParticulas;
  reduzido: boolean;
  /** De onde nascem faíscas e brasas (relativo ao quadro). */
  origem?: { x: number; y: number };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { x: origemX, y: origemY } = origem;

  useEffect(() => {
    const elemento = canvas.current;
    if (reduzido || modo === "nenhuma" || !elemento) return;
    const contexto = elemento.getContext?.("2d");
    if (!contexto) return;
    const { taxa, cor } = config[modo];
    const vivas: Particula[] = [];
    let quadro = 0;

    const ajustar = () => {
      const { width, height } = elemento.getBoundingClientRect();
      elemento.width = Math.max(1, Math.round(width));
      elemento.height = Math.max(1, Math.round(height));
    };
    ajustar();
    window.addEventListener("resize", ajustar);

    const passo = () => {
      quadro = requestAnimationFrame(passo);
      if (document.hidden) return; // aba oculta: nada a desenhar
      for (let i = 0; i < taxa && vivas.length < MAXIMO_DE_PARTICULAS; i++)
        vivas.push(nascer(modo, { x: origemX, y: origemY }));
      const { width, height } = elemento;
      contexto.clearRect(0, 0, width, height);
      for (let i = vivas.length - 1; i >= 0; i--) {
        const p = vivas[i]!;
        p.vida += 1;
        p.x += p.vx;
        p.y += p.vy;
        if (modo === "faiscas") p.vy += 0.0004; // gravidade
        if (p.vida > p.max || p.y < -0.05 || p.y > 1.05) {
          vivas.splice(i, 1);
          continue;
        }
        const alfa = 1 - p.vida / p.max;
        contexto.fillStyle = `rgba(${cor},${(alfa * (modo === "poeira" ? 0.35 : 0.95)).toFixed(3)})`;
        contexto.beginPath();
        contexto.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2);
        contexto.fill();
      }
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", ajustar);
    };
  }, [modo, reduzido, origemX, origemY]);

  if (reduzido || modo === "nenhuma") return null;
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen"
    />
  );
}
