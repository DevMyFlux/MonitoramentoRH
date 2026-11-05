import { cn } from "../../../lib/cn";
import { descricaoDoEstado } from "../rotulos";

/** O que o facilitador está fazendo na cena. */
export type EstadoDoAvatar = "falando" | "ouvindo" | "refletindo" | "feedback";

type AvatarFacilitadorProps = { estado: EstadoDoAvatar; tamanho?: number; className?: string };

// O SVG gira e estica em torno do próprio centro, não do canto da tela.
const centro = { transformBox: "fill-box", transformOrigin: "center" } as const;

/**
 * O facilitador da simulação: uma ilustração vetorial (sem vídeo, sem voz, sem IA) que muda de
 * expressão conforme o momento. As animações são em CSS e somem com prefers-reduced-motion; o estado
 * também é dito em texto, então ninguém depende do movimento para entender a cena.
 */
export function AvatarFacilitador({ estado, tamanho = 96, className }: AvatarFacilitadorProps) {
  return (
    <svg
      role="img"
      aria-label={`Facilitador, ${descricaoDoEstado[estado]}`}
      data-estado={estado}
      viewBox="0 0 120 120"
      width={tamanho}
      height={tamanho}
      className={cn(
        "shrink-0",
        estado === "refletindo" && "animate-lab-flutua motion-reduce:animate-none",
        className
      )}
    >
      <circle cx="60" cy="60" r="58" fill="#d1fae5" />
      {/* ombros e pescoço */}
      <path d="M16 120c2-25 20-37 44-37s42 12 44 37z" fill="#065f46" />
      <path d="M48 84l12 12 12-12" fill="#ecfdf5" />
      <rect x="52" y="68" width="16" height="18" rx="6" fill="#d9a77f" />
      {/* cabeça e cabelo */}
      <ellipse cx="60" cy="52" rx="25" ry="28" fill="#eab994" />
      <path d="M34 50c0-19 11-29 26-29s26 10 26 29c-5-9-13-13-26-13S39 41 34 50z" fill="#334155" />
      {/* fone com microfone */}
      <path d="M34 52a26 26 0 0 1 52 0" fill="none" stroke="#0f172a" strokeWidth="4" />
      <rect x="29" y="49" width="8" height="17" rx="4" fill="#0f172a" />
      <rect x="83" y="49" width="8" height="17" rx="4" fill="#0f172a" />
      <path d="M87 64q3 11-15 14" fill="none" stroke="#0f172a" strokeWidth="2.5" />
      <circle cx="71" cy="78" r="3" fill="#0f172a" />
      {/* sobrancelhas */}
      {estado === "refletindo" ? (
        <>
          <path d="M44 41l10-3" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M66 38l10 3" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M44 40q5-3 10 0"
            fill="none"
            stroke="#334155"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M66 40q5-3 10 0"
            fill="none"
            stroke="#334155"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {/* olhos */}
      <g
        style={centro}
        className={cn(estado !== "feedback" && "animate-lab-pisca motion-reduce:animate-none")}
      >
        {estado === "feedback" ? (
          <>
            <path
              d="M44 51q5-6 10 0"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M66 51q5-6 10 0"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx={estado === "refletindo" ? 50 : 49} cy="50" r="3.2" fill="#0f172a" />
            <circle cx={estado === "refletindo" ? 72 : 71} cy="50" r="3.2" fill="#0f172a" />
          </>
        )}
      </g>
      {/* boca */}
      {estado === "falando" ? (
        <ellipse
          cx="60"
          cy="64"
          rx="6"
          ry="4.5"
          fill="#7f1d1d"
          style={centro}
          className="animate-lab-fala motion-reduce:animate-none"
        />
      ) : estado === "feedback" ? (
        <path d="M51 61q9 11 18 0z" fill="#7f1d1d" />
      ) : estado === "ouvindo" ? (
        <path
          d="M53 63q7 5 14 0"
          fill="none"
          stroke="#7f1d1d"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : (
        <path d="M54 64h12" stroke="#7f1d1d" strokeWidth="2.5" strokeLinecap="round" />
      )}
      {/* sinal do momento */}
      {estado === "falando" ? (
        <g fill="#047857">
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={96 + i * 7}
              cy={30 - i * 3}
              r="2.4"
              className="animate-lab-pontos motion-reduce:animate-none"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </g>
      ) : null}
      {estado === "ouvindo" ? (
        <g fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round">
          <path d="M96 38q6 5 0 12" />
          <path d="M101 34q10 9 0 20" />
        </g>
      ) : null}
      {estado === "refletindo" ? (
        <g fill="#047857">
          <circle cx="92" cy="30" r="2" />
          <circle cx="99" cy="23" r="3" />
          <circle cx="108" cy="14" r="4.5" />
        </g>
      ) : null}
      {estado === "feedback" ? (
        <g
          style={centro}
          className="animate-lab-brilho motion-reduce:animate-none"
          fill="none"
          stroke="#047857"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="98" cy="26" r="11" fill="#ecfdf5" />
          <path d="M92 26l4 4 8-9" />
        </g>
      ) : null}
    </svg>
  );
}
