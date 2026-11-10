// Leadership Lab — os dois gráficos do painel (Recharts). Carregado sob demanda: o restante do
// sistema não paga o peso da biblioteca de gráficos. Visual: grade quase invisível, linhas finas,
// área com degradê suave e um tooltip no mesmo vocabulário dos cartões.
import type { LabPontoDaEvolucao, LabSkillDoPainel } from "@my-flux/shared";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  dadosDaEvolucao,
  dadosDoRadar,
  descricaoDaEvolucao,
  descricaoDoRadar,
  quebrarEmLinhas
} from "../dados-dos-graficos";
import { cores } from "../ui/cores";
import { useAnimacaoReduzida } from "../ui/movimento";

type PropsDoRotulo = {
  x?: number | string;
  y?: number | string;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  payload?: { value?: string | number };
};

/** O nome da skill no eixo do radar, em até duas ou três linhas curtas. */
function RotuloDoEixo({ x = 0, y = 0, textAnchor, payload }: PropsDoRotulo) {
  const linhas = quebrarEmLinhas(String(payload?.value ?? ""), 16);
  return (
    <text x={x} y={y} textAnchor={textAnchor} fontSize={11} fill={cores.tinta2}>
      {linhas.map((linha, i) => (
        <tspan key={linha} x={x} dy={i === 0 ? 0 : 13}>
          {linha}
        </tspan>
      ))}
    </text>
  );
}

type PayloadDoTooltip = { name?: string | number; value?: string | number; color?: string };

/** O tooltip: cartão branco com sombra, uma linha por série, com a cor da série. */
function DicaDoGrafico({
  active,
  payload,
  label,
  sufixo = ""
}: {
  active?: boolean;
  payload?: readonly PayloadDoTooltip[];
  label?: string | number;
  sufixo?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lab-md border border-lab-linha bg-lab-superficie px-3.5 py-2.5 shadow-lab-2">
      {label !== undefined ? (
        <p className="mb-1.5 text-lab-legenda font-medium text-lab-tinta">{label}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((item) => (
          <li
            key={String(item.name)}
            className="flex items-center gap-2 text-lab-legenda text-lab-tinta-2"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: item.color }}
            />
            {item.name}:{" "}
            <span className="tabular font-semibold text-lab-tinta">
              {item.value}
              {sufixo}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RadarDeSkills({ skills }: { skills: readonly LabSkillDoPainel[] }) {
  const reduzida = useAnimacaoReduzida();
  return (
    <div
      role="img"
      aria-label={`Radar de skills. ${descricaoDoRadar(skills)}`}
      className="h-80 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={dadosDoRadar(skills)}
          outerRadius="52%"
          margin={{ top: 12, right: 36, bottom: 12, left: 36 }}
        >
          <PolarGrid stroke={cores.linha} />
          <PolarAngleAxis
            dataKey="skill"
            tick={(props: PropsDoRotulo) => <RotuloDoEixo {...props} />}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tickCount={6}
            axisLine={false}
            tick={{ fontSize: 10, fill: cores.tinta2 }}
          />
          <Radar
            dataKey="nivel"
            name="Nível"
            stroke={cores.destaque}
            strokeWidth={2}
            fill={cores.destaque}
            fillOpacity={0.16}
            isAnimationActive={!reduzida}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Tooltip content={<DicaDoGrafico />} cursor={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoDeEvolucao({ pontos }: { pontos: readonly LabPontoDaEvolucao[] }) {
  const reduzida = useAnimacaoReduzida();
  return (
    <div
      role="img"
      aria-label={`Evolução da aderência e da agilidade. ${descricaoDaEvolucao(pontos)}`}
      className="h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={dadosDaEvolucao(pontos)}
          margin={{ top: 12, right: 12, bottom: 0, left: -12 }}
        >
          <defs>
            <linearGradient id="lab-degrade-aderencia" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cores.destaque} stopOpacity={0.22} />
              <stop offset="100%" stopColor={cores.destaque} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={cores.linha} />
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 11, fill: cores.tinta2 }}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fontSize: 11, fill: cores.tinta2 }}
          />
          <Tooltip
            content={<DicaDoGrafico sufixo="%" />}
            cursor={{ stroke: cores.linha, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="aderencia"
            name="Aderência"
            stroke="none"
            fill="url(#lab-degrade-aderencia)"
            legendType="none"
            tooltipType="none"
            isAnimationActive={!reduzida}
            animationDuration={900}
          />
          <Line
            type="monotone"
            dataKey="aderencia"
            name="Aderência"
            stroke={cores.destaque}
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5.5, strokeWidth: 2, fill: "#fff" }}
            isAnimationActive={!reduzida}
            animationDuration={900}
          />
          <Line
            type="monotone"
            dataKey="agilidade"
            name="Agilidade"
            stroke={cores.info}
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5.5, strokeWidth: 2, fill: "#fff" }}
            isAnimationActive={!reduzida}
            animationDuration={900}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ul className="mt-3 flex items-center justify-center gap-5 text-lab-legenda text-lab-tinta-2">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lab-destaque" />
          Aderência
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lab-info" />
          Agilidade
        </li>
      </ul>
    </div>
  );
}
