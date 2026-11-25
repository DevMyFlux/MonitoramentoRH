// Os "mundos" em SVG de cada pacote de cena (viewBox 1600×900). Desenho próprio (sem bibliotecas).
// Recebem o estado da cena (comandos já aplicados) e se o movimento está reduzido; a câmera, as
// partículas, a vinheta e o HUD ficam no Palco. Cores: tinta e esmeralda da marca; âmbar e vermelho
// só para atenção e risco, sempre acompanhados de texto no painel e na descrição da cena.
import { useId } from "react";
import type { EstadoDaCena } from "../fluxo";
import { MundoEscritorioGestao } from "./mundo-escritorio";

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

const CELULA: Record<string, { fundo: string; texto: string }> = {
  D: { fundo: "#D1FAE5", texto: "#065F46" },
  N: { fundo: "#DBEAFE", texto: "#1D4ED8" },
  F: { fundo: "#334155", texto: "#CBD5E1" }
};
const GRADE = ["DNFDNFD", "NFDNFDN", "FDNFDNF", "DNFDNFD", "NFDNFDN"];

/** Sala de gestão da escala (cenários de RH): painel, ficha, relógio e equipe. */
export function MundoHospitalEscala({ estado, reduzido }: PropsDoMundo) {
  const id = useId().replace(/:/g, "");
  const alerta = estado.painel !== "ok";
  const escalaCerta = estado.escala === "ok";
  const fichaOk = estado.ficha === "ok";
  const corDoAlerta = alerta ? "#F87171" : "#34D399";
  return (
    <g>
      <defs>
        <linearGradient id={`parede-e-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1324" />
          <stop offset="1" stopColor="#111c2e" />
        </linearGradient>
        <radialGradient id={`brilho-e-${id}`}>
          <stop offset="0" stopColor={corDoAlerta} stopOpacity="0.45" />
          <stop offset="1" stopColor={corDoAlerta} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Parede, piso e faixa da marca */}
      <rect width="1600" height="900" fill={`url(#parede-e-${id})`} />
      <polygon points="0,700 1600,700 1600,900 0,900" fill="#0a1120" />
      <rect x="0" y="690" width="1600" height="10" fill="#065F46" opacity="0.6" />
      <rect
        x="560"
        y="0"
        width="480"
        height="18"
        rx="4"
        fill="#E2E8F0"
        opacity="0.7"
        className={reduzido ? undefined : "palco-luminaria"}
      />

      {/* Painel da escala: grade D/N/F; a célula do posto mostra quem está nele */}
      <ellipse cx="560" cy="300" rx="420" ry="260" fill={`url(#brilho-e-${id})`} />
      <rect
        x="250"
        y="120"
        width="620"
        height="380"
        rx="16"
        fill="#0f172a"
        stroke={corDoAlerta}
        strokeWidth="5"
      />
      <text x="280" y="168" fill="#E2E8F0" fontSize="26" fontWeight="700">
        Escala · Plantão noturno
      </text>
      {GRADE.map((linha, i) =>
        linha.split("").map((codigo, j) => {
          const destaque = i === 1 && j === 3;
          const valor = destaque ? (escalaCerta ? "S" : "FA") : codigo;
          const cor = destaque
            ? escalaCerta
              ? { fundo: "#34D399", texto: "#020617" }
              : { fundo: "#FEF2F2", texto: "#B91C1C" }
            : (CELULA[codigo] ?? { fundo: "#334155", texto: "#CBD5E1" });
          return (
            <g key={`${i}-${j}`}>
              <rect
                x={290 + j * 80}
                y={200 + i * 56}
                width="68"
                height="44"
                rx="6"
                fill={cor.fundo}
                stroke={destaque ? "#F8FAFC" : "none"}
                strokeWidth="3"
              />
              <text
                x={324 + j * 80}
                y={230 + i * 56}
                textAnchor="middle"
                fill={cor.texto}
                fontSize="20"
                fontWeight="700"
              >
                {valor}
              </text>
            </g>
          );
        })
      )}
      {alerta ? (
        <g>
          <circle
            cx="840"
            cy="150"
            r="22"
            fill="#F87171"
            className={reduzido ? undefined : "palco-led"}
          />
          <text x="840" y="158" textAnchor="middle" fill="#020617" fontSize="26" fontWeight="800">
            !
          </text>
        </g>
      ) : (
        <circle cx="840" cy="150" r="16" fill="#34D399" />
      )}

      {/* Mesa com a ficha do colaborador */}
      <rect x="900" y="640" width="520" height="24" rx="6" fill="#1e293b" />
      <rect
        x="960"
        y="400"
        width="300"
        height="220"
        rx="12"
        fill="#0f172a"
        stroke="#475569"
        strokeWidth="4"
      />
      <rect x="1100" y="620" width="20" height="24" fill="#334155" />
      <text x="980" y="440" fill="#E2E8F0" fontSize="20" fontWeight="700">
        Ficha · Substituto
      </text>
      {["ASO", "Treinamentos", "Habilitações"].map((item, i) => {
        const ok = fichaOk || i === 0;
        return (
          <g key={item}>
            <circle cx="992" cy={478 + i * 44} r="11" fill={ok ? "#34D399" : "#FBBF24"} />
            <text x="1012" y={485 + i * 44} fill="#CBD5E1" fontSize="18">
              {item} · {ok ? "em dia" : "pendente"}
            </text>
          </g>
        );
      })}

      {/* Relógio do descanso entre jornadas */}
      <circle cx="1360" cy="250" r="90" fill="#0f172a" stroke="#475569" strokeWidth="6" />
      {estado.relogio ? (
        <path
          d={
            estado.relogio === "ok"
              ? "M1360 175 A75 75 0 1 1 1290 285"
              : "M1360 175 A75 75 0 0 1 1430 280"
          }
          fill="none"
          stroke={estado.relogio === "ok" ? "#34D399" : "#F87171"}
          strokeWidth="12"
          strokeLinecap="round"
        />
      ) : null}
      <line
        x1="1360"
        y1="250"
        x2="1360"
        y2="195"
        stroke="#E2E8F0"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="1360"
        y1="250"
        x2="1400"
        y2="265"
        stroke="#E2E8F0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <text x="1360" y="375" textAnchor="middle" fill="#CBD5E1" fontSize="18">
        Descanso entre jornadas
      </text>

      {/* Equipe do plantão */}
      {[180, 270, 360, 450].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={560 - (i % 2) * 10} r="28" fill="#CBD5E1" />
          <path
            d={`M${x - 40} 700 Q${x} ${590 - (i % 2) * 10} ${x + 40} 700 Z`}
            fill="#1D4ED8"
            opacity="0.85"
          />
        </g>
      ))}
      {estado.equipe === "duvida"
        ? [230, 410].map((x) => (
            <g key={x}>
              <circle cx={x} cy="470" r="26" fill="#FBBF24" />
              <text x={x} y="480" textAnchor="middle" fill="#020617" fontSize="28" fontWeight="800">
                ?
              </text>
            </g>
          ))
        : null}
      {estado.equipe === "ok" ? (
        <g>
          <circle cx="315" cy="460" r="28" fill="#34D399" />
          <path
            d="M302 460 l9 9 l17 -19"
            fill="none"
            stroke="#020617"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
      ) : null}
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
  if (pacote === "hospital-escala")
    return <MundoHospitalEscala estado={estado} reduzido={reduzido} />;
  if (pacote === "escritorio-gestao")
    return <MundoEscritorioGestao estado={estado} reduzido={reduzido} />;
  return <MundoGenerico />;
}
