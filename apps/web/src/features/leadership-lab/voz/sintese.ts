// Leadership Lab — voz do facilitador (síntese de fala do navegador, Web Speech API). Tudo local:
// o texto lido já está na tela e não sai do aparelho por causa disto.
import { useCallback, useEffect, useRef, useState } from "react";

/** Quebra um texto em trechos curtos (por frase). Alguns navegadores cortam falas longas. */
export function dividirEmTrechos(texto: string, maximo = 180): string[] {
  const frases = texto
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…:;])\s+/)
    .filter(Boolean);
  const trechos: string[] = [];
  for (const frase of frases) {
    if (frase.length <= maximo) {
      trechos.push(frase);
      continue;
    }
    // Frase longa: quebra nas vírgulas e, em último caso, nos espaços.
    let atual = "";
    for (const palavra of frase.split(" ")) {
      if (atual !== "" && `${atual} ${palavra}`.length > maximo) {
        trechos.push(atual);
        atual = palavra;
      } else {
        atual = atual === "" ? palavra : `${atual} ${palavra}`;
      }
    }
    if (atual !== "") trechos.push(atual);
  }
  return trechos;
}

/** A melhor voz para português do Brasil: pt-BR, depois qualquer pt, preferindo a local. */
export function escolherVoz(
  vozes: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  const nota = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase().replace("_", "-") === "pt-br"
      ? 4
      : v.lang.toLowerCase().startsWith("pt")
        ? 2
        : 0) + (v.localService ? 1 : 0);
  return [...vozes].filter((v) => nota(v) >= 2).sort((a, b) => nota(b) - nota(a))[0];
}

export function sinteseSuportada(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/** Texto para falar: sem marcadores que o sintetizador leria ("•", "Ø"). */
export function paraFala(texto: string): string {
  return texto.replace(/[•·]/g, ",").replace(/Ø/g, "zero").replace(/\s+/g, " ").trim();
}

export type Fala = {
  suportada: boolean;
  falando: boolean;
  falar: (texto: string) => void;
  parar: () => void;
};

/**
 * Fala textos em voz alta, um de cada vez (falar de novo interrompe o anterior). `falando` vale
 * enquanto houver fala, para o avatar acompanhar. Interrompe ao desmontar a tela.
 */
export function useFala(): Fala {
  const suportada = sinteseSuportada();
  const [falando, setFalando] = useState(false);
  // Identifica a fala atual: eventos de falas interrompidas não podem apagar o estado da nova.
  const geracao = useRef(0);

  const parar = useCallback(() => {
    geracao.current++;
    if (sinteseSuportada()) window.speechSynthesis.cancel();
    setFalando(false);
  }, []);

  const falar = useCallback((texto: string) => {
    if (!sinteseSuportada()) return;
    const trechos = dividirEmTrechos(paraFala(texto));
    if (trechos.length === 0) return;
    const minha = ++geracao.current;
    window.speechSynthesis.cancel();
    const voz = escolherVoz(window.speechSynthesis.getVoices());
    setFalando(true);
    trechos.forEach((trecho, i) => {
      const fala = new SpeechSynthesisUtterance(trecho);
      fala.lang = "pt-BR";
      if (voz) fala.voice = voz;
      fala.rate = 1;
      const terminou = () => {
        if (geracao.current === minha && i === trechos.length - 1) setFalando(false);
      };
      fala.onend = terminou;
      fala.onerror = () => {
        if (geracao.current === minha) setFalando(false);
      };
      window.speechSynthesis.speak(fala);
    });
  }, []);

  useEffect(() => parar, [parar]);

  return { suportada, falando, falar, parar };
}
