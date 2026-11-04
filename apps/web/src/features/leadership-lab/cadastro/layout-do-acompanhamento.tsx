import type { LabPendencias } from "@my-flux/shared";
import { NavLink } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { usePendencias } from "../curadoria-hooks";

type Aba = { para: string; rotulo: string; pendencias?: keyof LabPendencias };

/** Primeiro o que pede decisão do curador; depois o cadastro de quem participa. */
const abas: readonly Aba[] = [
  { para: "/lab/rh/revisao", rotulo: "Revisão", pendencias: "resultadosAguardando" },
  { para: "/lab/rh/alertas", rotulo: "Alertas", pendencias: "alertasAbertos" },
  { para: "/lab/rh/contestacoes", rotulo: "Contestações", pendencias: "contestacoesPendentes" },
  { para: "/lab/rh/contribuicoes", rotulo: "Contribuições", pendencias: "contribuicoesPendentes" },
  { para: "/lab/rh/participantes", rotulo: "Participantes" },
  { para: "/lab/rh/turmas", rotulo: "Turmas" }
];

/**
 * O cabeçalho das telas do RH: o que é esta área e as abas. As abas de decisão mostram quanto
 * espera o curador; se os números não chegarem, ficam sem eles (nada depende deles).
 */
export function LayoutDoAcompanhamento({ children }: { children: React.ReactNode }) {
  const pendencias = usePendencias().data;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-800">
          MY FLUX · Desenvolvimento
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Acompanhamento do Leadership Lab
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Valide os resultados, acompanhe os alertas, responda às contestações e cadastre quem faz
          os testes e as turmas que você acompanha.
        </p>
      </div>
      <nav
        aria-label="Áreas do acompanhamento"
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {abas.map((aba) => {
          const quantidade = aba.pendencias ? pendencias?.[aba.pendencias] : undefined;
          return (
            <NavLink
              key={aba.para}
              to={aba.para}
              {...(quantidade
                ? {
                    "aria-label": `${aba.rotulo} (${quantidade} ${quantidade === 1 ? "pendente" : "pendentes"})`
                  }
                : {})}
              className={({ isActive }) =>
                cn(
                  "-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition",
                  isActive
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                )
              }
            >
              {aba.rotulo}
              {quantidade ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">
                  {quantidade}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
