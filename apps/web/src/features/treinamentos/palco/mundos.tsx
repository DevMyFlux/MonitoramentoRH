// Os "mundos" em SVG de cada pacote de cena (viewBox 1600×900). Desenho próprio (sem bibliotecas).
// Recebem o estado da cena (comandos já aplicados) e se o movimento está reduzido; a câmera, as
// partículas, a vinheta e o HUD ficam no Palco. Cores: tinta e esmeralda da marca; âmbar e vermelho
// só para atenção e risco, sempre acompanhados de texto no painel e na descrição da cena.
import { useId } from "react";
import type { EstadoDaCena } from "../fluxo";

type PropsDoMundo = { estado: EstadoDaCena; reduzido: boolean };

const COR_DO_LED: Record<string, string> = { amber: "#FBBF24", green: "#34D399", red: "#F87171" };

/** Corredor em perspectiva com a UTI à esquerda e o quadro elétrico à direita. */
export function MundoHospitalEnergia({ estado, reduzido }: PropsDoMundo) {
  const id = useId().replace(/:/g, "");
  const led = COR_DO_LED[estado.led ?? "amber"] ?? COR_DO_LED.amber!;
  const arco = estado.state === "arc";
  const seguro = estado.state === "safe";
  const quente = estado.led === "amber" && !seguro && !arco;
  return (
    <g>
      <defs>
        <linearGradient id={`piso-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1324" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id={`parede-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#111c2e" />
          <stop offset="1" stopColor="#0a1220" />
        </linearGradient>
        <radialGradient id={`luz-${id}`}>
          <stop offset="0" stopColor="#E2E8F0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#E2E8F0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`brilho-${id}`}>
          <stop offset="0" stopColor={led} stopOpacity="0.75" />
          <stop offset="1" stopColor={led} stopOpacity="0" />
        </radialGradient>
        <filter id={`calor-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="4">
            {reduzido ? null : (
              <animate
                attributeName="baseFrequency"
                dur="5s"
                values="0.012 0.06;0.016 0.09;0.012 0.06"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale={reduzido ? 0 : 14} />
        </filter>
      </defs>

      {/* Fundo, teto, piso e paredes */}
      <rect x="0" y="0" width="1600" height="900" fill="#020617" />
      <rect x="640" y="300" width="320" height="170" fill="#0f172a" />
      <polygon points="0,0 1600,0 960,300 640,300" fill="#0a1120" />
      <polygon points="0,900 1600,900 960,470 640,470" fill={`url(#piso-${id})`} />
      <polygon points="0,0 640,300 640,470 0,900" fill={`url(#parede-${id})`} />
      <polygon points="1600,0 960,300 960,470 1600,900" fill="#0c1526" />
      {/* Faixa de rodapé esmeralda (a marca no hospital) */}
      <polygon points="0,860 640,462 640,470 0,900" fill="#065F46" opacity="0.55" />
      <polygon points="1600,860 960,462 960,470 1600,900" fill="#065F46" opacity="0.55" />

      {/* Luminárias do teto: acendem piscando */}
      {[
        [560, 40, 480, 26],
        [650, 150, 300, 16],
        [710, 225, 180, 10]
      ].map(([x, y, w, h], i) => (
        <g
          key={i}
          className={reduzido ? undefined : "palco-luminaria"}
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          <rect x={x} y={y} width={w} height={h} rx="4" fill="#E2E8F0" opacity="0.85" />
          <ellipse
            cx={(x ?? 0) + (w ?? 0) / 2}
            cy={(y ?? 0) + 120 - i * 30}
            rx={(w ?? 0) * 0.7}
            ry={140 - i * 40}
            fill={`url(#luz-${id})`}
          />
        </g>
      ))}

      {/* Porta da UTI, à esquerda */}
      <g>
        <polygon
          points="250,318 480,366 480,584 250,712"
          fill="#0f2a24"
          stroke="#065F46"
          strokeWidth="4"
        />
        <polygon points="300,360 430,388 430,470 300,470" fill="#0b3b33" opacity="0.9" />
        <polygon
          points="300,360 430,388 430,470 300,470"
          fill={estado.icu === "ok" ? "#34D399" : "#94a3b8"}
          opacity={estado.icu === "ok" ? 0.35 : 0.12}
        />
        <rect x="318" y="266" width="96" height="40" rx="6" fill="#065F46" transform="skewY(12)" />
        <text
          x="366"
          y="292"
          textAnchor="middle"
          fill="#ECFDF5"
          fontSize="26"
          fontWeight="700"
          transform="skewY(12)"
        >
          UTI
        </text>
        {estado.icu === "alert" ? (
          <g>
            <circle cx="366" cy="236" r="16" fill="#F87171" />
            <g
              className={reduzido ? undefined : "palco-giroflex"}
              style={{ transformOrigin: "366px 236px" }}
            >
              <path d="M366 236 L620 150 L620 330 Z" fill="#F87171" opacity="0.18" />
            </g>
          </g>
        ) : null}
        {estado.icu === "ok" ? (
          <circle cx="366" cy="236" r="12" fill="#34D399" opacity="0.9" />
        ) : null}
      </g>

      {/* Quadro elétrico, à direita */}
      <g>
        <ellipse
          cx="1215"
          cy="440"
          rx="230"
          ry="260"
          fill={`url(#brilho-${id})`}
          opacity={arco ? 0.9 : seguro ? 0.45 : 0.6}
        />
        <g filter={quente ? `url(#calor-${id})` : undefined}>
          <polygon
            points="1130,300 1300,270 1300,620 1130,560"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="4"
          />
          {/* Fileiras de disjuntores */}
          {[0, 1, 2, 3].map((linha) =>
            [0, 1, 2, 3].map((coluna) => (
              <rect
                key={`${linha}-${coluna}`}
                x={1148 + coluna * 32}
                y={330 + linha * 52 - coluna * 5}
                width="20"
                height="34"
                rx="3"
                fill="#334155"
              />
            ))
          )}
          {/* Disjuntor geral (alavanca) */}
          <rect
            x="1232"
            y="448"
            width="40"
            height="70"
            rx="6"
            fill="#0f172a"
            stroke="#64748B"
            strokeWidth="3"
          />
          <rect
            x="1240"
            y={estado.lock === "1" || seguro ? 486 : 456}
            width="24"
            height="24"
            rx="4"
            fill="#E2E8F0"
          />
          {/* LED de estado */}
          <circle
            cx="1270"
            cy="300"
            r="11"
            fill={led}
            className={reduzido ? undefined : "palco-led"}
          />
        </g>
        {estado.lock === "1" ? (
          <g aria-hidden="true">
            <path
              d="M1236 520 v-14 a16 16 0 0 1 32 0 v14"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="5"
            />
            <rect x="1228" y="518" width="48" height="38" rx="6" fill="#34D399" />
            <path d="M1276 540 l44 18 v40 l-44 -14 Z" fill="#F87171" />
            <text
              x="1298"
              y="575"
              fill="#020617"
              fontSize="13"
              fontWeight="700"
              textAnchor="middle"
            >
              NÃO
            </text>
          </g>
        ) : null}
        {arco ? (
          <g>
            <polygon
              points="1252,470 1330,410 1282,470 1380,480 1280,494 1340,560 1256,500 1200,580 1232,494 1140,500 1228,470 1170,400"
              fill="#F8FAFC"
            />
            <circle cx="1252" cy="482" r="40" fill="#DBEAFE" opacity="0.8" />
          </g>
        ) : null}
      </g>

      {/* Técnico */}
      <g transform="translate(1000 430)">
        {estado.tech === "ferido" ? (
          <circle cx="40" cy="130" r="150" fill="#F87171" opacity="0.22" />
        ) : null}
        {estado.tech === "protegido" ? (
          <circle cx="40" cy="130" r="150" fill="#34D399" opacity="0.2" />
        ) : null}
        <circle cx="40" cy="20" r="34" fill="#CBD5E1" />
        <path
          d="M-10 70 Q40 50 90 70 L100 250 L-20 250 Z"
          fill={estado.epi === "1" ? "#1D4ED8" : "#475569"}
        />
        {estado.epi === "1" ? (
          <>
            <rect
              x="2"
              y="-6"
              width="76"
              height="50"
              rx="12"
              fill="#6EE7B7"
              opacity="0.45"
              stroke="#34D399"
              strokeWidth="3"
            />
            <rect x="-14" y="150" width="112" height="12" fill="#FBBF24" opacity="0.9" />
            <rect x="96" y="150" width="26" height="40" rx="8" fill="#0f172a" />
          </>
        ) : null}
        <rect x="-12" y="250" width="40" height="140" fill="#334155" />
        <rect x="52" y="250" width="40" height="140" fill="#334155" />
      </g>
    </g>
  );
}

/** Mundo genérico: fundo escuro com grade sutil. Serve a qualquer pacote desconhecido. */
export function MundoGenerico() {
  const id = useId().replace(/:/g, "");
  return (
    <g>
      <defs>
        <radialGradient id={`fundo-${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#0f2a24" />
          <stop offset="1" stopColor="#020617" />
        </radialGradient>
        <pattern id={`grade-${id}`} width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M80 0 H0 V80" fill="none" stroke="#1e293b" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill={`url(#fundo-${id})`} />
      <rect width="1600" height="900" fill={`url(#grade-${id})`} opacity="0.6" />
    </g>
  );
}

/** O mundo de cada pacote (o genérico para os desconhecidos). */
export function MundoDoPacote({ pacote, estado, reduzido }: PropsDoMundo & { pacote: string }) {
  if (pacote === "hospital-energia")
    return <MundoHospitalEnergia estado={estado} reduzido={reduzido} />;
  return <MundoGenerico />;
}
