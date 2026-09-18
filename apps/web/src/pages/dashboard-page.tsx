import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Gauge,
  RefreshCw,
  Users,
  Workflow
} from "lucide-react";
import { Button, ErrorState, LoadingState } from "../components/ui";
import { apiGet } from "../services/api-client";

type DashboardSummaryResponse = {
  data: {
    qlp: number;
    occupied: number;
    vacancies: number;
    surplus: number;
    coveragePercent: number;
    criticalDocuments: number;
    conflicts: number;
    pending: number;
  };
};
const steps = [
  { title: "Planejamento", text: "Dimensione funções e posições.", href: "/qlp", icon: Gauge },
  {
    title: "Recrutamento",
    text: "Acompanhe cada contratação.",
    href: "/recrutamento",
    icon: Users
  },
  {
    title: "Colaboradores",
    text: "Cuide de pessoas e requisitos.",
    href: "/colaboradores",
    icon: ClipboardList
  },
  { title: "Escalas", text: "Organize a próxima operação.", href: "/escalas", icon: CalendarDays }
];
export function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet<DashboardSummaryResponse>("/dashboard/summary")
  });
  const data = summary.data?.data;
  const percent = Math.max(0, Math.min(100, data?.coveragePercent ?? 0));
  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Sua operação, em perspectiva.
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Acompanhe as pessoas, identifique prioridades e siga em frente.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw size={15} className={summary.isFetching ? "animate-spin" : ""} />}
          disabled={summary.isFetching}
          onClick={() => void summary.refetch()}
        >
          Atualizar
        </Button>
      </section>
      <section className="relative overflow-hidden rounded-2xl bg-[#123f36] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full border-[44px] border-white/[.03]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-emerald-200">CADA ETAPA CONTA</p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight">
              Planejar bem é cuidar de quem faz.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-emerald-50/65">
              Conecte as necessidades da operação às pessoas certas, do QLP à escala.
            </p>
          </div>
          <Link
            to="/qlp"
            className="flex items-center gap-3 rounded-lg bg-emerald-100 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-white"
          >
            Ver planejamento <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      {summary.isLoading && <LoadingState />}
      {summary.isError && (
        <ErrorState
          title="Não foi possível atualizar os indicadores"
          description="Confira a conexão e use Atualizar para tentar novamente."
        />
      )}
      {data && (
        <>
          <section
            aria-label="Indicadores operacionais"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {[
              {
                icon: Gauge,
                label: "Posições previstas",
                value: data.qlp,
                hint: "Planejamento aprovado",
                href: "/qlp",
                tone: "bg-emerald-50 text-emerald-700"
              },
              {
                icon: Users,
                label: "Posições ocupadas",
                value: data.occupied,
                hint: "Pessoas vinculadas",
                href: "/colaboradores",
                tone: "bg-blue-50 text-blue-700"
              },
              {
                icon: ClipboardList,
                label: "Vagas em aberto",
                value: data.vacancies,
                hint: "Oportunidades para preencher",
                href: "/recrutamento",
                tone: "bg-amber-50 text-amber-700"
              },
              {
                icon: FileWarning,
                label: "Documentos críticos",
                value: data.criticalDocuments,
                hint: "Requisitos que pedem atenção",
                href: "/documentos",
                tone: "bg-rose-50 text-rose-700"
              }
            ].map((metric) => (
              <Link
                key={metric.label}
                to={metric.href}
                className="panel group p-5 transition hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${metric.tone}`}>
                    <metric.icon size={19} strokeWidth={1.8} />
                  </span>
                  <ArrowUpRight size={16} className="text-slate-300 group-hover:text-emerald-700" />
                </div>
                <p className="mt-5 text-xs font-medium text-slate-500">{metric.label}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                  {new Intl.NumberFormat("pt-BR").format(metric.value)}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">{metric.hint}</p>
              </Link>
            ))}
          </section>
          <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
            <section className="panel p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Cobertura da operação</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Ocupação em relação ao quadro previsto.
                  </p>
                </div>
                <Gauge size={18} className="text-slate-400" />
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-7">
                <div
                  role="img"
                  aria-label={`Cobertura: ${data.coveragePercent}%`}
                  className="grid h-36 w-36 shrink-0 place-items-center rounded-full"
                  style={
                    {
                      background: `conic-gradient(#168268 ${percent}%, #edf2ef 0)`
                    } as CSSProperties
                  }
                >
                  <div className="grid h-[120px] w-[120px] place-content-center rounded-full bg-white text-center">
                    <strong className="text-3xl font-semibold tracking-tight text-slate-900">
                      {data.coveragePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </strong>
                    <span className="mt-1 text-[11px] text-slate-500">de cobertura</span>
                  </div>
                </div>
                <div className="min-w-[160px] flex-1 space-y-4">
                  <p className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Ocupadas</span>
                    <strong className="text-emerald-700">{data.occupied}</strong>
                  </p>
                  <p className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Em aberto</span>
                    <strong className="text-amber-700">{data.vacancies}</strong>
                  </p>
                  <Link
                    to="/qlp"
                    className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-medium text-emerald-800"
                  >
                    Consultar QLP <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </section>
            <section className="panel p-6">
              <h2 className="text-base font-semibold text-slate-900">No seu radar</h2>
              <p className="mt-1 text-xs text-slate-500">Pontos para acompanhar no dia a dia.</p>
              <div className="mt-5 divide-y divide-slate-100">
                {[
                  {
                    label: "Pendências operacionais",
                    value: data.pending,
                    href: "/escalas",
                    text: "Revise o planejamento das escalas."
                  },
                  {
                    label: "Conflitos identificados",
                    value: data.conflicts,
                    href: "/escalas",
                    text: "Confira disponibilidade e alocações."
                  },
                  {
                    label: "Excedentes no quadro",
                    value: data.surplus,
                    href: "/qlp",
                    text: "Compare a ocupação com a necessidade."
                  }
                ].map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="group flex items-center gap-3 py-3"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-semibold ${item.value > 0 ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600"}`}
                    >
                      {item.value}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{item.label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.text}</p>
                    </div>
                    <ArrowUpRight
                      size={15}
                      className="text-slate-300 group-hover:text-emerald-700"
                    />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Workflow size={17} className="text-emerald-700" />
          <h2 className="text-base font-semibold text-slate-900">O próximo passo está aqui</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <Link
              key={step.href}
              to={step.href}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300"
            >
              <div className="flex items-center justify-between">
                <step.icon size={18} className="text-emerald-700" />
                <span className="text-[10px] font-medium text-slate-400">0{index + 1}</span>
              </div>
              <p className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-800">
                {step.title}
                <ArrowRight size={14} className="text-slate-400 group-hover:text-emerald-700" />
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{step.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <p className="text-xs text-slate-400">
        Indicadores dos registros disponíveis para o seu perfil de acesso.
      </p>
    </div>
  );
}
