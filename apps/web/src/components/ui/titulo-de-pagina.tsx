// Título de página: etiqueta com brilho sutil + h1 em degradê (tinta > esmeralda > azul). Origem:
// ideias do "Shiny Text" e do "Gradient Text" do React Bits (reactbits.dev), escritas do zero em CSS.
// Por quê: dá identidade ao topo de cada página sem enfeitar o conteúdo. Os dois degradês usam só
// cores escuras da paleta (contraste AA sobre o fundo claro) e o brilho para com prefers-reduced-motion.
import type { ReactNode } from "react";

type Props = {
  etiqueta: string;
  titulo: string;
  descricao?: string;
  /** Os botões da página, à direita (viram uma grade de 2 colunas no celular). */
  acoes?: ReactNode;
};

export function TituloDePagina({ etiqueta, titulo, descricao, acoes }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="texto-brilho text-xs font-semibold uppercase tracking-[0.14em]">{etiqueta}</p>
        <h1 className="titulo-gradiente mt-2 text-3xl leading-tight sm:text-4xl">{titulo}</h1>
        {descricao ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mf-texto-2">{descricao}</p>
        ) : null}
      </div>
      {acoes ? (
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">{acoes}</div>
      ) : null}
    </div>
  );
}
