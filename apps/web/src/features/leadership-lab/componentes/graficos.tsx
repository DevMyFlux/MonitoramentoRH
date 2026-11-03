// Leadership Lab — os dois gráficos do painel (Recharts). Carregado sob demanda: o restante do
// sistema não paga o peso da biblioteca de gráficos.
import type { LabPontoDaEvolucao, LabSkillDoPainel } from "@my-flux/shared";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const VERDE = "#047857";
const AZUL = "#1d4ed8";

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
    <text x={x} y={y} textAnchor={textAnchor} fontSize={11} fill="#475569">
      {linhas.map((linha, i) => (
        <tspan key={linha} x={x} dy={i === 0 ? 0 : 13}>
          {linha}
        </tspan>
      ))}
    </text>
  );
}

export function RadarDeSkills({ skills }: { skills: readonly LabSkillDoPainel[] }) {
  return (
    <div
      role="img"
      aria-label={`Radar de skills. ${descricaoDoRadar(skills)}`}
      className="h-80 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={dadosDoRadar(skills)} outerRadius="58%">
          <PolarGrid />
          <PolarAngleAxis
            dataKey="skill"
            tick={(props: PropsDoRotulo) => <RotuloDoEixo {...props} />}
          />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
          <Radar dataKey="nivel" name="Nível" stroke={VERDE} fill="#10b981" fillOpacity={0.35} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoDeEvolucao({ pontos }: { pontos: readonly LabPontoDaEvolucao[] }) {
  return (
    <div
      role="img"
      aria-label={`Evolução da aderência e da agilidade. ${descricaoDaEvolucao(pontos)}`}
      className="h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={dadosDaEvolucao(pontos)}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="aderencia"
            name="Aderência"
            stroke={VERDE}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="agilidade"
            name="Agilidade"
            stroke={AZUL}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
