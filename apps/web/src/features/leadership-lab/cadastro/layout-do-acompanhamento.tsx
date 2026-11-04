import { NavLink } from "react-router-dom";
import { cn } from "../../../lib/cn";

const abas = [
  { para: "/lab/rh/participantes", rotulo: "Participantes" },
  { para: "/lab/rh/turmas", rotulo: "Turmas" }
] as const;

/** O cabeçalho das telas do RH: o que é esta área e as abas entre Participantes e Turmas. */
export function LayoutDoAcompanhamento({ children }: { children: React.ReactNode }) {
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
          Cadastre quem faz os testes e monte as turmas que você acompanha.
        </p>
      </div>
      <nav aria-label="Áreas do acompanhamento" className="flex gap-1 border-b border-slate-200">
        {abas.map((aba) => (
          <NavLink
            key={aba.para}
            to={aba.para}
            className={({ isActive }) =>
              cn(
                "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition",
                isActive
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )
            }
          >
            {aba.rotulo}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
