// O mundo do pacote de cena "escritorio-gestao" (viewBox 1600×900): um escritório de gestão com a
// tela do sistema, a ficha de papel, o relógio e o calendário, a sala de reunião e a mesa de trabalho.
// Desenho próprio em SVG (sem bibliotecas), no mesmo estilo dos outros pacotes: perspectiva simples,
// vidro escuro, esmeralda da marca. A câmera, as partículas, a vinheta e o HUD ficam no Palco.
//
// Cada objeto da cena é comandado pelo estado do seu plano (mesa, tela, reuniao, documento, relogio):
//   "ok"     realce esmeralda e marca de confirmação;
//   "alerta" âmbar e pulso;
//   "falha"  vermelho e vibração curta.
// Âmbar e vermelho vêm SEMPRE com um símbolo (!, ?, ×), nunca só a cor. Com movimento reduzido nada
// pulsa nem vibra: o estado aparece parado.
import { useId } from "react";
import type { EstadoDaCena } from "../fluxo";

type Props = { estado: EstadoDaCena; reduzido: boolean };

const COR: Record<string, string> = { ok: "#34D399", alerta: "#FBBF24", falha: "#F87171" };
const NEUTRO = "#64748B";
const corDe = (valor: string | undefined) => (valor ? (COR[valor] ?? NEUTRO) : NEUTRO);

/** A classe de animação do estado (nenhuma com movimento reduzido). */
const animacaoDe = (valor: string | undefined, reduzido: boolean) =>
  reduzido
    ? undefined
    : valor === "alerta"
      ? "palco-pulso"
      : valor === "falha"
        ? "palco-vibra"
        : undefined;

