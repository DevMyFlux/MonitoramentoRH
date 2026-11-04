// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import { contribuicao, participanteResumido, pendencias } from "../../../test/dados-da-curadoria";
import { renderizar } from "../../../test/render";
import { LabContribuicoesPage } from "./lab-contribuicoes-page";

vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { pendencias: vi.fn(), contribuicoes: vi.fn(), decidirContribuicao: vi.fn() }
}));

const api = vi.mocked(labCuradoriaApi);
const abrir = () => renderizar(<LabContribuicoesPage />, { rota: "/lab/rh/contribuicoes" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

beforeEach(() => {
  vi.resetAllMocks();
  api.pendencias.mockResolvedValue(pendencias());
});

describe("contribuições dos participantes", () => {
  it("lista a ideia, de quem é, em que situação nasceu, e leva ao resultado", async () => {
    api.contribuicoes.mockResolvedValue([contribuicao()]);
    abrir();
    await screen.findByText("Sugiro um checklist de abertura do turno.");
    expect(api.contribuicoes).toHaveBeenCalledWith("pendente");
    expect(screen.getByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText(/Situação 1 ·/)).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir o resultado" }).getAttribute("href")).toBe(
      "/lab/rh/revisao/resultado-1"
    );
  });

  it("de teste em andamento: avisa e não oferece resultado para abrir", async () => {
    api.contribuicoes.mockResolvedValue([
      contribuicao({ testeConcluido: false, resultadoId: null })
    ]);
    abrir();
    await screen.findByText("Teste em andamento");
    expect(screen.queryByRole("link", { name: "Abrir o resultado" })).toBeNull();
  });

  it("sem contribuições, diz o que aparece aqui", async () => {
    api.contribuicoes.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nenhuma contribuição pendente");
  });

  it("o filtro pede a lista certa", async () => {
    const usuario = userEvent.setup();
    api.contribuicoes.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nenhuma contribuição pendente");
    for (const [rotulo, status] of [
      ["Aprovadas", "aprovada"],
      ["Rejeitadas", "rejeitada"],
      ["Todas", "todas"]
    ] as const) {
      await usuario.selectOptions(screen.getByLabelText("Mostrar"), rotulo);
      await waitFor(() => expect(api.contribuicoes).toHaveBeenLastCalledWith(status));
    }
  });

  it("a decidida mostra quem decidiu e quando, e não tem botões", async () => {
    api.contribuicoes.mockResolvedValue([
      contribuicao({
        status: "aprovada",
        decididoPor: "Rita",
        decididoEm: "2026-03-03T10:00:00.000Z"
      })
    ]);
    abrir();
    await screen.findByText("Aprovada");
    expect(screen.getByText(/Decidida por Rita em/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Aprovar|Rejeitar/ })).toBeNull();
  });

  describe("decidir", () => {
    it.each([
      ["Aprovar", "aprovada", "Aprovar esta contribuição?"],
      ["Rejeitar", "rejeitada", "Rejeitar esta contribuição?"]
    ] as const)(
      "%s pede confirmação, avisa que não se desfaz e só então decide",
      async (botao, decisao, titulo) => {
        const usuario = userEvent.setup();
        api.contribuicoes.mockResolvedValueOnce([contribuicao()]).mockResolvedValue([]);
        api.decidirContribuicao.mockResolvedValue(contribuicao({ status: decisao }));
        abrir();
        await usuario.click(
          await screen.findByRole("button", {
            name: new RegExp(`^${botao} a contribuição de Ana Souza`)
          })
        );
        const dialogo = within(screen.getByRole("dialog"));
        expect(dialogo.getByText(titulo)).toBeTruthy();
        expect(dialogo.getByText(/não se desfaz/)).toBeTruthy();
        expect(api.decidirContribuicao).not.toHaveBeenCalled();

        await usuario.click(dialogo.getByRole("button", { name: botao }));
        await waitFor(() =>
          expect(api.decidirContribuicao).toHaveBeenCalledWith("contribuicao-1", decisao)
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        await screen.findByText("Nenhuma contribuição pendente");
      }
    );

    it("cancelar não decide nada", async () => {
      const usuario = userEvent.setup();
      api.contribuicoes.mockResolvedValue([contribuicao()]);
      abrir();
      await usuario.click(await screen.findByRole("button", { name: /^Aprovar a contribuição/ }));
      await usuario.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(api.decidirContribuicao).not.toHaveBeenCalled();
    });

    it("se o servidor recusar (outro curador já decidiu), mostra o motivo na confirmação", async () => {
      const usuario = userEvent.setup();
      api.contribuicoes.mockResolvedValue([contribuicao()]);
      api.decidirContribuicao.mockRejectedValue(
        erroDaApi(409, "LAB_JA_DECIDIDO", "Isto já foi decidido.")
      );
      abrir();
      await usuario.click(await screen.findByRole("button", { name: /^Aprovar a contribuição/ }));
      await usuario.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Aprovar" })
      );
      expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toBe(
        "Isto já foi decidido."
      );
    });
  });

  it("cada contribuição tem os botões com o nome de quem a escreveu", async () => {
    api.contribuicoes.mockResolvedValue([
      contribuicao(),
      contribuicao({
        id: "c2",
        participante: participanteResumido({ id: "p2", nome: "Bruno Lima" })
      })
    ]);
    abrir();
    await screen.findByRole("button", { name: "Aprovar a contribuição de Bruno Lima" });
    expect(
      screen.getByRole("button", { name: "Rejeitar a contribuição de Ana Souza" })
    ).toBeTruthy();
  });
});
