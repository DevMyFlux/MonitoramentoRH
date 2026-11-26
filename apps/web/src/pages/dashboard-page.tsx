// Painel inicial. Só apresentação: os indicadores, o endpoint e as rotas são os de sempre.
// Layout em "bento" (blocos de tamanhos diferentes numa grade), inspirado na ideia do "Magic Bento"
// do React Bits (reactbits.dev), mas feito do zero: cada bloco usa o CartaoSpotlight, os números
// contam (Contador) e o único fundo animado da tela é o fundo ambiente do shell (CSS, sem WebGL).
import { MODULOS } from "@my-flux/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FileWarning,
  RefreshCw,
  Workflow
} from "lucide-react";
import {
  Button,
  CartaoSpotlight,
  Contador,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../components/ui";
import {
  indicadoresDoQlp,
  itemDeRadarDoQlp,
  PainelDeCobertura,
  passosDoQlp
} from "../_hidden/qlp/dashboard-qlp";
import { cn } from "../lib/cn";
import { apiGet } from "../services/api-client";

type DashboardSummaryResponse = {
  data: {
    // Posições, vagas e cobertura vêm do QLP (módulo oculto): só aparecem com ele ativo.
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
const qlpAtivo = MODULOS.qlp?.status === "active";
const steps = [
  ...(qlpAtivo ? passosDoQlp : []),
  {
    title: "Colaboradores",
    text: "Cuide de pessoas e requisitos.",
    href: "/colaboradores",
    icon: ClipboardList
  },
  { title: "Escalas", text: "Organize a próxima operação.", href: "/escalas", icon: CalendarDays }
];

const inteiro = (n: number) => String(Math.round(n));

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet<DashboardSummaryResponse>("/dashboard/summary")
  });
  const data = summary.data?.data;
  return (
    <div className="space-y-7">
      <TituloDePagina
        etiqueta="Visão geral"
        titulo="Sua operação, em perspectiva."
        descricao="Acompanhe as pessoas, identifique prioridades e siga em frente."
        acoes={
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} className={summary.isFetching ? "animate-spin" : ""} />}
            disabled={summary.isFetching}
            onClick={() => void summary.refetch()}
          >
            Atualizar
          </Button>
        }
      />
      <section className="relative overflow-hidden rounded-2xl bg-mf-primaria p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full border-[44px] border-white/[.04]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-mf-realce">
              Cada etapa conta
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Planejar bem é cuidar de quem faz.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-mf-realce-suave/80">
              {qlpAtivo
                ? "Conecte as necessidades da operação às pessoas certas, do QLP à escala."
                : "Conecte as necessidades da operação às pessoas certas, do cadastro à escala."}
            </p>
          </div>
          <Link
            to={qlpAtivo ? "/qlp" : "/colaboradores"}
            className="flex min-h-11 items-center gap-3 rounded-xl bg-mf-realce px-5 py-3 text-sm font-semibold text-mf-primaria transition hover:bg-white focus-visible:outline-white"
          >
            {qlpAtivo ? "Ver planejamento" : "Ver colaboradores"} <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      {summary.isLoading && (
        <div
          role="status"
          aria-label="Carregando indicadores"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}
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
            className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
          >
            {[
              ...(qlpAtivo ? indicadoresDoQlp(data) : []),
              {
                icon: FileWarning,
                label: "Documentos críticos",
                value: data.criticalDocuments,
                hint: "Requisitos que pedem atenção",
                href: "/documentos",
                tone: "bg-mf-perigo-suave text-mf-perigo"
              }
            ].map((metric) => (
              <CartaoSpotlight key={metric.label} className="group">
                <Link
                  to={metric.href}
                  className="block h-full min-h-11 p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-mf-azul sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn("grid h-10 w-10 place-items-center rounded-xl", metric.tone)}
                    >
                      <metric.icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <ArrowUpRight
                      size={16}
                      aria-hidden="true"
                      className="text-mf-texto-3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mf-primaria motion-reduce:transition-none"
                    />
                  </div>
                  <p className="mt-5 text-xs font-medium text-mf-texto-2">{metric.label}</p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-mf-tinta">
                    <Contador valor={metric.value} formatar={inteiro} />
                  </p>
                  <p className="mt-2 text-[11px] text-mf-texto-3">{metric.hint}</p>
                </Link>
              </CartaoSpotlight>
            ))}
          </section>
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-[1.05fr_1fr]">
            {qlpAtivo ? <PainelDeCobertura data={data} /> : null}
            <CartaoSpotlight className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-mf-tinta">No seu radar</h2>
              <p className="mt-1 text-xs text-mf-texto-2">Pontos para acompanhar no dia a dia.</p>
              <div className="mt-5 divide-y divide-mf-linha">
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
                  ...(qlpAtivo ? [itemDeRadarDoQlp(data)] : [])
                ].map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="group flex min-h-14 items-center gap-3 py-3"
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-semibold",
                        item.value > 0
                          ? "bg-mf-alerta-suave text-mf-alerta"
                          : "bg-slate-50 text-mf-texto-2"
                      )}
                    >
                      {item.value}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-mf-texto">{item.label}</p>
                      <p className="mt-0.5 text-[11px] text-mf-texto-3">{item.text}</p>
                    </div>
                    <ArrowUpRight
                      size={15}
                      aria-hidden="true"
                      className="text-mf-texto-3 group-hover:text-mf-primaria"
                    />
                  </Link>
                ))}
              </div>
            </CartaoSpotlight>
          </div>
        </>
      )}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Workflow size={17} aria-hidden="true" className="text-mf-primaria" />
          <h2 className="font-display text-lg font-bold text-mf-tinta">
            O próximo passo está aqui
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <Link
              key={step.href}
              to={step.href}
              className="group min-h-11 rounded-2xl border border-mf-linha bg-mf-cartao p-4 transition hover:border-mf-brilho/50 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <step.icon size={18} aria-hidden="true" className="text-mf-primaria" />
                <span className="font-mono text-[10px] font-medium text-mf-texto-3">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-4 flex items-center justify-between text-sm font-semibold text-mf-tinta">
                {step.title}
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="text-mf-texto-3 group-hover:text-mf-primaria"
                />
              </p>
              <p className="mt-1 text-xs leading-5 text-mf-texto-2">{step.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <p className="text-xs text-mf-texto-2">
        Indicadores dos registros disponíveis para o seu perfil de acesso.
      </p>
    </div>
  );
}
