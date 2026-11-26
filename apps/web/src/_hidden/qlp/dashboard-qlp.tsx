/* eslint-disable react-refresh/only-export-components */
// Peças do painel inicial que dependem do QLP (módulo OCULTO): indicadores de posições e vagas, o
// painel de cobertura, o excedente no quadro e os passos "Planejamento" e "Recrutamento". Saíram do
// painel ativo (que não pode falar de QLP enquanto ele estiver oculto) e voltam sozinhas quando o
// módulo é religado em packages/shared/src/modules.ts (o painel só as usa com o QLP ativo).
import { ArrowRight, ClipboardList, Gauge, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CartaoSpotlight, Contador } from "../../components/ui";

export type ResumoDoQlp = {
  qlp: number;
  occupied: number;
  vacancies: number;
  surplus: number;
  coveragePercent: number;
};

export const passosDoQlp = [
  { title: "Planejamento", text: "Dimensione funções e posições.", href: "/qlp", icon: Gauge },
  {
    title: "Recrutamento",
    text: "Acompanhe cada contratação.",
    href: "/recrutamento",
    icon: Users
  }
];

/** Os indicadores de posições e vagas, na ordem em que entram na grade do painel. */
export function indicadoresDoQlp(data: ResumoDoQlp) {
  return [
    {
      icon: Gauge,
      label: "Posições previstas",
      value: data.qlp,
      hint: "Planejamento aprovado",
      href: "/qlp",
      tone: "bg-mf-realce-suave text-mf-primaria"
    },
    {
      icon: Users,
      label: "Posições ocupadas",
      value: data.occupied,
      hint: "Pessoas vinculadas",
      href: "/colaboradores",
      tone: "bg-mf-azul-suave text-mf-azul"
    },
    {
      icon: ClipboardList,
      label: "Vagas em aberto",
      value: data.vacancies,
      hint: "Oportunidades para preencher",
      href: "/recrutamento",
      tone: "bg-mf-alerta-suave text-mf-alerta"
    }
  ];
}

export function itemDeRadarDoQlp(data: ResumoDoQlp) {
  return {
    label: "Excedentes no quadro",
    value: data.surplus,
    href: "/qlp",
    text: "Compare a ocupação com a necessidade."
  };
}

const inteiro = (n: number) => String(Math.round(n));

export function PainelDeCobertura({ data }: { data: ResumoDoQlp }) {
  const percent = Math.max(0, Math.min(100, data.coveragePercent));
  return (
    <CartaoSpotlight className="p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-mf-tinta">Cobertura da operação</h2>
          <p className="mt-1 text-xs text-mf-texto-2">Ocupação em relação ao quadro previsto.</p>
        </div>
        <Gauge size={18} aria-hidden="true" className="text-mf-texto-3" />
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-7">
        <div
          role="img"
          aria-label={`Cobertura: ${data.coveragePercent}%`}
          className="grid h-36 w-36 shrink-0 place-items-center rounded-full"
          style={
            {
              background: `conic-gradient(rgb(var(--mf-brilho)) ${percent}%, rgb(var(--mf-realce-suave)) 0)`
            } as CSSProperties
          }
        >
          <div className="grid h-[120px] w-[120px] place-content-center rounded-full bg-white text-center">
            <strong className="font-display text-3xl font-bold tracking-tight text-mf-tinta">
              <Contador
                valor={data.coveragePercent}
                formatar={(n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              />
              %
            </strong>
            <span className="mt-1 text-[11px] text-mf-texto-2">de cobertura</span>
          </div>
        </div>
        <div className="min-w-[160px] flex-1 space-y-4">
          <p className="flex items-center justify-between text-sm">
            <span className="text-mf-texto-2">Ocupadas</span>
            <strong className="text-mf-primaria">{inteiro(data.occupied)}</strong>
          </p>
          <p className="flex items-center justify-between text-sm">
            <span className="text-mf-texto-2">Em aberto</span>
            <strong className="text-mf-alerta">{inteiro(data.vacancies)}</strong>
          </p>
          <Link
            to="/qlp"
            className="flex min-h-11 items-center justify-between border-t border-mf-linha pt-4 text-xs font-medium text-mf-primaria"
          >
            Consultar QLP <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </CartaoSpotlight>
  );
}
