// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import { itemDaRevisao, participanteResumido, pendencias } from "../../../test/dados-da-curadoria";
import { renderizar } from "../../../test/render";
import { LabRevisaoPage } from "./lab-revisao-page";

vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { pendencias: vi.fn(), revisao: vi.fn() }
}));

const api = vi.mocked(labCuradoriaApi);
const abrir = () => renderizar(<LabRevisaoPage />, { rota: "/lab/rh/revisao" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

beforeEach(() => {
  vi.resetAllMocks();
  api.pendencias.mockResolvedValue(pendencias());
});

describe("revisão dos resultados (fila)", () => {
  it("enquanto carrega, mostra o estado de carregamento", () => {
    api.revisao.mockReturnValue(new Promise(() => undefined));
    abrir();
    expect(screen.getByLabelText("Carregando")).toBeTruthy();
  });

  it("pede, por padrão, os que aguardam validação", async () => {
    api.revisao.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nada aguardando validação");
    expect(api.revisao).toHaveBeenCalledWith("aguardando_validacao");
  });

  it("lista quem é, o teste, os números, as pendências e leva à ficha", async () => {
    api.revisao.mockResolvedValue([
      itemDaRevisao({ alertasAbertos: 2, contestacoesPendentes: 1 }),
      itemDaRevisao({
        resultadoId: "resultado-2",
        participante: participanteResumido({
          id: "p2",
          nome: "Bruno Lima",
          identificador: "MAT-002",
          cargo: null
        })
      })
    ]);
    abrir();
    const linha = (await screen.findByText("Ana Souza")).closest("tr")!;
    expect(
      within(linha).getByText(/Matrícula MAT-001 · Supervisor de campo · Operação Norte/)
    ).toBeTruthy();
    expect(within(linha).getByText("Supervisor")).toBeTruthy();
    expect(within(linha).getByText("76%")).toBeTruthy();
    expect(within(linha).getByText("88,3%")).toBeTruthy();
    expect(within(linha).getByText("2 alertas")).toBeTruthy();
    expect(within(linha).getByText("1 contestação")).toBeTruthy();
    expect(within(linha).getByText("Aguardando validação")).toBeTruthy();
    const link = within(linha).getByRole("link", { name: "Revisar o resultado de Ana Souza" });
    expect(link.getAttribute("href")).toBe("/lab/rh/revisao/resultado-1");

    const outra = screen.getByText("Bruno Lima").closest("tr")!;
    expect(within(outra).getByText(/Sem cargo/)).toBeTruthy();
    expect(within(outra).getByText("—")).toBeTruthy();
  });

  it("os já validados mostram 'Abrir' em vez de 'Revisar'", async () => {
    api.revisao.mockResolvedValue([itemDaRevisao({ statusValidacao: "ajustado" })]);
    abrir();
    const linha = (await screen.findByText("Ana Souza")).closest("tr")!;
    expect(within(linha).getByText("Validado com ajuste")).toBeTruthy();
    expect(within(linha).getByRole("link").textContent).toBe("Abrir");
  });

  it("trocar o filtro pede a lista certa, com um texto vazio próprio de cada filtro", async () => {
    const usuario = userEvent.setup();
    api.revisao.mockResolvedValue([]);
    abrir();
    await screen.findByText("Nada aguardando validação");
    for (const [rotulo, status, titulo] of [
      ["Validados", "validado", "Nenhum resultado validado ainda"],
      ["Validados com ajuste", "ajustado", "Nenhum resultado ajustado ainda"],
      ["Todos", "todos", "Nenhum resultado ainda"]
    ] as const) {
      await usuario.selectOptions(screen.getByLabelText("Mostrar"), rotulo);
      await screen.findByText(titulo);
      expect(api.revisao).toHaveBeenLastCalledWith(status);
    }
  });

  it("perfil sem acesso diz que a área não é dele, sem tentar de novo", async () => {
    api.revisao.mockRejectedValue(erroDaApi(403, "LAB_FORBIDDEN"));
    abrir();
    await screen.findByText("Esta área não é para o seu perfil");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });

  it("falha do servidor oferece tentar de novo, e funciona", async () => {
    api.revisao.mockRejectedValueOnce(erroDaApi(500)).mockRejectedValueOnce(erroDaApi(500));
    api.revisao.mockResolvedValue([itemDaRevisao()]);
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Ana Souza");
  });

  describe("as abas e os números de pendências", () => {
    it("mostram quanto espera uma decisão, e só onde há algo", async () => {
      api.revisao.mockResolvedValue([]);
      api.pendencias.mockResolvedValue(
        pendencias({
          resultadosAguardando: 3,
          alertasAbertos: 1,
          contestacoesPendentes: 0,
          contribuicoesPendentes: 12
        })
      );
      abrir();
      const abas = within(screen.getByRole("navigation", { name: "Áreas do acompanhamento" }));
      await waitFor(() =>
        expect(abas.getByRole("link", { name: "Revisão (3 pendentes)" })).toBeTruthy()
      );
      expect(abas.getByRole("link", { name: "Alertas (1 pendente)" })).toBeTruthy();
      expect(abas.getByRole("link", { name: "Contribuições (12 pendentes)" })).toBeTruthy();
      // Zero não ganha número.
      expect(abas.getByRole("link", { name: "Contestações" })).toBeTruthy();
      expect(abas.getByRole("link", { name: "Participantes" })).toBeTruthy();
      expect(abas.getByRole("link", { name: "Turmas" })).toBeTruthy();
    });

    it("apontam para as telas certas, na ordem: o resumo, o que pede decisão e o cadastro", async () => {
      api.revisao.mockResolvedValue([]);
      abrir();
      const links = within(
        screen.getByRole("navigation", { name: "Áreas do acompanhamento" })
      ).getAllByRole("link");
      expect(links.map((l) => l.getAttribute("href"))).toEqual([
        "/lab/rh/visao-geral",
        "/lab/rh/revisao",
        "/lab/rh/alertas",
        "/lab/rh/contestacoes",
        "/lab/rh/contribuicoes",
        "/lab/rh/participantes",
        "/lab/rh/turmas"
      ]);
    });

    it("se os números não chegarem, as abas continuam lá, sem eles", async () => {
      api.pendencias.mockRejectedValue(erroDaApi(500));
      api.revisao.mockResolvedValue([]);
      abrir();
      await screen.findByText("Nada aguardando validação");
      const abas = within(screen.getByRole("navigation", { name: "Áreas do acompanhamento" }));
      expect(abas.getByRole("link", { name: "Revisão" })).toBeTruthy();
    });
  });
});
