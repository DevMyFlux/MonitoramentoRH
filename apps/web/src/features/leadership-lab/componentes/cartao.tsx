import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { AnelDeProgresso, type TomDeProgresso, Revelar } from "../ui";

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

/**
 * Um bloco da tela: superfície branca com borda fina, título, descrição opcional e o conteúdo.
 * Entra com a animação padrão (escalonada, se estiver dentro de um `Escalonar`).
 */
export function Cartao({ id, titulo, descricao, acao, className, children }: CartaoProps) {
  return (
    <Revelar
      as="section"
      {...(id ? { id } : {})}
      className={cn(
        "scroll-mt-24 rounded-lab-lg border border-lab-linha bg-lab-superficie p-6 shadow-lab-1 sm:p-7",
        className
      )}
    >
      {titulo || acao ? (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo ? <h2 className="text-lab-h2 text-lab-tinta">{titulo}</h2> : null}
            {descricao ? (
              <p className="mt-1.5 max-w-2xl text-lab-pequeno leading-5 text-lab-tinta-2">
                {descricao}
              </p>
            ) : null}
          </div>
          {acao}
        </header>
      ) : null}
      {children}
    </Revelar>
  );
}

type EstatisticaProps = {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** Âncora (#seção): o cartão vira um atalho para o bloco que detalha o número. */
  href?: string;
  /** Um anel de progresso (0 a 100) ao lado do número, para indicadores em porcentagem. */
  anel?: { valor: number; tom?: TomDeProgresso };
};

/** Um cartão de número: rótulo, valor grande e uma linha de detalhe. Com `href`, é um atalho. */
export function Estatistica({ rotulo, valor, detalhe, href, anel }: EstatisticaProps) {
  const corpo = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-lab-pequeno font-medium text-lab-tinta-2">{rotulo}</p>
        <p className="tabular mt-3 text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-lab-tinta">
          {valor}
        </p>
        {detalhe ? (
          <p className="mt-3 text-lab-legenda leading-4 text-lab-tinta-2">{detalhe}</p>
        ) : null}
      </div>
      {anel ? (
        <AnelDeProgresso
          valor={anel.valor}
          tamanho={52}
          espessura={6}
          tom={anel.tom ?? "destaque"}
        />
      ) : null}
    </div>
  );
  const base = "block rounded-lab-lg border border-lab-linha bg-lab-superficie p-5 shadow-lab-1";
  return href ? (
    <Revelar className="h-full">
      <a
        href={href}
        className={cn(
          base,
          "h-full",
          "transition duration-lab ease-lab hover:-translate-y-0.5 hover:border-lab-linha-forte hover:shadow-lab-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        )}
      >
        {corpo}
      </a>
    </Revelar>
  ) : (
    <Revelar className={base}>{corpo}</Revelar>
  );
}
