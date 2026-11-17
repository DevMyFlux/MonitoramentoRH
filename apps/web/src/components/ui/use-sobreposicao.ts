import { useEffect } from "react";

/**
 * Marca que há uma gaveta ou janela aberta: o botão flutuante do assistente se recolhe (styles.css)
 * para não cobrir os botões do rodapé, e o foco fica no que está aberto.
 */
export function useSobreposicao(aberta: boolean): void {
  useEffect(() => {
    if (!aberta) return;
    document.documentElement.dataset.sobreposicao = "1";
    return () => {
      delete document.documentElement.dataset.sobreposicao;
    };
  }, [aberta]);
}
