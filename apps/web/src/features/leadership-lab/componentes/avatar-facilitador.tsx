import { cn } from "../../../lib/cn";
import { descricaoDoEstado } from "../rotulos";

/** O que o facilitador está fazendo na cena. */
export type EstadoDoAvatar = "falando" | "ouvindo" | "refletindo" | "feedback";

type AvatarFacilitadorProps = { estado: EstadoDoAvatar; tamanho?: number; className?: string };

const centro = { transformBox: "fill-box", transformOrigin: "center" } as const;
const PRETO = "#111827";

/**
 * O facilitador da simulação: o mascote (gota preta, boné e camiseta com o Ø) em ilustração
 * vetorial, sem vídeo, voz nem IA. O estado muda o rosto e o braço: falando (aponta para a
 * situação), ouvindo, refletindo e feedback (joinha). As animações são em CSS e somem com
 * prefers-reduced-motion; o estado também é dito em texto.
 */
export function AvatarFacilitador({ estado, tamanho = 96, className }: AvatarFacilitadorProps) {
  const apontando = estado === "falando";
  return (
    <svg
      role="img"
      aria-label={`Facilitador, ${descricaoDoEstado[estado]}`}
      data-estado={estado}
      viewBox="0 0 130 170"
      width={tamanho}
      height={(tamanho * 170) / 130}
      className={cn(
        "shrink-0",
        estado === "refletindo" && "animate-lab-flutua motion-reduce:animate-none",
        className
      )}
    >
      {/* pernas e tênis */}
      <rect x="44" y="132" width="14" height="22" rx="6" fill={PRETO} />
      <rect x="68" y="132" width="14" height="22" rx="6" fill={PRETO} />
      <path d="M38 156q0-6 10-6h12v10H40q-2 0-2-4z" fill="#1f2937" />
      <path d="M38 158h22v4H40z" fill="#f8fafc" />
      <path d="M66 150h12q10 0 10 6 0 4-2 4H66z" fill="#1f2937" />
      <path d="M66 158h22v4H66z" fill="#f8fafc" />
      {/* braço de trás */}
      <path
        d="M40 108q-8 10-8 22"
        fill="none"
        stroke={PRETO}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="32" cy="133" r="6" fill={PRETO} />
      {/* camiseta e shorts */}
      <path
        d="M38 104h54l6 12-8 4v12H40v-12l-8-4z"
        fill="#1f2937"
        stroke={PRETO}
        strokeWidth="1.5"
      />
      <path d="M40 130h50l2 10H38z" fill="#111827" />
      <circle cx="65" cy="118" r="5.5" fill="none" stroke="#f8fafc" strokeWidth="2" />
      <path d="M61 123l8-10" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
      {/* braço da frente */}
      {apontando ? (
        <g>
          <path
            d="M92 108q14-4 26-18"
            fill="none"
            stroke={PRETO}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path d="M116 92l10-12" stroke={PRETO} strokeWidth="6" strokeLinecap="round" />
          <circle cx="116" cy="94" r="6" fill={PRETO} />
        </g>
      ) : estado === "feedback" ? (
        <g>
          <path
            d="M92 108q12 0 18-14"
            fill="none"
            stroke={PRETO}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <rect x="106" y="80" width="12" height="16" rx="5" fill={PRETO} />
          <rect x="110" y="68" width="5" height="16" rx="2.5" fill={PRETO} />
        </g>
      ) : estado === "refletindo" ? (
        <g>
          <path
            d="M92 108q8 4 0-12 -6-8-12-8"
            fill="none"
            stroke={PRETO}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <circle cx="76" cy="88" r="6" fill={PRETO} />
        </g>
      ) : (
        <g>
          <path
            d="M92 108q8 10 8 22"
            fill="none"
            stroke={PRETO}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <circle cx="100" cy="133" r="6" fill={PRETO} />
        </g>
      )}
      {/* cabeça em gota */}
      <path
        d="M40 4C50 20 90 30 98 62c4 24-14 42-38 42S18 86 22 62C28 36 40 24 40 4z"
        fill={PRETO}
      />
      <path
        d="M34 40q4-18 6-30"
        fill="none"
        stroke="#374151"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* rosto, barba e cabelo grisalho */}
      <ellipse cx="60" cy="68" rx="24" ry="22" fill="#eab994" />
      <path d="M34 62q-4 14 6 24 6-4 4-14z M86 62q4 14-6 24-6-4-4-14z" fill="#e5e7eb" />
      <path d="M38 74q6 28 22 28t22-28q-6 8-22 8T38 74z" fill="#f3f4f6" />
      {/* boné com Ø */}
      <path
        d="M32 52q2-24 30-26 26 0 30 26-30-8-60 0z"
        fill="#1f2937"
        stroke={PRETO}
        strokeWidth="1.5"
      />
      <path d="M62 52q26-2 40 6-6 4-40-2z" fill="#111827" />
      <circle cx="62" cy="38" r="5.5" fill="none" stroke="#f8fafc" strokeWidth="2" />
      <path d="M58 43l8-10" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
      {/* sobrancelhas */}
      <path
        d={estado === "refletindo" ? "M42 60l12-4M66 56l12 4" : "M42 58q6-4 12 0M66 58q6-4 12 0"}
        fill="none"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* olhos */}
      <g
        style={centro}
        className={cn(estado !== "feedback" && "animate-lab-pisca motion-reduce:animate-none")}
      >
        {estado === "feedback" ? (
          <path
            d="M42 68q6-7 12 0M66 68q6-7 12 0"
            fill="none"
            stroke={PRETO}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ) : (
          <>
            <circle cx="49" cy="67" r="6" fill="#fff" />
            <circle cx="71" cy="67" r="6" fill="#fff" />
            <circle cx={estado === "refletindo" ? 52 : 50} cy="67" r="3.2" fill="#4b2e1a" />
            <circle cx={estado === "refletindo" ? 74 : 72} cy="67" r="3.2" fill="#4b2e1a" />
          </>
        )}
      </g>
      {/* boca */}
      {estado === "falando" ? (
        <ellipse
          cx="60"
          cy="86"
          rx="6"
          ry="4"
          fill="#7f1d1d"
          style={centro}
          className="animate-lab-fala motion-reduce:animate-none"
        />
      ) : estado === "feedback" ? (
        <path d="M51 82q9 12 18 0z" fill="#fff" stroke="#7f1d1d" strokeWidth="1.5" />
      ) : estado === "ouvindo" ? (
        <path
          d="M52 84q8 6 16 0"
          fill="none"
          stroke="#7f1d1d"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : (
        <path d="M54 86h12" stroke="#7f1d1d" strokeWidth="2.5" strokeLinecap="round" />
      )}
      {estado === "refletindo" ? (
        <g fill="#047857">
          <circle cx="100" cy="30" r="2" />
          <circle cx="107" cy="22" r="3" />
          <circle cx="116" cy="12" r="4.5" />
        </g>
      ) : null}
    </svg>
  );
}
