// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import "../../../test/render";
import {
  Button,
  Expansivel,
  MenuDeAcoes,
  Modal,
  NotificacoesProvider,
  NumeroAnimado,
  useNotificar
} from "./index";

describe("Button", () => {
  it("carregando: trava o botão e avisa a tecnologia assistiva", () => {
    render(<Button loading>Salvar</Button>);
    const botao = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(botao.getAttribute("aria-busy")).toBe("true");
  });

  it("sem carregar, dispara o clique", async () => {
    const aoClicar = vi.fn();
    render(<Button onClick={aoClicar}>Salvar</Button>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar" }));
    expect(aoClicar).toHaveBeenCalledOnce();
  });
});

describe("Modal", () => {
  it("é um diálogo com nome e descrição; fechado, não existe", () => {
    const { rerender } = render(
      <Modal isOpen title="Encerrar alerta" description="Não se desfaz." onClose={() => undefined}>
        conteúdo
      </Modal>
    );
    const dialogo = screen.getByRole("dialog", { name: "Encerrar alerta" });
    expect(dialogo.getAttribute("aria-describedby")).toBeTruthy();
    expect(within(dialogo).getByText("Não se desfaz.")).toBeTruthy();
    rerender(
      <Modal isOpen={false} title="Encerrar alerta" onClose={() => undefined}>
        conteúdo
      </Modal>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc fecha; com closable falso, nem Esc nem o botão de fechar fecham", async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    const { rerender } = render(
      <Modal isOpen title="Título" onClose={aoFechar}>
        conteúdo
      </Modal>
    );
    await usuario.keyboard("{Escape}");
    expect(aoFechar).toHaveBeenCalledTimes(1);

    rerender(
      <Modal isOpen closable={false} title="Título" onClose={aoFechar}>
        conteúdo
      </Modal>
    );
    await usuario.keyboard("{Escape}");
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Fechar" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("o foco entra no diálogo ao abrir e volta a quem o abriu ao fechar", async () => {
    const usuario = userEvent.setup();
    function Tela() {
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setAberto(true)}>
            abrir
          </button>
          <Modal isOpen={aberto} title="Confirmar" onClose={() => setAberto(false)}>
            <button type="button">dentro</button>
          </Modal>
        </>
      );
    }
    render(<Tela />);
    const abrir = screen.getByRole("button", { name: "abrir" });
    await usuario.click(abrir);
    const dialogo = screen.getByRole("dialog", { name: "Confirmar" });
    expect(dialogo.contains(document.activeElement)).toBe(true);
    // O Tab fica preso no diálogo.
    await usuario.tab();
    await usuario.tab();
    await usuario.tab();
    expect(dialogo.contains(document.activeElement)).toBe(true);

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });
});

describe("Expansivel", () => {
  it("abre e fecha pelo cabeçalho, com aria-expanded e região", async () => {
    const usuario = userEvent.setup();
    render(<Expansivel cabecalho="Situação 1">detalhes da situação</Expansivel>);
    const botao = screen.getByRole("button", { name: "Situação 1" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("detalhes da situação")).toBeNull();

    await usuario.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region")).toBeTruthy();
    expect(screen.getByText("detalhes da situação")).toBeTruthy();
  });

  it("pode começar aberto", () => {
    render(
      <Expansivel cabecalho="Situação 2" abertoNoInicio>
        já visível
      </Expansivel>
    );
    expect(screen.getByText("já visível")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Situação 2" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
  });
});

describe("NumeroAnimado", () => {
  it("o texto é sempre o valor final formatado (a contagem é só efeito visual)", () => {
    render(<NumeroAnimado valor={88.33} formatar={(n) => `${n.toFixed(1)}%`} />);
    expect(screen.getByText("88.3%")).toBeTruthy();
  });
});

describe("MenuDeAcoes", () => {
  function abrir(aoSair = vi.fn()) {
    render(
      <MemoryRouter>
        <MenuDeAcoes
          rotulo="Menu da conta"
          gatilho="Ana"
          itens={[
            { tipo: "link", rotulo: "Parâmetros", para: "/parametros" },
            { tipo: "acao", rotulo: "Sair", aoClicar: aoSair }
          ]}
        />
      </MemoryRouter>
    );
    return aoSair;
  }

  it("abre com o clique, foca o primeiro item e percorre com as setas", async () => {
    const usuario = userEvent.setup();
    abrir();
    const gatilho = screen.getByRole("button", { name: "Menu da conta" });
    expect(gatilho.getAttribute("aria-expanded")).toBe("false");
    await usuario.click(gatilho);
    expect(gatilho.getAttribute("aria-expanded")).toBe("true");
    const itens = screen.getAllByRole("menuitem");
    expect(itens).toHaveLength(2);
    expect(document.activeElement).toBe(itens[0]);
    await usuario.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(itens[1]);
    await usuario.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(itens[0]);
    await usuario.keyboard("{End}");
    expect(document.activeElement).toBe(itens[1]);
  });

  it("Esc fecha e devolve o foco ao botão", async () => {
    const usuario = userEvent.setup();
    abrir();
    const gatilho = screen.getByRole("button", { name: "Menu da conta" });
    await usuario.click(gatilho);
    await usuario.keyboard("{Escape}");
    expect(gatilho.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(gatilho);
  });

  it("escolher uma ação a executa e fecha o menu", async () => {
    const usuario = userEvent.setup();
    const aoSair = abrir();
    await usuario.click(screen.getByRole("button", { name: "Menu da conta" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Sair" }));
    expect(aoSair).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Menu da conta" }).getAttribute("aria-expanded")
    ).toBe("false");
  });
});

describe("notificações", () => {
  function Disparador() {
    const notificar = useNotificar();
    return (
      <>
        <button
          type="button"
          onClick={() => notificar({ tom: "sucesso", titulo: "Salvo", descricao: "Tudo certo." })}
        >
          sucesso
        </button>
        <button type="button" onClick={() => notificar({ tom: "erro", titulo: "Falhou" })}>
          erro
        </button>
      </>
    );
  }

  it("mostra o aviso: sucesso como status, erro como alerta", async () => {
    const usuario = userEvent.setup();
    render(
      <NotificacoesProvider>
        <Disparador />
      </NotificacoesProvider>
    );
    await usuario.click(screen.getByRole("button", { name: "sucesso" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Salvo")).toBeTruthy();
    expect(screen.getByText("Tudo certo.")).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: "erro" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("some sozinho depois do tempo e pode ser dispensado", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <NotificacoesProvider>
          <Disparador />
        </NotificacoesProvider>
      );
      await usuario.click(screen.getByRole("button", { name: "sucesso" }));
      await usuario.click(await screen.findByRole("button", { name: "Dispensar notificação" }));
      await vi.waitFor(() => expect(screen.queryByText("Salvo")).toBeNull());

      await usuario.click(screen.getByRole("button", { name: "sucesso" }));
      expect(await screen.findByText("Salvo")).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });
      await vi.waitFor(() => expect(screen.queryByText("Salvo")).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  it("fora do provedor, notificar não quebra a tela", async () => {
    render(<Disparador />);
    await userEvent.setup().click(screen.getByRole("button", { name: "sucesso" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
