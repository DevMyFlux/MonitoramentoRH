// Tela cheia do Palco: a Fullscreen API no contêiner do módulo e, onde ela não existe ou é recusada
// (iOS Safari), o plano B por CSS (position: fixed; inset: 0, classe palco-tela-cheia). Esc sai nos
// dois casos (no nativo, o próprio navegador cuida). Ao entrar e sair: rolagem do body travada e um
// evento `resize`, para o grafo e o canvas se redesenharem no tamanho novo.
import { useCallback, useEffect, useState, type RefObject } from "react";

type ComTelaCheia = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type DocumentoComTelaCheia = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function elementoEmTelaCheia(): Element | null {
  const doc = document as DocumentoComTelaCheia;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function useTelaCheia(alvo: RefObject<HTMLElement | null>) {
  const [nativa, setNativa] = useState(false);
  const [planoB, setPlanoB] = useState(false);
  const ativa = nativa || planoB;

  useEffect(() => {
    const aoMudar = () =>
      setNativa(elementoEmTelaCheia() === alvo.current && alvo.current !== null);
    document.addEventListener("fullscreenchange", aoMudar);
    document.addEventListener("webkitfullscreenchange", aoMudar);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudar);
      document.removeEventListener("webkitfullscreenchange", aoMudar);
    };
  }, [alvo]);

  // Trava a rolagem e avisa o resto da tela do tamanho novo.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    if (ativa) document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("resize"));
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [ativa]);

  // Esc sai do plano B (no nativo, o navegador já sai sozinho).
  useEffect(() => {
    if (!planoB) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setPlanoB(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [planoB]);

  const entrar = useCallback(async () => {
    const elemento = alvo.current as ComTelaCheia | null;
    if (!elemento) return;
    const pedir =
      elemento.requestFullscreen?.bind(elemento) ??
      elemento.webkitRequestFullscreen?.bind(elemento);
    if (pedir) {
      try {
        await pedir();
        return;
      } catch {
        // Recusado (política do navegador, iframe sem permissão): cai no plano B.
      }
    }
    setPlanoB(true);
  }, [alvo]);

  const sair = useCallback(async () => {
    setPlanoB(false);
    if (elementoEmTelaCheia()) {
      const doc = document as DocumentoComTelaCheia;
      await (doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc))?.();
    }
  }, []);

  const alternar = useCallback(() => (ativa ? sair() : entrar()), [ativa, entrar, sair]);

  return { ativa, planoB, entrar, sair, alternar };
}
