// Leadership Lab — ditado (reconhecimento de fala do navegador, Web Speech API). ATENÇÃO: em
// vários navegadores (Chrome, Edge) o áudio é processado pelo serviço do fabricante, fora do MY
// FLUX. Por isso o ditado é opt-in, com aviso, e o texto ditado passa pela Guarda como qualquer
// mensagem. O MY FLUX não grava áudio.
import { useCallback, useEffect, useRef, useState } from "react";

type EventoDeResultado = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type EventoDeErro = { error: string };

export type ReconhecedorDeFala = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoDeResultado) => void) | null;
  onerror: ((e: EventoDeErro) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type Construtor = new () => ReconhecedorDeFala;

export function construtorDoReconhecimento(): Construtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: Construtor;
    webkitSpeechRecognition?: Construtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type ErroDoDitado = "permissao-negada" | "sem-fala" | "sem-microfone" | "falhou";

/** O que dizer ao participante para cada falha do reconhecimento. */
export const textoDoErroDoDitado: Record<ErroDoDitado, string> = {
  "permissao-negada":
    "O navegador não liberou o microfone. Libere-o nas permissões do site para ditar.",
  "sem-fala": "Não ouvi nada. Tente de novo, falando perto do microfone.",
  "sem-microfone": "Não encontrei um microfone neste aparelho.",
  falhou: "O ditado falhou. Você pode digitar a mensagem."
};

export function erroDoDitado(codigo: string): ErroDoDitado {
  if (codigo === "not-allowed" || codigo === "service-not-allowed") return "permissao-negada";
  if (codigo === "no-speech") return "sem-fala";
  if (codigo === "audio-capture") return "sem-microfone";
  return "falhou";
}

export type Ditado = {
  suportado: boolean;
  ouvindo: boolean;
  erro: ErroDoDitado | null;
  iniciar: () => void;
  parar: () => void;
};

/**
 * Dita para um campo de texto. `aoTexto` recebe o que foi falado nesta sessão de ditado (parcial
 * enquanto fala, final ao terminar); quem chama junta isso ao que já estava escrito.
 */
export function useDitado(aoTexto: (texto: string, final: boolean) => void): Ditado {
  const Construtor = construtorDoReconhecimento();
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<ErroDoDitado | null>(null);
  const reconhecedor = useRef<ReconhecedorDeFala | null>(null);
  const aoTextoRef = useRef(aoTexto);
  useEffect(() => {
    aoTextoRef.current = aoTexto;
  });

  const parar = useCallback(() => {
    reconhecedor.current?.stop();
  }, []);

  const iniciar = useCallback(() => {
    const Classe = construtorDoReconhecimento();
    if (!Classe || reconhecedor.current) return;
    const r = new Classe();
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let texto = "";
      let final = true;
      for (let i = 0; i < e.results.length; i++) {
        const resultado = e.results[i]!;
        texto += resultado[0]?.transcript ?? "";
        if (!resultado.isFinal) final = false;
      }
      aoTextoRef.current(texto.trim(), final);
    };
    r.onerror = (e) => setErro(erroDoDitado(e.error));
    r.onend = () => {
      reconhecedor.current = null;
      setOuvindo(false);
    };
    reconhecedor.current = r;
    setErro(null);
    try {
      r.start();
      setOuvindo(true);
    } catch {
      reconhecedor.current = null;
      setErro("falhou");
    }
  }, []);

  // Sair da tela solta o microfone.
  useEffect(
    () => () => {
      reconhecedor.current?.abort();
      reconhecedor.current = null;
    },
    []
  );

  return { suportado: Construtor !== undefined, ouvindo, erro, iniciar, parar };
}
