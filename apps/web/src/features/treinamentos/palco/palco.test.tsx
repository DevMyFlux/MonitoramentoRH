// @vitest-environment jsdom
// O Palco e o painel: teclado, foco, movimento reduzido, pacote desconhecido e tela cheia.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const movimento = vi.hoisted(() => ({ reduzido: false }));
vi.mock("./movimento", () => ({ useMovimentoReduzido: () => movimento.reduzido }));

import { Legenda } from "./legenda";
import { PainelDePergunta, PainelDeReacao } from "./painel-de-pergunta";
import { Palco } from "./palco";
import { useTelaCheia } from "./use-tela-cheia";

afterEach(() => {
  cleanup();
  movimento.reduzido = false;
  vi.useRealTimers();
});

const pergunta = {
  id: "q1",
  prompt: "Antes de mexer no quadro, o que você faz?",
  alternatives: ["Entro direto.", "Aviso a UTI.", "Mando mensagem.", "Peço à supervisão."].map(
    (text, indice) => ({ indice, text })
  )
};

describe("painel de pergunta", () => {
  it("abre com o foco no título e responde pelo teclado: setas, 1–4 e Enter", async () => {
    const aoResponder = vi.fn();
    render(
      <PainelDePergunta
        pergunta={pergunta}
        numero={1}
        total={5}
        enviando={false}
        erro=""
        aoResponder={aoResponder}
      />
    );
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: pergunta.prompt }));
    expect(screen.getByRole("group", { name: pergunta.prompt })).toBeTruthy();

    await userEvent.tab();
    const radios = screen.getAllByRole("radio");
    expect(document.activeElement).toBe(radios[0]);
    await userEvent.keyboard("{ArrowDown}");
    expect(radios[0]!.getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{ArrowDown}");
    expect(radios[1]!.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios[1]);
    await userEvent.keyboard("4");
    expect(radios[3]!.getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(aoResponder).toHaveBeenCalledWith(3);
  });

  it("nenhuma alternativa vem marcada nem indica a certa; Responder só depois de escolher", () => {
    const aoResponder = vi.fn();
    render(
      <PainelDePergunta
        pergunta={pergunta}
        numero={1}
        total={5}
        enviando={false}
        erro=""
        aoResponder={aoResponder}
      />
    );
    for (const radio of screen.getAllByRole("radio"))
      expect(radio.getAttribute("aria-checked")).toBe("false");
    const responder = screen.getByRole("button", { name: "Responder" }) as HTMLButtonElement;
    expect(responder.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Aviso a UTI/ }));
    expect(responder.disabled).toBe(false);
  });

  it("a reação mostra o tom com ícone e palavra, e o foco vai para o título dela", () => {
    render(
      <PainelDeReacao
        reacao={{
          tone: "bad",
          title: "Quadro segue energizado",
          text: "Nada foi desligado.",
          scene: {}
        }}
        rotuloDoBotao="Próxima pergunta"
        aoContinuar={() => undefined}
      />
    );
    expect(screen.getByText("Risco")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Quadro segue energizado" })
    );
  });
});

describe("legenda", () => {
  it("digita a narração e só então avisa que terminou; o leitor de tela recebe o texto inteiro", () => {
    vi.useFakeTimers();
    const aoTerminar = vi.fn();
    render(<Legenda texto="22:04 · Olá" reduzido={false} aoTerminar={aoTerminar} />);
    expect(screen.getByText("22:04 · Olá", { selector: ".sr-only" })).toBeTruthy();
    expect(aoTerminar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });

  it("com movimento reduzido o texto aparece inteiro e já termina", () => {
    const aoTerminar = vi.fn();
    render(<Legenda texto="Texto inteiro" reduzido aoTerminar={aoTerminar} />);
    expect(screen.getAllByText("Texto inteiro")).toHaveLength(2);
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });
});

describe("Palco", () => {
  const props = {
    estado: { lock: "1", led: "green", state: "safe" },
    plano: "lever",
    hud: { titulo: "Quadro elétrico da UTI", hora: "22:12" },
    telaCheia: { ativa: false, alternar: () => undefined }
  };

  it("descreve a cena em texto e vai ao plano; com movimento reduzido, sem partículas nem grão", () => {
    movimento.reduzido = true;
    const { container } = render(<Palco pacote="hospital-energia" {...props} />);
    const cena = screen.getByRole("img");
    expect(cena.getAttribute("aria-label")).toMatch(/travado com cadeado/);
    expect(cena.getAttribute("aria-label")).toMatch(/desligado com segurança/);
    // Quadro estático: a câmera já está no plano, sem animação.
    expect(container.querySelector("svg > g")!.getAttribute("transform")).toBe(
      "translate(-2575.00 -819.00) scale(2.7000)"
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".palco-grao")).toBeNull();
  });

  it("um pacote de cena desconhecido cai no genérico, sem quebrar", () => {
    render(<Palco pacote="pacote-que-nao-existe" {...props} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Cena do treinamento.");
    expect(screen.getByText("Quadro elétrico da UTI")).toBeTruthy();
  });
});

function ComTelaCheia() {
  const alvo = useRef<HTMLDivElement>(null);
  const tela = useTelaCheia(alvo);
  return (
    <div ref={alvo} data-testid="modulo" className={tela.planoB ? "palco-tela-cheia" : ""}>
      <button type="button" onClick={() => void tela.alternar()}>
        {tela.ativa ? "Sair" : "Entrar"}
      </button>
    </div>
  );
}

describe("tela cheia", () => {
  it("sem Fullscreen API, usa o plano B por CSS, trava a rolagem e sai com Esc", async () => {
    render(<ComTelaCheia />);
    const aoRedimensionar = vi.fn();
    window.addEventListener("resize", aoRedimensionar);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByTestId("modulo").className).toBe("palco-tela-cheia");
    expect(document.body.style.overflow).toBe("hidden");
    expect(aoRedimensionar).toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("modulo").className).toBe("");
    expect(document.body.style.overflow).toBe("");
    window.removeEventListener("resize", aoRedimensionar);
  });

  it("com a Fullscreen API, pede tela cheia ao contêiner do módulo", async () => {
    const pedir = vi.fn().mockResolvedValue(undefined);
    HTMLElement.prototype.requestFullscreen = pedir;
    try {
      render(<ComTelaCheia />);
      await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
      expect(pedir).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("modulo").className).toBe("");
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen;
    }
  });
});
