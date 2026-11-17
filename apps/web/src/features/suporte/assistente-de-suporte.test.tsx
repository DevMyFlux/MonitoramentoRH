// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "../my-flux/client";
import { renderizar } from "../../test/render";
import { AssistenteDeSuporte } from "./assistente-de-suporte";
import { assistenteVisivelEm, contextoDaPagina } from "./contexto-da-pagina";

vi.mock("../my-flux/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../my-flux/client")>();
  return { ...original, request: vi.fn() };
});

const pedir = vi.mocked(request);

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});
afterEach(() => sessionStorage.clear());

describe("contexto da página", () => {
  it("usa o prefixo mais específico", () => {
    expect(contextoDaPagina("/lab/rh/revisao/abc").titulo).toBe(
      "Leadership Lab · Acompanhamento do RH"
    );
    expect(contextoDaPagina("/lab").titulo).toBe("Leadership Lab · Painel");
    expect(contextoDaPagina("/escalas").titulo).toBe("Escalas");
    expect(contextoDaPagina("/escalasx").titulo).toBe("MY FLUX");
  });

  it("some durante o teste do Lab, e só nele", () => {
    expect(assistenteVisivelEm("/lab/teste")).toBe(false);
    expect(assistenteVisivelEm("/lab")).toBe(true);
    expect(assistenteVisivelEm("/colaboradores")).toBe(true);
  });
});

describe("assistente de suporte", () => {
  it("começa fechado, só com o botão discreto", () => {
    renderizar(<AssistenteDeSuporte />, { rota: "/escalas" });
    expect(screen.getByRole("button", { name: "Abrir assistente de suporte" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("não aparece na tela do teste do Lab", () => {
    renderizar(<AssistenteDeSuporte />, { rota: "/lab/teste" });
    expect(screen.queryByRole("button", { name: /assistente de suporte/ })).toBeNull();
  });

  it("abre com sugestões da tela e responde, mandando a tela atual", async () => {
    pedir.mockResolvedValueOnce({ desfecho: "respondida", resposta: "1. Escolha o mês." });
    renderizar(<AssistenteDeSuporte />, { rota: "/escalas" });
    await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
    expect(screen.getByRole("dialog", { name: "Assistente de suporte" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Como gero a escala do mês?" }));
    expect(await screen.findByText("1. Escolha o mês.")).toBeTruthy();
    expect(pedir).toHaveBeenCalledWith("/suporte/conversa", "POST", {
      mensagem: "Como gero a escala do mês?",
      historico: [],
      pagina: { caminho: "/escalas", titulo: "Escalas" }
    });
  });

  it("manda o histórico recente na pergunta seguinte", async () => {
    pedir
      .mockResolvedValueOnce({ desfecho: "respondida", resposta: "Primeira." })
      .mockResolvedValueOnce({ desfecho: "respondida", resposta: "Segunda." });
    renderizar(<AssistenteDeSuporte />, { rota: "/colaboradores" });
    await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
    const campo = screen.getByLabelText("Sua dúvida");
    await userEvent.type(campo, "Oi{Enter}");
    await screen.findByText("Primeira.");
    await userEvent.type(campo, "E agora?{Enter}");
    await screen.findByText("Segunda.");
    expect(pedir.mock.calls[1]?.[2]).toMatchObject({
      mensagem: "E agora?",
      historico: [
        { papel: "usuario", texto: "Oi" },
        { papel: "assistente", texto: "Primeira." }
      ]
    });
  });

  it("numa falha, devolve a pergunta ao campo e explica", async () => {
    pedir.mockRejectedValueOnce(new ApiError("x", 503, "SUPORTE_INDISPONIVEL"));
    renderizar(<AssistenteDeSuporte />, { rota: "/escalas" });
    await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
    const campo = screen.getByLabelText<HTMLTextAreaElement>("Sua dúvida");
    await userEvent.type(campo, "Ajuda{Enter}");
    expect((await screen.findByRole("alert")).textContent).toMatch(/não está disponível/);
    await waitFor(() => expect(campo.value).toBe("Ajuda"));
  });

  it("Esc fecha e devolve o foco ao botão", async () => {
    renderizar(<AssistenteDeSuporte />, { rota: "/escalas" });
    await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Abrir assistente de suporte");
  });
});
