// Faísca de confirmação: um pequeno estouro de partículas onde a pessoa clicou, só quando a ação DEU
// CERTO (gerar, enviar, aprovar, publicar). Origem: ideia do "Click Spark" (React Bits,
// reactbits.dev), escrita do zero com a Web Animations API, sem biblioteca. Por quê: confirma com um
// gesto curto o que o texto de aviso diz. Usa só cores da paleta e não faz nada com
// prefers-reduced-motion.

/** O centro do elemento em foco agora (o botão clicado): guardar ANTES de esperar a resposta. */
export function centroDoFoco(): { x: number; y: number } | null {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const CORES = ["--mf-brilho", "--mf-azul", "--mf-realce", "--mf-primaria"];

/** Um estouro curto de 10 partículas. Não faz nada com prefers-reduced-motion. */
export function faisca(origem: { x: number; y: number } | null): void {
  if (!origem || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement("span");
    const angulo = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
    const distancia = 26 + Math.random() * 26;
    Object.assign(p.style, {
      position: "fixed",
      left: `${origem.x}px`,
      top: `${origem.y}px`,
      width: "6px",
      height: "6px",
      borderRadius: "9999px",
      background: `rgb(var(${CORES[i % CORES.length]}))`,
      pointerEvents: "none",
      zIndex: "70"
    });
    p.setAttribute("aria-hidden", "true");
    document.body.appendChild(p);
    const animacao = p.animate?.(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angulo) * distancia}px), calc(-50% + ${Math.sin(angulo) * distancia}px)) scale(0.2)`,
          opacity: 0
        }
      ],
      { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
    );
    if (animacao) animacao.onfinish = () => p.remove();
    else p.remove();
  }
}
