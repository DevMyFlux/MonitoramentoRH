// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "../my-flux/client";
import { chaveDoUsuarioAtual } from "../auth/use-usuario-atual";
import { novoCliente, renderizar } from "../../test/render";
import { AssistenteDeSuporte } from "./assistente-de-suporte";
import { LIMITE_DA_CHAMADA_MS, mensagemDoErro } from "./erros-do-suporte";
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

  it("some no Palco dos Treinamentos (sessão e desfecho), mas não na lista", () => {
    expect(assistenteVisivelEm("/treinamentos/abc/jogar")).toBe(false);
    expect(assistenteVisivelEm("/treinamentos/resultado/xyz")).toBe(false);
    expect(assistenteVisivelEm("/treinamentos")).toBe(true);
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
    expect(pedir).toHaveBeenCalledWith(
      "/suporte/conversa",
      "POST",
      {
        mensagem: "Como gero a escala do mês?",
        historico: [],
        pagina: { caminho: "/escalas", titulo: "Escalas" }
      },
      false,
      LIMITE_DA_CHAMADA_MS
    );
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

describe("mensagem de erro do assistente", () => {
  it("diz a causa sem expor detalhe interno", () => {
    expect(mensagemDoErro(new ApiError("x", 404, "NOT_FOUND"))).toMatch(/nesta versão/);
    expect(mensagemDoErro(new ApiError("detalhe interno", 502, "LAB_IA_INDISPONIVEL"))).toBe(
      "O serviço de IA não respondeu agora. Tente de novo em instantes."
    );
    expect(
      mensagemDoErro(new ApiError("Há um teste em andamento.", 409, "SUPORTE_DURANTE_O_TESTE"))
    ).toBe("Há um teste em andamento.");
    expect(mensagemDoErro(new DOMException("t", "TimeoutError"))).toMatch(/demorou/);
    expect(mensagemDoErro(new TypeError("Failed to fetch"))).toMatch(/Sem conexão/);
    expect(mensagemDoErro(new Error("segredo"))).toBe(
      "Não consegui responder agora. Tente de novo em instantes."
    );
  });

  it("o limite da tela é maior que a soma da Guarda e da IA no servidor (25 s + 25 s)", () => {
    expect(LIMITE_DA_CHAMADA_MS).toBeGreaterThan(50_000);
  });
});

describe("assistente com perguntas sobre dados", () => {
  function comPerfil(perfil: string | null, rota = "/colaboradores") {
    const cliente = novoCliente();
    if (perfil) {
      cliente.setQueryData(chaveDoUsuarioAtual, {
        id: "u1",
        email: "a@b.c",
        name: "Pessoa",
        role: perfil,
        scopes: []
      });
    }
    return renderizar(<AssistenteDeSuporte />, { rota, cliente });
  }

  it.each(["RH", "ADMIN", "DEV"])(
    "%s vê sugestões sobre os dados de colaboradores",
    async (perfil) => {
      comPerfil(perfil);
      await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
      expect(screen.getByRole("button", { name: "Quantos colaboradores temos?" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Quem foi desligado recentemente?" })).toBeTruthy();
    }
  );

  it("o perfil comum só vê sugestões de ajuda de uso", async () => {
    comPerfil("COMUM");
    await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
    expect(screen.queryByRole("button", { name: "Quantos colaboradores temos?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Como cadastro um colaborador?" })).toBeTruthy();
  });

  it("a resposta de limitação da conta aparece como qualquer outra resposta", async () => {
    pedir.mockResolvedValueOnce({
      desfecho: "restrita",
      resposta: "Não posso responder a essa pergunta devido às limitações da sua conta."
    });
    comPerfil("COMUM");
    await userEvent.click(screen.getByRole("button", { name: "Abrir assistente de suporte" }));
    await userEvent.type(screen.getByLabelText("Sua dúvida"), "Quantos funcionários temos?{Enter}");
    expect(await screen.findByText(/limitações da sua conta/)).toBeTruthy();
  });

  it("para o administrador, a falha do serviço de IA mostra o detalhe técnico", () => {
    const erro = new ApiError("x", 502, "SUPORTE_IA_INDISPONIVEL", {
      motivo: "a IA respondeu HTTP 404",
      falha: "TRANSPORTE"
    });
    expect(mensagemDoErro(erro)).toBe(
      "O serviço de IA não respondeu agora. Tente de novo em instantes. Detalhe técnico: a IA respondeu HTTP 404."
    );
    // Sem o motivo (perfis comuns), só a mensagem simples.
    expect(mensagemDoErro(new ApiError("x", 502, "SUPORTE_IA_INDISPONIVEL"))).toBe(
      "O serviço de IA não respondeu agora. Tente de novo em instantes."
    );
  });
});
