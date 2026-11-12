import type { LabPendencias } from "@my-flux/shared";
import { NavLink } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { CabecalhoDePagina, Revelar } from "../ui";
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
    <div className="space-y-8">
      <CabecalhoDePagina
        eyebrow="MY FLUX · Desenvolvimento"
        titulo="Acompanhamento do Leadership Lab"
        descricao="Valide os resultados, acompanhe os alertas, responda às contestações e cadastre quem faz os testes e as turmas que você acompanha."
      />
      <nav
        aria-label="Áreas do acompanhamento"
        className="rolagem-fina -mx-1 flex gap-1 overflow-x-auto border-b border-lab-linha px-1"
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
                  "relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-lab-pequeno font-medium transition-colors duration-lab-rapida",
                  isActive
                    ? "border-lab-destaque text-lab-tinta"
                    : "border-transparent text-lab-tinta-2 hover:text-lab-tinta"
                )
              }
            >
              {aba.rotulo}
              {quantidade ? (
                <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lab-aviso-suave px-1.5 text-lab-legenda font-semibold text-lab-aviso-texto ring-1 ring-inset ring-lab-aviso/20">
                  {quantidade}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
      {/* Entre as abas só o conteúdo anima: o cabeçalho e as abas ficam parados. */}
      <Revelar className="space-y-8">{children}</Revelar>
    </div>
  );
}
