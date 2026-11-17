// Fundo ambiente do MY FLUX: dot grid em verde translúcido e uma aurora verde e azul bem suave.
// Origem: inspirado nos fundos "Dot Grid" e "Soft Aurora" do React Bits (reactbits.dev), mas escrito do
// zero em CSS puro (sem WebGL e sem a biblioteca), então não herda a licença deles. As cores são só
// as da paleta (tokens --mf-*). Por quê: dar profundidade ao fundo sem competir com o conteúdo. É o
// único fundo animado da tela, e fica atrás só do fundo: os cartões e as tabelas são opacos.
// Os estilos moram em styles.css (.fundo-ambiente); com prefers-reduced-motion a aurora não se move.
/** `parado`: sem movimento (telas que já têm outro fundo animado, como a de entrada). */
export function FundoAmbiente({ parado = false }: { parado?: boolean }) {
  return (
    <div aria-hidden="true" className={parado ? "fundo-ambiente fundo-parado" : "fundo-ambiente"}>
      <span />
      <span />
    </div>
  );
}
