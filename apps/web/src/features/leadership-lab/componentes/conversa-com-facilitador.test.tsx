// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../my-flux/client";
import { renderizar } from "../../../test/render";
import { labApi } from "../api";
import { ConversaComFacilitador } from "./conversa-com-facilitador";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, labApi: { conversar: vi.fn() } };
});

const conversar = vi.mocked(labApi.conversar);

function abrir() {
  return renderizar(<ConversaComFacilitador sessaoId="sessao-1" />);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("conversa com o facilitador", () => {
  it("abre com a saudação, as sugestões e o aviso de que nada é guardado", () => {
    abrir();
    expect(screen.getByRole("log", { name: "Conversa com o facilitador" })).toBeTruthy();
    expect(screen.getByText(/Eu sou o facilitador/)).toBeTruthy();
    expect(screen.getByText(/a conversa não é guardada/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Qual foi o meu ponto forte?" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Enviar mensagem" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("uma sugestão envia a pergunta e mostra a resposta; as sugestões somem", async () => {
    conversar.mockResolvedValue({ desfecho: "respondida", resposta: "Foi a comunicação." });
    abrir();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Qual foi o meu ponto forte?" }));

    expect(await screen.findByText("Foi a comunicação.")).toBeTruthy();
    expect(conversar).toHaveBeenCalledWith("sessao-1", {
      mensagem: "Qual foi o meu ponto forte?",
      historico: []
    });
    expect(screen.getByText("Qual foi o meu ponto forte?")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Sugestões de perguntas" })).toBeNull();
  });

  it("Enter envia, Shift+Enter não; o histórico recente vai junto, sem a saudação", async () => {
    conversar
      .mockResolvedValueOnce({ desfecho: "respondida", resposta: "Resposta 1." })
      .mockResolvedValueOnce({ desfecho: "respondida", resposta: "Resposta 2." });
    abrir();
    const usuario = userEvent.setup();
    const caixa = screen.getByRole("textbox", { name: "Sua mensagem ao facilitador" });

    await usuario.type(caixa, "primeira{Shift>}{Enter}{/Shift}ainda primeira");
    expect(conversar).not.toHaveBeenCalled();
    await usuario.keyboard("{Enter}");
    await screen.findByText("Resposta 1.");
    expect(conversar).toHaveBeenNthCalledWith(1, "sessao-1", {
      mensagem: "primeira\nainda primeira",
      historico: []
    });
    expect((caixa as HTMLTextAreaElement).value).toBe("");

    await usuario.type(caixa, "segunda{Enter}");
    await screen.findByText("Resposta 2.");
    expect(conversar).toHaveBeenNthCalledWith(2, "sessao-1", {
      mensagem: "segunda",
      historico: [
        { papel: "participante", texto: "primeira\nainda primeira" },
        { papel: "facilitador", texto: "Resposta 1." }
      ]
    });
  });

  it("mensagem bloqueada pela Guarda: mostra o aviso e não volta no histórico", async () => {
    conversar
      .mockResolvedValueOnce({
        desfecho: "bloqueada",
        resposta: "Não consegui usar essa mensagem."
      })
      .mockResolvedValueOnce({ desfecho: "respondida", resposta: "Ok." });
    abrir();
    const usuario = userEvent.setup();
    const caixa = screen.getByRole("textbox", { name: "Sua mensagem ao facilitador" });
    await usuario.type(caixa, "meu cpf é 1{Enter}");
    await screen.findByText("Não consegui usar essa mensagem.");

    await usuario.type(caixa, "e agora{Enter}");
    await screen.findByText("Ok.");
    expect(conversar).toHaveBeenNthCalledWith(2, "sessao-1", {
      mensagem: "e agora",
      historico: []
    });
  });

  it("falha: avisa, devolve o texto para a caixa e deixa tentar de novo", async () => {
    conversar.mockRejectedValueOnce(new ApiError("x", 502, "LAB_IA_INDISPONIVEL"));
    abrir();
    const usuario = userEvent.setup();
    const caixa = screen.getByRole("textbox", { name: "Sua mensagem ao facilitador" });
    await usuario.type(caixa, "Como fui?{Enter}");

    expect((await screen.findByRole("alert")).textContent).toContain(
      "O serviço de IA não respondeu"
    );
    expect((caixa as HTMLTextAreaElement).value).toBe("Como fui?");
    expect(screen.queryByText("Como fui?", { selector: "p" })).toBeNull();

    conversar.mockResolvedValueOnce({ desfecho: "respondida", resposta: "Você foi bem." });
    await usuario.keyboard("{Enter}");
    expect(await screen.findByText("Você foi bem.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("limite de mensagens do teste: mostra o que o servidor disse", async () => {
    conversar.mockRejectedValueOnce(
      new ApiError(
        "Você já mandou 30 mensagens ao facilitador neste teste.",
        429,
        "LAB_CONVERSA_LIMITE"
      )
    );
    abrir();
    await userEvent.setup().click(screen.getByRole("button", { name: "Como fui no geral?" }));
    expect((await screen.findByRole("alert")).textContent).toContain("30 mensagens");
  });

  it("não envia mensagem em branco nem duas ao mesmo tempo", async () => {
    let responder!: (v: { desfecho: "respondida"; resposta: string }) => void;
    conversar.mockReturnValue(new Promise((r) => (responder = r)));
    abrir();
    const usuario = userEvent.setup();
    const caixa = screen.getByRole("textbox", { name: "Sua mensagem ao facilitador" });
    await usuario.type(caixa, "   {Enter}");
    expect(conversar).not.toHaveBeenCalled();

    await usuario.type(caixa, "Oi{Enter}");
    await usuario.type(caixa, "de novo{Enter}");
    expect(conversar).toHaveBeenCalledTimes(1);
    expect(screen.getByText("O facilitador está escrevendo...")).toBeTruthy();
    responder({ desfecho: "respondida", resposta: "Olá!" });
    await screen.findByText("Olá!");
  });
});
