import type { ReactNode } from "react";

type CabecalhoDePaginaProps = {
  /** A linha pequena acima do título: onde o usuário está. */
  eyebrow?: string;
  titulo: string;
  descricao?: string;
  /** Algo à direita do título (um botão, um selo). */
  acao?: ReactNode;
  children?: ReactNode;
};

/** O topo de toda tela do Lab: eyebrow, título grande, descrição e, se houver, uma ação. */
export function CabecalhoDePagina({
  eyebrow,
  titulo,
  descricao,
  acao,
  children
}: CabecalhoDePaginaProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="texto-brilho text-lab-legenda font-semibold uppercase tracking-[0.14em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="texto-gradiente mt-1.5 text-lab-h1">{titulo}</h1>
        {descricao ? (
          <p className="mt-2 max-w-2xl text-lab-corpo text-lab-tinta-2">{descricao}</p>
        ) : null}
        {children}
      </div>
      {acao}
    </header>
  );
}
