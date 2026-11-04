// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../my-flux/client";
import { contestacaoPropria } from "../../../test/dados-da-curadoria";
import { resultado } from "../../../test/dados-do-lab";
import { renderizar } from "../../../test/render";
import { labCuradoriaApi } from "../curadoria-api";
import { ContestarResultado } from "./contestar-resultado";

vi.mock("../curadoria-api", () => ({
  labCuradoriaApi: { minhasContestacoes: vi.fn(), contestar: vi.fn() }
}));

const api = vi.mocked(labCuradoriaApi);
const dados = resultado();
const abrir = () => renderizar(<ContestarResultado resultado={dados} />);
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

beforeEach(() => {
  vi.resetAllMocks();
  api.minhasContestacoes.mockResolvedValue([]);
});

describe("contestar o resultado (participante)", () => {
  it("pede as contestações do próprio resultado", async () => {
    abrir();
    await screen.findByLabelText("O que você contesta");
    expect(api.minhasContestacoes).toHaveBeenCalledWith(dados.resultadoId);
  });

  it("oferece o resultado geral, cada situação e cada skill como ponto contestado", async () => {
    abrir();
    const seletor = (await screen.findByLabelText("O que você contesta")) as HTMLSelectElement;
    const opcoes = within(seletor)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes[0]).toBe("Resultado geral");
    for (const situacao of dados.situacoes) expect(opcoes).toContain(`Situação ${situacao.numero}`);
    for (const skill of dados.niveisPorSkill) expect(opcoes).toContain(`Nível de ${skill.nome}`);
    expect(seletor.value).toBe("Resultado geral");
  });

  it("envia o ponto e o motivo (sem os espaços das pontas), limpa o formulário e avisa", async () => {
    const usuario = userEvent.setup();
    api.contestar.mockResolvedValue(contestacaoPropria());
    api.minhasContestacoes.mockResolvedValueOnce([]).mockResolvedValue([contestacaoPropria()]);
    abrir();
    await usuario.selectOptions(await screen.findByLabelText("O que você contesta"), "Situação 1");
    await usuario.type(screen.getByLabelText(/Por quê/), "  Discordo da avaliação.  ");
    await usuario.click(screen.getByRole("button", { name: "Enviar contestação" }));

    await waitFor(() =>
      expect(api.contestar).toHaveBeenCalledWith(dados.resultadoId, {
        ponto: "Situação 1",
        motivo: "Discordo da avaliação."
      })
    );
    expect((await screen.findByRole("status")).textContent).toMatch(/Contestação enviada/);
    expect((screen.getByLabelText(/Por quê/) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("O que você contesta") as HTMLSelectElement).value).toBe(
      "Resultado geral"
    );
    // A nova contestação aparece na lista, em análise.
    await screen.findByText("Suas contestações");
    expect(screen.getByText("Em análise")).toBeTruthy();
  });

  it("sem o motivo, não chama o servidor e diz o que falta", async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.type(await screen.findByLabelText(/Por quê/), "    ");
    await usuario.click(screen.getByRole("button", { name: "Enviar contestação" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Conte o motivo/);
    expect(api.contestar).not.toHaveBeenCalled();
  });

  it("mostra o limite de caracteres do motivo", async () => {
    const usuario = userEvent.setup();
    abrir();
    const motivo = (await screen.findByLabelText(/Por quê/)) as HTMLTextAreaElement;
    expect(motivo.maxLength).toBe(1000);
    await usuario.type(motivo, "abc");
    expect(screen.getByText(/3\/1000/)).toBeTruthy();
  });

  it("se o servidor recusar, mostra o motivo e mantém o que foi escrito", async () => {
    const usuario = userEvent.setup();
    api.contestar.mockRejectedValue(erroDaApi(500));
    abrir();
    await usuario.type(await screen.findByLabelText(/Por quê/), "Discordo.");
    await usuario.click(screen.getByRole("button", { name: "Enviar contestação" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Tente de novo em instantes/);
    expect((screen.getByLabelText(/Por quê/) as HTMLTextAreaElement).value).toBe("Discordo.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  describe("as contestações dele", () => {
    it("mostra cada uma, o estado e a resposta do RH, sem dizer quem respondeu", async () => {
      api.minhasContestacoes.mockResolvedValue([
        contestacaoPropria({ id: "c1", status: "pendente" }),
        contestacaoPropria({
          id: "c2",
          ponto: "Resultado geral",
          status: "aceita",
          nota: "Revisamos e você tem razão.",
          decididoEm: "2026-03-03T10:00:00.000Z"
        }),
        contestacaoPropria({ id: "c3", status: "rejeitada", nota: "Mantida a avaliação." })
      ]);
      abrir();
      await screen.findByText("Suas contestações");
      expect(screen.getByText("Em análise")).toBeTruthy();
      expect(screen.getByText("Aceita")).toBeTruthy();
      expect(screen.getByText("Rejeitada")).toBeTruthy();
      expect(screen.getByText(/Revisamos e você tem razão\./).textContent).toContain(
        "Resposta do RH:"
      );
      expect(screen.getByText(/Mantida a avaliação\./)).toBeTruthy();
      expect(screen.getAllByText(/Resposta do RH:/)).toHaveLength(2);
      expect(document.body.textContent).not.toMatch(/decidid/i);
    });

    it("sem contestações, não mostra a lista", async () => {
      abrir();
      await screen.findByLabelText("O que você contesta");
      expect(screen.queryByText("Suas contestações")).toBeNull();
    });

    it("se a lista não carregar, avisa sem derrubar o formulário", async () => {
      api.minhasContestacoes.mockRejectedValue(erroDaApi(500));
      abrir();
      expect(
        (await screen.findByText(/Não foi possível carregar as suas contestações/)).textContent
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Enviar contestação" })).toBeTruthy();
    });
  });
});
