import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

type CartaoProps = {
  titulo?: string;
  descricao?: string;
  /** Algo à direita do título (um botão, um selo). */
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Um bloco do painel: título, descrição opcional e o conteúdo. */
export function Cartao({ titulo, descricao, acao, className, children }: CartaoProps) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {titulo || acao ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo ? <h2 className="text-base font-semibold text-slate-950">{titulo}</h2> : null}
            {descricao ? <p className="mt-1 text-sm text-slate-500">{descricao}</p> : null}
          </div>
          {acao}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type EstatisticaProps = { rotulo: string; valor: ReactNode; detalhe?: ReactNode };

/** Um cartão de número: rótulo, valor grande e uma linha de detalhe. */
export function Estatistica({ rotulo, valor, detalhe }: EstatisticaProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-slate-500">{detalhe}</p> : null}
    </div>
  );
}