/** O símbolo do estado (acompanha a cor). `cx`,`cy`: o centro; `r`: o raio do selo. */
function Selo({
  valor,
  cx,
  cy,
  r
}: {
  valor: string | undefined;
  cx: number;
  cy: number;
  r: number;
}) {
  if (valor !== "ok" && valor !== "alerta" && valor !== "falha") return null;
  const cor = COR[valor]!;
  const k = r / 22;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k})`}>
      <circle r="22" fill={cor} />
      {valor === "ok" ? (
        <path
          d="M-10 1 l7 8 l14 -16"
          fill="none"
          stroke="#020617"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : valor === "alerta" ? (
        <>
          <rect x="-2.5" y="-13" width="5" height="16" rx="2.5" fill="#020617" />
          <circle cx="0" cy="10" r="3" fill="#020617" />
        </>
      ) : (
        <path
          d="M-9 -9 l18 18 M9 -9 l-18 18"
          stroke="#020617"
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

/** A tela do sistema: uma planilha com a linha do problema destacada. */
function Tela({ valor, reduzido }: { valor: string | undefined; reduzido: boolean }) {
  const cor = corDe(valor);
  const linhas = [0, 1, 2, 3, 4];
  return (
    <g className={animacaoDe(valor, reduzido)} style={{ transformOrigin: "550px 290px" }}>
      <rect x="520" y="468" width="60" height="44" fill="#1e293b" />
      <rect x="450" y="506" width="200" height="14" rx="7" fill="#1e293b" />
      <rect
        x="230"
        y="110"
        width="640"
        height="360"
        rx="18"
        fill="#0f172a"
        stroke={cor}
        strokeWidth="6"
      />
      <rect x="250" y="130" width="600" height="46" rx="8" fill="#1e293b" />
      <text x="272" y="162" fill="#E2E8F0" fontSize="26" fontWeight="700">
        Sistema · Controle
      </text>
      {linhas.map((i) => (
        <g key={i}>
          {[0, 1, 2, 3].map((j) => {
            const destaque = i === 2 && (j === 1 || j === 2);
            return (
              <rect
                key={j}
                x={254 + j * 150}
                y={196 + i * 50}
                width="140"
                height="38"
                rx="6"
                fill={destaque ? cor : "#1e293b"}
                opacity={destaque ? 0.85 : 1}
              />
            );
          })}
        </g>
      ))}
      <Selo valor={valor} cx={810} cy={430} r={26} />
    </g>
  );
}

/** A ficha de papel presa no quadro: título, linhas de texto e o carimbo do estado. */
function Documento({ valor, reduzido }: { valor: string | undefined; reduzido: boolean }) {
  const cor = corDe(valor);
  const inclinacao = valor === "falha" ? -4 : valor === "alerta" ? 2 : 0;
  return (
    <g className={animacaoDe(valor, reduzido)} style={{ transformOrigin: "1060px 290px" }}>
      <rect
        x="930"
        y="100"
        width="260"
        height="380"
        rx="14"
        fill="#1e293b"
        stroke="#334155"
        strokeWidth="3"
      />
      <g transform={`rotate(${inclinacao} 1060 290)`}>
        <rect x="958" y="136" width="204" height="300" rx="6" fill="#F1F5F9" />
        <rect x="958" y="136" width="204" height="40" rx="6" fill={cor} opacity="0.9" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect
            key={i}
            x="976"
            y={196 + i * 24}
            width={i % 3 === 2 ? 110 : 168}
            height="9"
            rx="4"
            fill="#94A3B8"
          />
        ))}
        <circle cx="1060" cy="124" r="9" fill="#F87171" stroke="#7F1D1D" strokeWidth="2" />
        <Selo valor={valor} cx={1118} cy={392} r={24} />
      </g>
    </g>
  );
}

/** O relógio de parede e o calendário: a passagem do tempo. */
function Relogio({ valor, reduzido }: { valor: string | undefined; reduzido: boolean }) {
  const cor = corDe(valor);
  return (
    <g className={animacaoDe(valor, reduzido)} style={{ transformOrigin: "1380px 260px" }}>
      <circle cx="1380" cy="190" r="92" fill="#0f172a" stroke={cor} strokeWidth="7" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x="1377"
          y="108"
          width="6"
          height={i % 3 === 0 ? 16 : 9}
          rx="3"
          fill="#CBD5E1"
          transform={`rotate(${i * 30} 1380 190)`}
        />
      ))}
      <line
        x1="1380"
        y1="190"
        x2="1380"
        y2="132"
        stroke="#E2E8F0"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <line
        x1="1380"
        y1="190"
        x2="1424"
        y2="206"
        stroke="#E2E8F0"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g
        className={reduzido ? undefined : "palco-ponteiro"}
        style={{ transformOrigin: "1380px 190px" }}
      >
        <line
          x1="1380"
          y1="206"
          x2="1380"
          y2="116"
          stroke={cor}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <circle cx="1380" cy="190" r="8" fill={cor} />

      <rect x="1296" y="318" width="168" height="136" rx="12" fill="#E2E8F0" />
      <rect x="1296" y="318" width="168" height="34" rx="12" fill={cor} opacity="0.9" />
      {[0, 1, 2].map((i) =>
        [0, 1, 2, 3, 4].map((j) => (
          <circle key={`${i}-${j}`} cx={1318 + j * 32} cy={376 + i * 28} r="6" fill="#94A3B8" />
        ))
      )}
      <circle cx={1318 + 3 * 32} cy={376 + 28} r="13" fill="none" stroke={cor} strokeWidth="5" />
      <Selo valor={valor} cx={1440} cy={338} r={14} />
    </g>
  );
}

/** A sala de reunião: a mesa, três pessoas em silhueta e o balão do estado. */
function Reuniao({ valor, reduzido }: { valor: string | undefined; reduzido: boolean }) {
  const cor = corDe(valor);
  const pessoa = (x: number, i: number) => (
    <g key={i}>
      <circle
        cx={x}
        cy={612}
        r="32"
        fill="#334155"
        stroke={valor ? cor : "#475569"}
        strokeWidth="4"
      />
      <path
        d={`M${x - 70} 700 Q${x - 70} 650 ${x} 650 Q${x + 70} 650 ${x + 70} 700 Z`}
        fill="#334155"
        stroke={valor ? cor : "#475569"}
        strokeWidth="4"
      />
    </g>
  );
  return (
    <g className={animacaoDe(valor, reduzido)} style={{ transformOrigin: "1240px 620px" }}>
      {[1110, 1240, 1370].map(pessoa)}
      <ellipse
        cx="1240"
        cy="716"
        rx="210"
        ry="50"
        fill="#1e293b"
        stroke="#334155"
        strokeWidth="4"
      />
      <rect x="1060" y="720" width="360" height="26" rx="8" fill="#0f172a" />
      {valor ? (
        <g>
          <rect
            x="1180"
            y="484"
            width="120"
            height="70"
            rx="16"
            fill="#0f172a"
            stroke={cor}
            strokeWidth="5"
          />
          <path
            d="M1226 554 l14 22 l14 -22 z"
            fill="#0f172a"
            stroke={cor}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <Selo valor={valor} cx={1240} cy={519} r={22} />
        </g>
      ) : null}
    </g>
  );
}

/** A mesa de trabalho: monitor (de costas), telefone com luz, papéis e luminária. */
function Mesa({ valor, reduzido }: { valor: string | undefined; reduzido: boolean }) {
  const cor = corDe(valor);
  const bagunca = valor === "falha";
  return (
    <g className={animacaoDe(valor, reduzido)} style={{ transformOrigin: "570px 700px" }}>
      <rect
        x="120"
        y="712"
        width="900"
        height="44"
        rx="8"
        fill="#1e293b"
        stroke="#334155"
        strokeWidth="3"
      />
      <rect x="150" y="756" width="26" height="130" fill="#0f172a" />
      <rect x="964" y="756" width="26" height="130" fill="#0f172a" />
      {/* monitor de costas */}
      <rect
        x="420"
        y="560"
        width="240"
        height="140"
        rx="10"
        fill="#0f172a"
        stroke="#334155"
        strokeWidth="4"
      />
      <rect x="526" y="700" width="28" height="14" fill="#334155" />
      <circle cx="540" cy="630" r="8" fill={cor} />
      {/* telefone */}
      <rect
        x="760"
        y="672"
        width="130"
        height="36"
        rx="12"
        fill="#0f172a"
        stroke="#334155"
        strokeWidth="3"
      />
      <rect x="772" y="660" width="106" height="16" rx="8" fill="#334155" />
      <circle
        cx="870"
        cy="690"
        r="7"
        fill={cor}
        className={reduzido || !valor ? undefined : "palco-led"}
      />
      {/* papéis: arrumados, ou espalhados quando falha */}
      <g transform={bagunca ? "rotate(-8 270 690)" : undefined}>
        <rect x="190" y="660" width="150" height="50" rx="4" fill="#F1F5F9" />
      </g>
      <g transform={bagunca ? "rotate(7 290 686)" : undefined}>
        <rect x="200" y="652" width="150" height="50" rx="4" fill="#CBD5E1" />
      </g>
      <rect
        x={bagunca ? 330 : 205}
        y={bagunca ? 700 : 646}
        width="150"
        height="50"
        rx="4"
        fill="#E2E8F0"
        opacity="0.95"
      />
      {/* luminária */}
      <path
        d="M940 712 L940 600 L880 560"
        fill="none"
        stroke="#475569"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="M850 548 l60 -20 l22 44 l-82 10 z" fill="#334155" />
      {valor === "ok" ? (
        <ellipse cx="860" cy="650" rx="120" ry="90" fill={cor} opacity="0.18" />
      ) : null}
      <g transform="translate(980 650)">
        <Selo valor={valor} cx={0} cy={0} r={22} />
      </g>
    </g>
  );
}

/** O escritório inteiro. */
export function MundoEscritorioGestao({ estado, reduzido }: Props) {
  const id = useId().replace(/:/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`parede-g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1324" />
          <stop offset="1" stopColor="#111c2e" />
        </linearGradient>
        <radialGradient id={`luz-g-${id}`} cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#E2E8F0" stopOpacity="0.22" />
          <stop offset="1" stopColor="#E2E8F0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#parede-g-${id})`} />
      <polygon points="0,700 1600,700 1600,900 0,900" fill="#0a1120" />
      <rect x="0" y="690" width="1600" height="10" fill="#065F46" opacity="0.6" />
      <rect
        x="540"
        y="0"
        width="520"
        height="18"
        rx="4"
        fill="#E2E8F0"
        opacity="0.7"
        className={reduzido ? undefined : "palco-luminaria"}
      />
      <polygon points="540,18 1060,18 1300,520 300,520" fill={`url(#luz-g-${id})`} />

      <Tela valor={estado.tela} reduzido={reduzido} />
      <Documento valor={estado.documento} reduzido={reduzido} />
      <Relogio valor={estado.relogio} reduzido={reduzido} />
      <Reuniao valor={estado.reuniao} reduzido={reduzido} />
      <Mesa valor={estado.mesa} reduzido={reduzido} />
    </g>
  );
}
