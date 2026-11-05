import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

type CartaoProps = {
  /** Âncora para os atalhos do painel. */
  id?: string;
  titulo?: string;
  descricao?: string;
  /** Algo à direita do título (um botão, um selo). */
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Um bloco do painel: título, descrição opcional e o conteúdo. */
export function Cartao({ id, titulo, descricao, acao, className, children }: CartaoProps) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
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

type EstatisticaProps = {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** Âncora (#seção): o cartão vira um atalho para o bloco que detalha o número. */
  href?: string;
};

/** Um cartão de número: rótulo, valor grande e uma linha de detalhe. Com `href`, é um atalho. */
export function Estatistica({ rotulo, valor, detalhe, href }: EstatisticaProps) {
  const corpo = (
    <>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-emerald-600/80" />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-slate-500">{detalhe}</p> : null}
    </>
  );
  const base =
    "relative block overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pt-5 shadow-sm";
  return href ? (
    <a
      href={href}
      className={cn(
        base,
        "transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
    >
      {corpo}
    </a>
  ) : (
    <div className={base}>{corpo}</div>
  );
}
