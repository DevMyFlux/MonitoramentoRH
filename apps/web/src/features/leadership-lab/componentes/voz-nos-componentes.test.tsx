// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderizar } from "../../../test/render";
import { labApi } from "../api";
import { BotaoOuvir } from "./botao-ouvir";
import { ConversaComFacilitador } from "./conversa-com-facilitador";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, labApi: { conversar: vi.fn() } };
});
const conversar = vi.mocked(labApi.conversar);

const falados: string[] = [];
const cancel = vi.fn();
let reconhecedor: {
  start: ReturnType<typeof vi.fn>;
  disparar(texto: string, final: boolean): void;
  onend: (() => void) | null;
};

function ligarVoz({ sintese = true, ditado = true } = {}) {
  falados.length = 0;
  cancel.mockReset();
  if (sintese) {
    class Fala {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Fala;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, getVoices: () => [], speak: (f: { text: string }) => falados.push(f.text) }
    });
  }
  if (ditado) {
    class Reconhecedor {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn(() => this.onend?.());
      abort = vi.fn();
      constructor() {
        reconhecedor = this as unknown as typeof reconhecedor;
      }
      disparar(texto: string, final: boolean) {
        this.onresult?.({
          resultIndex: 0,
          results: [Object.assign([{ transcript: texto }], { isFinal: final })]
        });
      }
    }
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      Reconhecedor;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});
afterEach(() => {
  Reflect.deleteProperty(window, "speechSynthesis");
  Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
});

describe("BotaoOuvir", () => {
  it("lê o texto em voz alta, vira Parar enquanto fala e avisa quem acompanha", async () => {
    ligarVoz();
    const aoMudar = vi.fn();
    render(<BotaoOuvir texto="Uma situação." rotulo="Ouvir a situação" aoMudar={aoMudar} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Ouvir a situação" }));
    expect(falados).toEqual(["Uma situação."]);
    expect(aoMudar).toHaveBeenLastCalledWith(true);

    await usuario.click(screen.getByRole("button", { name: "Parar" }));
    expect(cancel).toHaveBeenCalled();
    expect(aoMudar).toHaveBeenLastCalledWith(false);
  });

  it("onde o navegador não tem voz, não aparece", () => {
    ligarVoz({ sintese: false });
    render(<BotaoOuvir texto="x" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("voz na conversa com o facilitador", () => {
  it("sem suporte do navegador, não mostra os controles de voz", () => {
    ligarVoz({ sintese: false, ditado: false });
    renderizar(<ConversaComFacilitador sessaoId="s" />);
    expect(screen.queryByLabelText(/Ler as respostas em voz alta/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Ditar a mensagem" })).toBeNull();
  });

  it("ler as respostas: desligado por padrão; ligado, fala a resposta e lembra a escolha", async () => {
    ligarVoz({ ditado: false });
    conversar.mockResolvedValue({
      desfecho: "respondida",
      resposta: "Foi a comunicação.",
      fontes: []
    });
    renderizar(<ConversaComFacilitador sessaoId="s" />);
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Como fui no geral?" }));
    await screen.findByText("Foi a comunicação.");
    expect(falados).toEqual([]);

    const interruptor = screen.getByLabelText(/Ler as respostas em voz alta/);
    await usuario.click(interruptor);
    expect(window.localStorage.getItem("lab-voz-ler-respostas")).toBe("1");
    await usuario.type(
      screen.getByRole("textbox", { name: "Sua mensagem ao facilitador" }),
      "E agora?{Enter}"
    );
    await screen.findAllByText("Foi a comunicação.");
    expect(falados).toEqual(["Foi a comunicação."]);

    await usuario.click(interruptor);
    expect(cancel).toHaveBeenCalled();
  });

  it("ditado: a primeira vez pede ciência do aviso; depois dita para a caixa, sem enviar", async () => {
    ligarVoz({ sintese: false });
    renderizar(<ConversaComFacilitador sessaoId="s" />);
    const usuario = userEvent.setup();
    const caixa = screen.getByRole("textbox", {
      name: "Sua mensagem ao facilitador"
    }) as HTMLTextAreaElement;

    await usuario.click(screen.getByRole("button", { name: "Ditar a mensagem" }));
    const aviso = screen.getByRole("group", { name: "Aviso sobre o ditado" });
    expect(aviso.textContent).toMatch(/serviço do fabricante/);
    expect(reconhecedor).toBeUndefined();

    await usuario.click(screen.getByRole("button", { name: "Entendi, usar o microfone" }));
    expect(window.localStorage.getItem("lab-voz-ciente-do-ditado")).toBe("1");
    expect(reconhecedor.start).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Parar o ditado" }).getAttribute("aria-pressed")
    ).toBe("true");

    act(() => reconhecedor.disparar("como fui no geral", true));
    expect(caixa.value).toBe("como fui no geral");
    expect(conversar).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Parar o ditado" }));
    expect(screen.queryByRole("group", { name: "Aviso sobre o ditado" })).toBeNull();
  });

  it("já ciente, ditar de novo começa direto e acrescenta ao que estava escrito", async () => {
    ligarVoz({ sintese: false });
    window.localStorage.setItem("lab-voz-ciente-do-ditado", "1");
    renderizar(<ConversaComFacilitador sessaoId="s" />);
    const usuario = userEvent.setup();
    const caixa = screen.getByRole("textbox", {
      name: "Sua mensagem ao facilitador"
    }) as HTMLTextAreaElement;
    await usuario.type(caixa, "Sobre a situação 2");
    await usuario.click(screen.getByRole("button", { name: "Ditar a mensagem" }));
    expect(screen.queryByRole("group", { name: "Aviso sobre o ditado" })).toBeNull();
    act(() => reconhecedor.disparar("o que errei", false));
    expect(caixa.value).toBe("Sobre a situação 2 o que errei");
  });

  it("microfone negado: explica, em texto", async () => {
    ligarVoz({ sintese: false });
    window.localStorage.setItem("lab-voz-ciente-do-ditado", "1");
    renderizar(<ConversaComFacilitador sessaoId="s" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ditar a mensagem" }));
    act(() =>
      (reconhecedor as unknown as { onerror: (e: { error: string }) => void }).onerror({
        error: "not-allowed"
      })
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/não liberou o microfone/);
  });
});
