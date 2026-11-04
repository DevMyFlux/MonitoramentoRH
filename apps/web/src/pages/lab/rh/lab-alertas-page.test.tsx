// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import { alerta, participanteResumido, pendencias } from "../../../test/dados-da-curadoria";
import { renderizar } from "../../../test/render";
import { LabAlertasPage } from "./lab-alertas-page";

vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { pendencias: vi.fn(), alertas: vi.fn(), tratarAlerta: vi.fn() }
}));

const api = vi.mocked(labCuradoriaApi);
const abrir = () => renderizar(<LabAlertasPage />, { rota: "/lab/rh/alertas" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

beforeEach(() => {
  vi.resetAllMocks();
  api.pendencias.mockResolvedValue(pendencias());
});

describe("alertas do curador", () => {
  it("explica que alerta é pedagógico e que o vermelho aparece com o teste em andamento", async () => {
    api.alertas.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nenhum alerta aberto");
    expect(screen.getByText(/pedagógicos, não disciplinares/)).toBeTruthy();
    expect(screen.getByText(/aparece mesmo com o teste em andamento/)).toBeTruthy();
    expect(api.alertas).toHaveBeenCalledWith("aberto");
  });

  it("lista o alerta, de quem é, o que o gerou e para onde ir", async () => {
    api.alertas.mockResolvedValue([
      alerta(),
      alerta({
        id: "a2",
        cor: "amarelo",
        skillNome: "Delegação",
        situacao: null,
        participante: participanteResumido({ id: "p2", nome: "Bruno Lima" })
      }),
      alerta({
        id: "a3",
        situacao: 1,
        resultadoId: null,
        testeConcluido: false,
        participante: participanteResumido({ id: "p3", nome: "Carla Dias" })
      })
    ]);
    abrir();
    const vermelho = (await screen.findByText("Ana Souza")).closest("tr")!;
    expect(within(vermelho).getByText("Vermelho")).toBeTruthy();
    expect(within(vermelho).getByText("Situação 2")).toBeTruthy();
    expect(
      within(vermelho).getByRole("link", { name: "Abrir resultado" }).getAttribute("href")
    ).toBe("/lab/rh/revisao/resultado-1");

    const amarelo = screen.getByText("Bruno Lima").closest("tr")!;
    expect(within(amarelo).getByText("Amarelo")).toBeTruthy();
    expect(within(amarelo).getByText("Delegação")).toBeTruthy();

    // Teste em andamento: sem resultado para abrir, e diz que está em andamento.
    const emAndamento = screen.getByText("Carla Dias").closest("tr")!;
    expect(within(emAndamento).getByText("Em andamento")).toBeTruthy();
    expect(within(emAndamento).queryByRole("link", { name: "Abrir resultado" })).toBeNull();
  });

  it("o filtro pede a lista certa", async () => {
    const usuario = userEvent.setup();
    api.alertas.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nenhum alerta aberto");
    await usuario.selectOptions(screen.getByLabelText("Mostrar"), "Encerrados");
    await waitFor(() => expect(api.alertas).toHaveBeenLastCalledWith("encerrado"));
    await usuario.selectOptions(screen.getByLabelText("Mostrar"), "Todos");
    await waitFor(() => expect(api.alertas).toHaveBeenLastCalledWith("todos"));
  });

  it("o alerta encerrado mostra quem encerrou, quando e a nota, e não tem botão", async () => {
    const usuario = userEvent.setup();
    api.alertas.mockResolvedValue([
      alerta({
        status: "encerrado",
        tratadoPor: "Rita",
        tratadoEm: "2026-03-03T10:00:00.000Z",
        nota: "Conversamos."
      })
    ]);
    abrir();
    await usuario.selectOptions(await screen.findByLabelText("Mostrar"), "Todos");
    const linha = (await screen.findByText("Ana Souza")).closest("tr")!;
    expect(within(linha).getByText("Encerrado")).toBeTruthy();
    expect(within(linha).getByText(/Rita em .*: Conversamos\./)).toBeTruthy();
    expect(within(linha).queryByRole("button", { name: /Encerrar/ })).toBeNull();
  });

  describe("encerrar", () => {
    it("exige a nota da conversa, e não chama o servidor sem ela", async () => {
      const usuario = userEvent.setup();
      api.alertas.mockResolvedValue([alerta()]);
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Encerrar o alerta de Ana Souza" })
      );
      const dialogo = within(screen.getByRole("dialog"));
      expect(dialogo.getByText(/Encerrar não se desfaz/)).toBeTruthy();
      await usuario.type(dialogo.getByLabelText("Nota da conversa"), "   ");
      await usuario.click(dialogo.getByRole("button", { name: "Encerrar alerta" }));
      expect((await dialogo.findByRole("alert")).textContent).toMatch(/Escreva a nota da conversa/);
      expect(api.tratarAlerta).not.toHaveBeenCalled();
    });

    it("com a nota, encerra, fecha e atualiza a lista", async () => {
      const usuario = userEvent.setup();
      api.alertas.mockResolvedValueOnce([alerta()]).mockResolvedValue([]);
      api.tratarAlerta.mockResolvedValue(alerta({ status: "encerrado", nota: "Conversamos." }));
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Encerrar o alerta de Ana Souza" })
      );
      const dialogo = within(screen.getByRole("dialog"));
      await usuario.type(dialogo.getByLabelText("Nota da conversa"), "  Conversamos.  ");
      await usuario.click(dialogo.getByRole("button", { name: "Encerrar alerta" }));
      await waitFor(() =>
        expect(api.tratarAlerta).toHaveBeenCalledWith("alerta-1", "Conversamos.")
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await screen.findByText("Nenhum alerta aberto");
    });

    it("se o servidor recusar, mostra o motivo e mantém o formulário aberto", async () => {
      const usuario = userEvent.setup();
      api.alertas.mockResolvedValue([alerta()]);
      api.tratarAlerta.mockRejectedValue(
        erroDaApi(409, "LAB_ALERTA_JA_TRATADO", "Este alerta já foi encerrado.")
      );
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Encerrar o alerta de Ana Souza" })
      );
      const dialogo = within(screen.getByRole("dialog"));
      await usuario.type(dialogo.getByLabelText("Nota da conversa"), "Conversamos.");
      await usuario.click(dialogo.getByRole("button", { name: "Encerrar alerta" }));
      expect((await dialogo.findByRole("alert")).textContent).toBe("Este alerta já foi encerrado.");
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("cancelar fecha, e abrir de novo começa do zero", async () => {
      const usuario = userEvent.setup();
      api.alertas.mockResolvedValue([alerta()]);
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Encerrar o alerta de Ana Souza" })
      );
      await usuario.type(screen.getByLabelText("Nota da conversa"), "Começo de nota");
      await usuario.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      await usuario.click(screen.getByRole("button", { name: "Encerrar o alerta de Ana Souza" }));
      expect((screen.getByLabelText("Nota da conversa") as HTMLTextAreaElement).value).toBe("");
      expect(api.tratarAlerta).not.toHaveBeenCalled();
    });
  });

  it("perfil sem acesso diz que a área não é dele", async () => {
    api.alertas.mockRejectedValue(erroDaApi(403, "LAB_FORBIDDEN"));
    abrir();
    await screen.findByText("Esta área não é para o seu perfil");
  });
});
