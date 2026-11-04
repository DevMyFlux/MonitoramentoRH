// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import {
  alerta,
  contestacao,
  contribuicao,
  ficha,
  pendencias,
  situacaoDaFicha
} from "../../../test/dados-da-curadoria";
import { renderizar } from "../../../test/render";
import { LabFichaPage } from "./lab-ficha-page";

vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { pendencias: vi.fn(), ficha: vi.fn(), validar: vi.fn() }
}));

const api = vi.mocked(labCuradoriaApi);
const abrir = () =>
  renderizar(<LabFichaPage />, {
    rota: "/lab/rh/revisao/resultado-1",
    caminho: "/lab/rh/revisao/:resultadoId"
  });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

const nivelDe = (skill: string) =>
  screen.getByLabelText(`Nível validado de ${skill}`) as HTMLSelectElement;

beforeEach(() => {
  vi.resetAllMocks();
  api.pendencias.mockResolvedValue(pendencias());
});

describe("ficha de revisão do resultado", () => {
  describe("o que mostra", () => {
    it("quem é, o teste, os números e o resumo", async () => {
      api.ficha.mockResolvedValue(ficha());
      abrir();
      await screen.findByText("Ana Souza");
      expect(api.ficha).toHaveBeenCalledWith("resultado-1");
      expect(
        screen.getByText(/Matrícula MAT-001 · Supervisor de campo · Operação Norte/)
      ).toBeTruthy();
      expect(screen.getByText(/Teste Supervisor · concluído em/)).toBeTruthy();
      expect(screen.getByText("76%")).toBeTruthy();
      expect(screen.getByText("88,3%")).toBeTruthy();
      expect(screen.getByText("Orientação")).toBeTruthy();
      expect(screen.getByText("Flexibilidade").parentElement?.textContent).toContain("Média");
      expect(screen.getByText("Você conduziu o turno com atenção.")).toBeTruthy();
      expect(screen.getByText("Comunicação.")).toBeTruthy();
      expect(screen.getByRole("link", { name: /Voltar à revisão/ }).getAttribute("href")).toBe(
        "/lab/rh/revisao"
      );
    });

    it("cada situação, com a escolha, a aderência e a avaliação, aberta ao clicar", async () => {
      api.ficha.mockResolvedValue(
        ficha({
          situacoes: [
            situacaoDaFicha(1),
            situacaoDaFicha(2, {
              escolha: "C",
              aderencia: 10,
              alertaVermelho: true,
              estilo: "direcao"
            })
          ]
        })
      );
      abrir();
      const segunda = (await screen.findByText("Situação 2")).closest("details")!;
      expect(within(segunda).getByText("Aderência 10%")).toBeTruthy();
      expect(within(segunda).getByText("Alerta vermelho")).toBeTruthy();
      expect(within(segunda).getByText("Escolheu C")).toBeTruthy();
      expect(within(segunda).getByText("Avaliação da situação 2.")).toBeTruthy();
      expect(within(segunda).getByText(/Cenário da situação 2\./)).toBeTruthy();
      expect(within(segunda).getByText(/C\. Esperar o cliente\. \(escolhida\)/)).toBeTruthy();
      expect(within(segunda).getByText(/estilo Direção/)).toBeTruthy();
    });

    it("situação sem resposta diz que o tempo acabou, sem inventar escolha", async () => {
      api.ficha.mockResolvedValue(
        ficha({
          situacoes: [
            situacaoDaFicha(1, {
              escolha: null,
              tempoEsgotado: true,
              aderencia: 0,
              tempoRespostaMs: null,
              estilo: null
            })
          ]
        })
      );
      abrir();
      const item = (await screen.findByText("Situação 1")).closest("details")!;
      expect(within(item).getByText("Sem resposta")).toBeTruthy();
      expect(within(item).getByText("O tempo acabou sem resposta.")).toBeTruthy();
    });

    it("alerta, contribuição e contestação do resultado, com a decisão e a nota", async () => {
      api.ficha.mockResolvedValue(
        ficha({
          alertas: [alerta({ status: "encerrado", nota: "Conversamos.", tratadoPor: "Rita" })],
          contribuicoes: [contribuicao({ status: "aprovada" })],
          contestacoes: [
            contestacao({ status: "rejeitada", nota: "Mantida a nota.", decididoPor: "Rita" })
          ]
        })
      );
      abrir();
      await screen.findByText("Alertas deste teste");
      expect(screen.getByText("Nota: Conversamos.")).toBeTruthy();
      expect(screen.getByText("Sugiro um checklist de abertura do turno.")).toBeTruthy();
      expect(screen.getByText("Decisão de Rita: Mantida a nota.")).toBeTruthy();
    });

    it("avisa, com o caminho, das contestações pendentes e dos alertas abertos", async () => {
      api.ficha.mockResolvedValue(
        ficha({ alertas: [alerta()], contestacoes: [contestacao(), contestacao({ id: "c2" })] })
      );
      abrir();
      const aviso = await screen.findByRole("note");
      expect(within(aviso).getByText(/2 contestações pendentes neste resultado/)).toBeTruthy();
      expect(
        within(aviso).getByRole("link", { name: "Ir para as contestações" }).getAttribute("href")
      ).toBe("/lab/rh/contestacoes");
      expect(within(aviso).getByText(/1 alerta aberto deste teste/)).toBeTruthy();
      expect(
        within(aviso).getByRole("link", { name: "Ir para os alertas" }).getAttribute("href")
      ).toBe("/lab/rh/alertas");
    });

    it("resultado de fora da turma ou inexistente: o mesmo aviso, com voltar", async () => {
      api.ficha.mockRejectedValue(erroDaApi(404, "LAB_NOT_FOUND"));
      abrir();
      await screen.findByText("Registro não encontrado");
      expect(screen.getByRole("link", { name: /Voltar à revisão/ })).toBeTruthy();
    });
  });

  describe("validar", () => {
    it("o nível de cada skill nasce igual ao calculado, e validar sem ajuste pede só a confirmação", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      api.validar.mockResolvedValue(ficha({ statusValidacao: "validado" }));
      abrir();
      await screen.findByText("Ana Souza");
      expect(nivelDe("Gestão de OS e prioridades").value).toBe("4");
      expect(nivelDe("Delegação").value).toBe("2");

      await usuario.click(screen.getByRole("button", { name: "Validar resultado" }));
      const dialogo = within(screen.getByRole("dialog"));
      expect(dialogo.getByText(/Uma validação não se refaz/)).toBeTruthy();
      expect(api.validar).not.toHaveBeenCalled();

      await usuario.click(dialogo.getByRole("button", { name: "Validar resultado" }));
      await waitFor(() => expect(api.validar).toHaveBeenCalledWith("resultado-1", { ajustes: [] }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("uma observação sem ajuste vai junto; em branco, não vai", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      api.validar.mockResolvedValue(ficha({ statusValidacao: "validado" }));
      abrir();
      await usuario.type(await screen.findByLabelText(/Justificativa/), "  Conferido.  ");
      await usuario.click(screen.getByRole("button", { name: "Validar resultado" }));
      await usuario.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Validar resultado" })
      );
      await waitFor(() =>
        expect(api.validar).toHaveBeenCalledWith("resultado-1", {
          ajustes: [],
          justificativa: "Conferido."
        })
      );
    });

    it("mudar um nível marca o ajuste, troca o botão e exige a justificativa antes de chamar o servidor", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      abrir();
      await screen.findByText("Ana Souza");
      await usuario.selectOptions(nivelDe("Delegação"), "3");
      expect(screen.getByText("Ajuste")).toBeTruthy();
      expect(screen.getByLabelText(/obrigatória: você mudou algum nível/)).toBeTruthy();

      await usuario.click(screen.getByRole("button", { name: "Validar com 1 ajuste" }));
      expect((await screen.findByRole("alert")).textContent).toMatch(/Explique o ajuste/);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(api.validar).not.toHaveBeenCalled();
    });

    it("com ajuste e justificativa: confirma e envia só as skills mudadas", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      api.validar.mockResolvedValue(
        ficha({
          statusValidacao: "ajustado",
          skills: ficha().skills.map((s) => ({
            ...s,
            nivelValidado: s.skillId === "delegacao" ? 3 : s.nivelCalculado
          })),
          validacao: {
            validadoPor: "Rita",
            validadoEm: "2026-03-02T13:00:00.000Z",
            justificativa: "Na conversa, delegou bem."
          }
        })
      );
      abrir();
      await screen.findByText("Ana Souza");
      await usuario.selectOptions(nivelDe("Delegação"), "3");
      await usuario.type(screen.getByLabelText(/Justificativa/), "Na conversa, delegou bem.");
      await usuario.click(screen.getByRole("button", { name: "Validar com 1 ajuste" }));
      const dialogo = within(screen.getByRole("dialog"));
      expect(dialogo.getByText(/Você trocou o nível de 1 skill/)).toBeTruthy();
      await usuario.click(dialogo.getByRole("button", { name: "Validar com ajuste" }));

      await waitFor(() =>
        expect(api.validar).toHaveBeenCalledWith("resultado-1", {
          ajustes: [{ skillId: "delegacao", nivel: 3 }],
          justificativa: "Na conversa, delegou bem."
        })
      );
      // A ficha passa a mostrar a validação, sem formulário.
      await screen.findByText(/por Rita/);
      expect(screen.getByText(/Justificativa:/).closest("p")?.textContent).toContain(
        "Na conversa, delegou bem."
      );
      expect(screen.queryByRole("button", { name: /Validar/ })).toBeNull();
      expect(screen.getByText("Ajustado")).toBeTruthy();
    });

    it("dois ajustes: o botão e a confirmação dizem quantos", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      abrir();
      await screen.findByText("Ana Souza");
      await usuario.selectOptions(nivelDe("Delegação"), "3");
      await usuario.selectOptions(nivelDe("Gestão de OS e prioridades"), "5");
      await usuario.type(screen.getByLabelText(/Justificativa/), "Motivo.");
      await usuario.click(screen.getByRole("button", { name: "Validar com 2 ajustes" }));
      expect(
        within(screen.getByRole("dialog")).getByText(/Você trocou o nível de 2 skills/)
      ).toBeTruthy();
    });

    it("voltar o nível ao calculado desfaz o ajuste", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      abrir();
      await screen.findByText("Ana Souza");
      await usuario.selectOptions(nivelDe("Delegação"), "3");
      await usuario.selectOptions(nivelDe("Delegação"), "2");
      expect(screen.queryByText("Ajuste")).toBeNull();
      expect(screen.getByRole("button", { name: "Validar resultado" })).toBeTruthy();
    });

    it("se o servidor recusar, a confirmação fica aberta e mostra o motivo", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      api.validar.mockRejectedValue(
        erroDaApi(
          409,
          "LAB_RESULTADO_JA_VALIDADO",
          "Este resultado já foi validado. Uma validação não se refaz."
        )
      );
      abrir();
      await usuario.click(await screen.findByRole("button", { name: "Validar resultado" }));
      await usuario.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Validar resultado" })
      );
      const alerta = await within(screen.getByRole("dialog")).findByRole("alert");
      expect(alerta.textContent).toBe(
        "Este resultado já foi validado. Uma validação não se refaz."
      );
    });

    it("cancelar a confirmação não valida nada", async () => {
      const usuario = userEvent.setup();
      api.ficha.mockResolvedValue(ficha());
      abrir();
      await usuario.click(await screen.findByRole("button", { name: "Validar resultado" }));
      await usuario.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(api.validar).not.toHaveBeenCalled();
    });

    it("resultado já validado: só leitura, com quem validou, quando e a justificativa; sem formulário", async () => {
      api.ficha.mockResolvedValue(
        ficha({
          statusValidacao: "ajustado",
          skills: ficha().skills.map((s) => ({
            ...s,
            nivelValidado: s.skillId === "delegacao" ? 3 : s.nivelCalculado
          })),
          validacao: {
            validadoPor: "Rita",
            validadoEm: "2026-03-02T13:00:00.000Z",
            justificativa: "Ajustei."
          }
        })
      );
      abrir();
      await screen.findByText(/por Rita/);
      expect(screen.queryByRole("button", { name: /Validar/ })).toBeNull();
      expect(screen.queryByLabelText(/Nível validado de/)).toBeNull();
      expect(screen.getByText("3/5", { selector: "span" })).toBeTruthy();
      expect(screen.getAllByText("Ajustado")).toHaveLength(1);
    });
  });
});
