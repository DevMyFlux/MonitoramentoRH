// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import { contestacao, pendencias } from "../../../test/dados-da-curadoria";
import { renderizar } from "../../../test/render";
import { LabContestacoesPage } from "./lab-contestacoes-page";

vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: {
    pendencias: vi.fn(),
    contestacoes: vi.fn(),
    analisarContestacao: vi.fn(),
    decidirContestacao: vi.fn()
  }
}));

const api = vi.mocked(labCuradoriaApi);
const abrir = () => renderizar(<LabContestacoesPage />, { rota: "/lab/rh/contestacoes" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

beforeEach(() => {
  vi.resetAllMocks();
  api.pendencias.mockResolvedValue(pendencias());
});

describe("contestações dos participantes", () => {
  it("lista o que foi contestado, por quem, o estado do resultado e o caminho até ele", async () => {
    api.contestacoes.mockResolvedValue([contestacao()]);
    abrir();
    await screen.findByText("O cliente já tinha sido avisado.");
    expect(api.contestacoes).toHaveBeenCalledWith("pendente");
    expect(screen.getByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("Situação 2")).toBeTruthy();
    expect(screen.getByText("Aguardando validação")).toBeTruthy();
    expect(screen.getByText("Aberta")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir o resultado" }).getAttribute("href")).toBe(
      "/lab/rh/revisao/resultado-1"
    );
    expect(screen.getByText(/Deferir\s+anula o teste contestado/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ver as decisões da pessoa" }).getAttribute("href")
    ).toBe("/lab/rh/acompanhamento/pessoas/participante-1");
  });

  it("sem contestações, diz o que aparece aqui", async () => {
    api.contestacoes.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nenhuma contestação aberta");
  });

  it("o filtro pede a lista certa", async () => {
    const usuario = userEvent.setup();
    api.contestacoes.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nenhuma contestação aberta");
    for (const [rotulo, status] of [
      ["Em análise", "em_analise"],
      ["Deferidas", "aceita"],
      ["Indeferidas", "rejeitada"],
      ["Todas", "todas"]
    ] as const) {
      await usuario.selectOptions(screen.getByLabelText("Mostrar"), rotulo);
      await waitFor(() => expect(api.contestacoes).toHaveBeenLastCalledWith(status));
    }
  });

  it("a decidida mostra quem decidiu, quando e a nota, e não oferece decidir de novo", async () => {
    api.contestacoes.mockResolvedValue([
      contestacao({
        status: "rejeitada",
        decididoPor: "Rita",
        decididoEm: "2026-03-03T10:00:00.000Z",
        nota: "Mantida."
      })
    ]);
    abrir();
    await screen.findByText("Indeferida");
    expect(screen.getByText(/Decisão de Rita em .*: Mantida\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Decidir/ })).toBeNull();
  });

  describe("decidir", () => {
    const abrirDecisao = async () => {
      const usuario = userEvent.setup();
      api.contestacoes.mockResolvedValueOnce([contestacao()]).mockResolvedValue([]);
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Decidir a contestação de Ana Souza" })
      );
      return { usuario, dialogo: within(screen.getByRole("dialog")) };
    };

    it("exige escolher a decisão e escrever a justificativa, e não chama o servidor sem as duas", async () => {
      const { usuario, dialogo } = await abrirDecisao();
      await usuario.click(dialogo.getByRole("button", { name: "Registrar decisão" }));
      expect((await dialogo.findByRole("alert")).textContent).toMatch(
        /Escolha se a contestação é deferida ou indeferida/
      );

      await usuario.click(
        dialogo.getByRole("radio", { name: "Deferir a contestação (libera nova tentativa)" })
      );
      await usuario.click(dialogo.getByRole("button", { name: "Registrar decisão" }));
      expect((await dialogo.findByRole("alert")).textContent).toMatch(/Escreva a justificativa/);
      expect(api.decidirContestacao).not.toHaveBeenCalled();
    });

    it.each([
      ["Deferir a contestação (libera nova tentativa)", "aceita"],
      ["Indeferir a contestação", "rejeitada"]
    ] as const)(
      "%s: envia a decisão e a nota, fecha e atualiza a lista",
      async (rotulo, decisao) => {
        const { usuario, dialogo } = await abrirDecisao();
        api.decidirContestacao.mockResolvedValue(
          contestacao({ status: decisao, nota: "Revisamos." })
        );
        await usuario.click(dialogo.getByRole("radio", { name: rotulo }));
        await usuario.type(dialogo.getByLabelText("Justificativa (obrigatória)"), "  Revisamos.  ");
        await usuario.click(dialogo.getByRole("button", { name: "Registrar decisão" }));
        await waitFor(() =>
          expect(api.decidirContestacao).toHaveBeenCalledWith(
            "contestacao-1",
            decisao,
            "Revisamos."
          )
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        await screen.findByText("Nenhuma contestação aberta");
      }
    );

    it("antes da validação, diz que o ajuste de nível se faz ao validar", async () => {
      const { dialogo } = await abrirDecisao();
      expect(dialogo.getByRole("note").textContent).toMatch(/faça o ajuste ao validar o resultado/);
    });

    it("com o resultado já validado, diz que a decisão fica registrada mas o resultado não muda", async () => {
      const usuario = userEvent.setup();
      api.contestacoes.mockResolvedValue([contestacao({ statusValidacao: "validado" })]);
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Decidir a contestação de Ana Souza" })
      );
      expect(within(screen.getByRole("dialog")).getByRole("note").textContent).toMatch(
        /já foi validado.*o resultado não muda/
      );
    });

    it("se o servidor recusar, mostra o motivo e mantém o formulário aberto", async () => {
      const { usuario, dialogo } = await abrirDecisao();
      api.decidirContestacao.mockRejectedValue(
        erroDaApi(409, "LAB_JA_DECIDIDO", "Isto já foi decidido.")
      );
      await usuario.click(
        dialogo.getByRole("radio", { name: "Deferir a contestação (libera nova tentativa)" })
      );
      await usuario.type(dialogo.getByLabelText("Justificativa (obrigatória)"), "Ok.");
      await usuario.click(dialogo.getByRole("button", { name: "Registrar decisão" }));
      expect((await dialogo.findByRole("alert")).textContent).toBe("Isto já foi decidido.");
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("cancelar fecha sem decidir, e abrir de novo começa do zero", async () => {
      const usuario = userEvent.setup();
      api.contestacoes.mockResolvedValue([contestacao()]);
      abrir();
      await usuario.click(
        await screen.findByRole("button", { name: "Decidir a contestação de Ana Souza" })
      );
      const dialogo = within(screen.getByRole("dialog"));
      await usuario.click(dialogo.getByRole("radio", { name: "Indeferir a contestação" }));
      await usuario.type(dialogo.getByLabelText("Justificativa (obrigatória)"), "Começo");
      await usuario.click(dialogo.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(api.decidirContestacao).not.toHaveBeenCalled();

      await usuario.click(
        screen.getByRole("button", { name: "Decidir a contestação de Ana Souza" })
      );
      expect(
        (screen.getByLabelText("Justificativa (obrigatória)") as HTMLTextAreaElement).value
      ).toBe("");
      expect(
        (screen.getByRole("radio", { name: "Indeferir a contestação" }) as HTMLInputElement).checked
      ).toBe(false);
    });
  });
});
