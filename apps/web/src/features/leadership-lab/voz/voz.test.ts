// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { erroDoDitado, useDitado, type ReconhecedorDeFala } from "./ditado";
import { chavesDeVoz, usePreferencia } from "./preferencias";
import { dividirEmTrechos, escolherVoz, paraFala, useFala } from "./sintese";

const voz = (lang: string, localService = true) =>
  ({ lang, localService, name: lang }) as SpeechSynthesisVoice;

describe("dividirEmTrechos", () => {
  it("quebra por frase e junta espaços", () => {
    expect(dividirEmTrechos("Primeira frase.  Segunda frase! Terceira?")).toEqual([
      "Primeira frase.",
      "Segunda frase!",
      "Terceira?"
    ]);
  });
  it("frase longa é quebrada em palavras, sem passar do máximo nem perder texto", () => {
    const longa = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(" ");
    const trechos = dividirEmTrechos(longa, 50);
    expect(trechos.every((t) => t.length <= 50)).toBe(true);
    expect(trechos.join(" ")).toBe(longa);
  });
  it("texto vazio não gera trechos", () => {
    expect(dividirEmTrechos("   ")).toEqual([]);
  });
});

describe("escolherVoz e paraFala", () => {
  it("prefere pt-BR, depois pt, e a voz local; sem português, nenhuma", () => {
    expect(escolherVoz([voz("en-US"), voz("pt-PT"), voz("pt-BR", false)])?.lang).toBe("pt-BR");
    expect(escolherVoz([voz("pt-BR", false), voz("pt_BR", true)])?.localService).toBe(true);
    expect(escolherVoz([voz("pt-PT"), voz("en-US")])?.lang).toBe("pt-PT");
    expect(escolherVoz([voz("en-US"), voz("fr-FR")])).toBeUndefined();
  });
  it("tira marcadores que o sintetizador leria", () => {
    expect(paraFala("• um  • dois Ø")).toBe(", um , dois zero");
  });
});

describe("useFala", () => {
  const falados: Array<{ texto: string; fim: () => void }> = [];
  const cancel = vi.fn();

  beforeEach(() => {
    falados.length = 0;
    cancel.mockReset();
    class Fala {
      lang = "";
      voice: unknown = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", Fala);
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Fala;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel,
        getVoices: () => [voz("pt-BR")],
        speak: (f: InstanceType<typeof Fala>) =>
          falados.push({ texto: f.text, fim: () => f.onend?.() })
      }
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "speechSynthesis");
  });

  it("fala por trechos e só termina depois do último", () => {
    const { result } = renderHook(() => useFala());
    expect(result.current.suportada).toBe(true);
    act(() => result.current.falar("Primeira. Segunda."));
    expect(result.current.falando).toBe(true);
    expect(falados.map((f) => f.texto)).toEqual(["Primeira.", "Segunda."]);
    act(() => falados[0]!.fim());
    expect(result.current.falando).toBe(true);
    act(() => falados[1]!.fim());
    expect(result.current.falando).toBe(false);
  });

  it("falar de novo interrompe a anterior, e o fim da antiga não apaga a nova", () => {
    const { result } = renderHook(() => useFala());
    act(() => result.current.falar("Antiga."));
    const antiga = falados[0]!;
    act(() => result.current.falar("Nova."));
    expect(cancel).toHaveBeenCalled();
    act(() => antiga.fim());
    expect(result.current.falando).toBe(true);
  });

  it("parar cancela, e desmontar também", () => {
    const { result, unmount } = renderHook(() => useFala());
    act(() => result.current.falar("Oi."));
    act(() => result.current.parar());
    expect(result.current.falando).toBe(false);
    cancel.mockClear();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("sem suporte, não quebra", () => {
    Reflect.deleteProperty(window, "speechSynthesis");
    const { result } = renderHook(() => useFala());
    expect(result.current.suportada).toBe(false);
    act(() => result.current.falar("Oi."));
    expect(result.current.falando).toBe(false);
  });
});

describe("useDitado", () => {
  let instancia: ReconhecedorDeFala & { disparar(texto: string, final: boolean): void };

  beforeEach(() => {
    class Reconhecedor {
      lang = "";
      continuous = true;
      interimResults = false;
      onresult: ReconhecedorDeFala["onresult"] = null;
      onerror: ReconhecedorDeFala["onerror"] = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn(() => this.onend?.());
      abort = vi.fn();
      constructor() {
        instancia = this as unknown as typeof instancia;
      }
      disparar(texto: string, final: boolean) {
        const resultado = Object.assign([{ transcript: texto }], { isFinal: final });
        this.onresult?.({ resultIndex: 0, results: [resultado] });
      }
    }
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      Reconhecedor;
  });
  afterEach(() => {
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("dita em português, com resultado parcial, e solta o microfone ao parar", () => {
    const aoTexto = vi.fn();
    const { result } = renderHook(() => useDitado(aoTexto));
    expect(result.current.suportado).toBe(true);
    act(() => result.current.iniciar());
    expect(instancia.lang).toBe("pt-BR");
    expect(instancia.interimResults).toBe(true);
    expect(result.current.ouvindo).toBe(true);

    act(() => instancia.disparar("como fui", false));
    expect(aoTexto).toHaveBeenLastCalledWith("como fui", false);
    act(() => instancia.disparar("como fui no geral", true));
    expect(aoTexto).toHaveBeenLastCalledWith("como fui no geral", true);

    act(() => result.current.parar());
    expect(result.current.ouvindo).toBe(false);
  });

  it("traduz os erros e libera para tentar de novo", () => {
    const { result } = renderHook(() => useDitado(vi.fn()));
    act(() => result.current.iniciar());
    act(() => instancia.onerror?.({ error: "not-allowed" }));
    expect(result.current.erro).toBe("permissao-negada");
    expect(erroDoDitado("no-speech")).toBe("sem-fala");
    expect(erroDoDitado("audio-capture")).toBe("sem-microfone");
    expect(erroDoDitado("network")).toBe("falhou");
  });

  it("desmontar aborta o reconhecimento", () => {
    const { result, unmount } = renderHook(() => useDitado(vi.fn()));
    act(() => result.current.iniciar());
    unmount();
    expect(instancia.abort).toHaveBeenCalled();
  });

  it("sem suporte, diz que não há", () => {
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
    expect(renderHook(() => useDitado(vi.fn())).result.current.suportado).toBe(false);
  });
});

describe("usePreferencia", () => {
  afterEach(() => window.localStorage.clear());

  it("começa desligada, lembra a escolha e sobrevive a armazenamento quebrado", () => {
    const { result } = renderHook(() => usePreferencia(chavesDeVoz.lerRespostas));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(window.localStorage.getItem(chavesDeVoz.lerRespostas)).toBe("1");
    expect(renderHook(() => usePreferencia(chavesDeVoz.lerRespostas)).result.current[0]).toBe(true);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    vi.restoreAllMocks();
  });
});
