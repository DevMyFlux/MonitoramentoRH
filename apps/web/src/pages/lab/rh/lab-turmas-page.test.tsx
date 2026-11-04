// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCadastroApi } from "../../../features/leadership-lab/cadastro-api";
import { ApiError } from "../../../features/my-flux/client";
import { turma } from "../../../test/dados-do-cadastro";
import { renderizar } from "../../../test/render";
import { LabTurmasPage } from "./lab-turmas-page";

vi.mock("../../../features/leadership-lab/cadastro-api", () => ({
  labCadastroApi: { turmas: vi.fn(), criarTurma: vi.fn() }
}));

const api = vi.mocked(labCadastroApi);
const abrir = () => renderizar(<LabTurmasPage />, { rota: "/lab/rh/turmas" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("turmas do curador (lista e criação)", () => {
  it("lista as turmas com situação, número de participantes e data, e leva ao detalhe", async () => {
    api.turmas.mockResolvedValue([
      turma({ id: "t1", nome: "Supervisores 2026", nParticipantes: 3 }),
      turma({ id: "t2", nome: "Turma antiga", ativa: false, nParticipantes: 1 })
    ]);
    abrir();
    const link = await screen.findByRole("link", { name: "Supervisores 2026" });
    expect(link.getAttribute("href")).toBe("/lab/rh/turmas/t1");
    const linha = link.closest("tr")!;
    expect(within(linha).getByText("Ativa")).toBeTruthy();
    expect(within(linha).getByText("3")).toBeTruthy();
    expect(within(linha).getByText("02/03/2026")).toBeTruthy();
    expect(
      within(screen.getByText("Turma antiga").closest("tr")!).getByText("Encerrada")
    ).toBeTruthy();
  });

  it("sem turmas, explica para que servem", async () => {
    api.turmas.mockResolvedValue([]);
    abrir();
    await screen.findByText("Você ainda não tem turmas");
    expect(screen.getByText(/define de quem você vê os resultados/)).toBeTruthy();
  });

  it("perfil sem acesso e falha do servidor aparecem como tais", async () => {
    api.turmas.mockRejectedValue(erroDaApi(403, "LAB_FORBIDDEN"));
    abrir();
    await screen.findByText("Esta área não é para o seu perfil");
  });

  it("cria a turma e abre o detalhe dela", async () => {
    const usuario = userEvent.setup();
    api.turmas.mockResolvedValue([]);
    api.criarTurma.mockResolvedValue(turma({ id: "nova", nome: "Coordenadores" }));
    abrir();
    await usuario.type(await screen.findByLabelText(/Nova turma/), "  Coordenadores  ");
    await usuario.click(screen.getByRole("button", { name: "Criar turma" }));
    await waitFor(() => expect(api.criarTurma).toHaveBeenCalledWith({ nome: "Coordenadores" }));
    await waitFor(() =>
      expect(screen.getByTestId("local").textContent).toBe("/lab/rh/turmas/nova")
    );
  });

  it("nome curto demais é recusado na tela, sem chamar o servidor", async () => {
    const usuario = userEvent.setup();
    api.turmas.mockResolvedValue([]);
    abrir();
    await usuario.type(await screen.findByLabelText(/Nova turma/), "A");
    await usuario.click(screen.getByRole("button", { name: "Criar turma" }));
    await screen.findByText(/deve ter de 2 a 80 letras/);
    expect(api.criarTurma).not.toHaveBeenCalled();
  });

  it("se o servidor recusar a criação, mostra o motivo e fica na tela", async () => {
    const usuario = userEvent.setup();
    api.turmas.mockResolvedValue([]);
    api.criarTurma.mockRejectedValue(erroDaApi(403, "LAB_FORBIDDEN"));
    abrir();
    await usuario.type(await screen.findByLabelText(/Nova turma/), "Turma");
    await usuario.click(screen.getByRole("button", { name: "Criar turma" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/Ela é do RH/);
    expect(screen.queryByTestId("local")).toBeNull();
  });
});
