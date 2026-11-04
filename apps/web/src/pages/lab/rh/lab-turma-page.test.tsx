// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCadastroApi } from "../../../features/leadership-lab/cadastro-api";
import { ApiError } from "../../../features/my-flux/client";
import { colaborador, participante, turmaDetalhe, usuario } from "../../../test/dados-do-cadastro";
import { renderizar } from "../../../test/render";
import { LabTurmaPage } from "./lab-turma-page";

vi.mock("../../../features/leadership-lab/cadastro-api", () => ({
  labCadastroApi: {
    turma: vi.fn(),
    participantes: vi.fn(),
    atualizarTurma: vi.fn(),
    incluirNaTurma: vi.fn(),
    removerDaTurma: vi.fn()
  }
}));

const api = vi.mocked(labCadastroApi);
const abrir = () =>
  renderizar(<LabTurmaPage />, { rota: "/lab/rh/turmas/turma-1", caminho: "/lab/rh/turmas/:id" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

const ana = participante();
const bruno = participante({
  id: "participante-2",
  colaborador: colaborador({ id: "colaborador-2", nome: "Bruno Lima", identificador: "MAT-002" }),
  usuario: usuario({ id: "usuario-2", nome: "Conta do Bruno", email: "bruno@exemplo.com" })
});
const carla = participante({
  id: "participante-3",
  ativo: false,
  colaborador: colaborador({ id: "colaborador-3", nome: "Carla Dias", identificador: "MAT-003" }),
  usuario: usuario({ id: "usuario-3", nome: "Conta da Carla", email: "carla@exemplo.com" })
});

/** O seletor mostra "Carregando..." até a lista de participantes chegar. */
const esperarOpcao = async (nome: string) =>
  within(await screen.findByLabelText("Incluir participante")).findByRole("option", {
    name: new RegExp(nome)
  });

beforeEach(() => {
  vi.resetAllMocks();
  api.participantes.mockResolvedValue([ana, bruno, carla]);
});

describe("detalhe da turma", () => {
  it("mostra a turma, a situação e os participantes dela", async () => {
    api.turma.mockResolvedValue(turmaDetalhe({ participantes: [ana] }));
    abrir();
    await screen.findByRole("heading", { name: "Supervisores 2026" });
    expect(screen.getByText("Participantes (1)")).toBeTruthy();
    const linha = screen.getByText("Ana Souza").closest("tr")!;
    expect(within(linha).getByText("Matrícula MAT-001")).toBeTruthy();
    expect(within(linha).getByText("Liberado")).toBeTruthy();
    expect(api.turma).toHaveBeenCalledWith("turma-1");
  });

  it("turma que não existe ou é de outro curador: o mesmo aviso, com voltar", async () => {
    api.turma.mockRejectedValue(erroDaApi(404, "LAB_NOT_FOUND"));
    abrir();
    await screen.findByText("Registro não encontrado");
    expect(screen.getByRole("link", { name: /Voltar às turmas/ }).getAttribute("href")).toBe(
      "/lab/rh/turmas"
    );
  });

  describe("incluir participantes", () => {
    it("oferece só os ativos que ainda não estão na turma", async () => {
      api.turma.mockResolvedValue(turmaDetalhe({ participantes: [ana] }));
      abrir();
      const seletor = (await screen.findByLabelText("Incluir participante")) as HTMLSelectElement;
      await within(seletor).findByRole("option", { name: /Bruno Lima/ });
      const opcoes = within(seletor)
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(opcoes).toEqual(["Escolha um participante", "Bruno Lima — matrícula MAT-002"]);
      // Ana já está na turma e Carla está desativada.
    });

    it("inclui o escolhido e a lista passa a mostrá-lo", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe({ participantes: [ana] }));
      api.incluirNaTurma.mockResolvedValue(turmaDetalhe({ participantes: [ana, bruno] }));
      abrir();
      await esperarOpcao("Bruno Lima");
      await usuarioDeTeste.selectOptions(
        screen.getByLabelText("Incluir participante"),
        "participante-2"
      );
      await usuarioDeTeste.click(screen.getByRole("button", { name: "Incluir na turma" }));
      await waitFor(() =>
        expect(api.incluirNaTurma).toHaveBeenCalledWith("turma-1", "participante-2")
      );
      await screen.findByText("Bruno Lima");
      expect(screen.getByText("Participantes (2)")).toBeTruthy();
    });

    it("o botão só liga depois de escolher alguém", async () => {
      api.turma.mockResolvedValue(turmaDetalhe());
      abrir();
      const botao = (await screen.findByRole("button", {
        name: "Incluir na turma"
      })) as HTMLButtonElement;
      expect(botao.disabled).toBe(true);
    });

    it("se o servidor recusar, mostra o motivo", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe());
      api.incluirNaTurma.mockRejectedValue(
        erroDaApi(409, "LAB_PARTICIPANTE_JA_NA_TURMA", "O participante já está nesta turma.")
      );
      abrir();
      await esperarOpcao("Ana Souza");
      await usuarioDeTeste.selectOptions(
        screen.getByLabelText("Incluir participante"),
        "participante-1"
      );
      await usuarioDeTeste.click(screen.getByRole("button", { name: "Incluir na turma" }));
      expect((await screen.findByRole("alert")).textContent).toBe(
        "O participante já está nesta turma."
      );
    });

    it("sem participantes ativos, manda cadastrá-los primeiro", async () => {
      api.participantes.mockResolvedValue([carla]);
      api.turma.mockResolvedValue(turmaDetalhe());
      abrir();
      await screen.findByText(/Não há participantes ativos para incluir/);
      expect(
        screen.getByRole("link", { name: "Cadastre participantes" }).getAttribute("href")
      ).toBe("/lab/rh/participantes");
    });

    it("quando todos os ativos já estão na turma, diz isso", async () => {
      api.participantes.mockResolvedValue([ana]);
      api.turma.mockResolvedValue(turmaDetalhe({ participantes: [ana] }));
      abrir();
      await screen.findByText("Todos os participantes ativos já estão nesta turma.");
    });

    it("turma encerrada não recebe participantes", async () => {
      api.turma.mockResolvedValue(turmaDetalhe({ ativa: false }));
      abrir();
      await screen.findByText("Reabra a turma para incluir participantes nela.");
      expect(screen.queryByLabelText("Incluir participante")).toBeNull();
    });
  });

  describe("tirar da turma", () => {
    it("explica o efeito e só tira depois de confirmar", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe({ participantes: [ana, bruno] }));
      api.removerDaTurma.mockResolvedValue(turmaDetalhe({ participantes: [bruno] }));
      abrir();
      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Tirar Ana Souza da turma" })
      );
      const dialogo = within(screen.getByRole("dialog"));
      expect(
        dialogo.getByText(/deixa de ver os resultados dele, inclusive os que aguardam validação/)
      ).toBeTruthy();
      expect(api.removerDaTurma).not.toHaveBeenCalled();

      await usuarioDeTeste.click(dialogo.getByRole("button", { name: "Tirar da turma" }));
      await waitFor(() =>
        expect(api.removerDaTurma).toHaveBeenCalledWith("turma-1", "participante-1")
      );
      await waitFor(() => expect(screen.queryByText("Ana Souza")).toBeNull());
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("cancelar não tira ninguém", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe({ participantes: [ana] }));
      abrir();
      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Tirar Ana Souza da turma" })
      );
      await usuarioDeTeste.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" })
      );
      expect(api.removerDaTurma).not.toHaveBeenCalled();
      expect(screen.getByText("Ana Souza")).toBeTruthy();
    });
  });

  describe("renomear, encerrar e reabrir", () => {
    it("renomeia a turma", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe());
      api.atualizarTurma.mockResolvedValue(turmaDetalhe({ nome: "Outro nome" }));
      abrir();
      const salvar = (await screen.findByRole("button", {
        name: "Salvar nome"
      })) as HTMLButtonElement;
      expect(salvar.disabled).toBe(true); // nada mudou
      const campo = screen.getByLabelText(/Nome da turma/);
      await usuarioDeTeste.clear(campo);
      await usuarioDeTeste.type(campo, "Outro nome");
      await usuarioDeTeste.click(salvar);
      await waitFor(() =>
        expect(api.atualizarTurma).toHaveBeenCalledWith("turma-1", { nome: "Outro nome" })
      );
    });

    it("nome curto demais é recusado na tela", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe());
      abrir();
      const campo = await screen.findByLabelText(/Nome da turma/);
      await usuarioDeTeste.clear(campo);
      await usuarioDeTeste.type(campo, "A");
      await usuarioDeTeste.click(screen.getByRole("button", { name: "Salvar nome" }));
      await screen.findByText(/deve ter de 2 a 80 letras/);
      expect(api.atualizarTurma).not.toHaveBeenCalled();
    });

    it("encerrar pede confirmação que explica a consequência", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe());
      api.atualizarTurma.mockResolvedValue(turmaDetalhe({ ativa: false }));
      abrir();
      await usuarioDeTeste.click(await screen.findByRole("button", { name: "Encerrar turma" }));
      const dialogo = within(screen.getByRole("dialog"));
      expect(
        dialogo.getByText(/Você deixa de ver os resultados dos participantes desta turma/)
      ).toBeTruthy();
      expect(api.atualizarTurma).not.toHaveBeenCalled();
      await usuarioDeTeste.click(dialogo.getByRole("button", { name: "Encerrar turma" }));
      await waitFor(() =>
        expect(api.atualizarTurma).toHaveBeenCalledWith("turma-1", { ativa: false })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("reabrir é direto", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.turma.mockResolvedValue(turmaDetalhe({ ativa: false }));
      api.atualizarTurma.mockResolvedValue(turmaDetalhe({ ativa: true }));
      abrir();
      await screen.findByText("Encerrada");
      await usuarioDeTeste.click(screen.getByRole("button", { name: "Reabrir turma" }));
      await waitFor(() =>
        expect(api.atualizarTurma).toHaveBeenCalledWith("turma-1", { ativa: true })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
