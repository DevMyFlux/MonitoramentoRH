// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labApi } from "../../features/leadership-lab/api";
import { chaves } from "../../features/leadership-lab/hooks";
import { ApiError } from "../../features/my-flux/client";
import { respostaDeResultado, respostaDeSituacao } from "../../test/dados-do-lab";
import { renderizar } from "../../test/render";
import { LabTestePage } from "./lab-teste-page";

vi.mock("../../features/leadership-lab/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../features/leadership-lab/api")>();
  return {
    ...original,
    labApi: {
      painel: vi.fn(),
      aceitarTermo: vi.fn(),
      iniciarTeste: vi.fn(),
      testeEmAndamento: vi.fn(),
      responder: vi.fn(),
      tempoEsgotado: vi.fn(),
      resultado: vi.fn()
    }
  };
});

const api = vi.mocked(labApi);
const abrir = () => renderizar(<LabTestePage />, { rota: "/lab/teste" });
const erroDaApi = (status: number, code: string, message = "Mensagem.", details = {}) =>
  new ApiError(message, status, code, details);
const escolher = async (usuario: ReturnType<typeof userEvent.setup>, letra: string) =>
  usuario.click(screen.getByRole("radio", { name: new RegExp(`^${letra}\\.`) }));
const confirmar = (usuario: ReturnType<typeof userEvent.setup>) =>
  usuario.click(screen.getByRole("button", { name: "Confirmar resposta" }));
const adiado = <T,>() => {
  let resolver: (valor: T) => void = () => undefined;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("tela do teste", () => {
  describe("ao abrir", () => {
    it("só LÊ o teste em andamento: nunca chama a API que inicia um teste", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      abrir();
      await screen.findByText("Texto da situação 1.");
      expect(api.testeEmAndamento).toHaveBeenCalledOnce();
      expect(api.iniciarTeste).not.toHaveBeenCalled();
    });

    it("mostra a situação, as três opções, o mapa do caminho e o cronômetro, e nada de aderência", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(2));
      abrir();
      await screen.findByText("Texto da situação 2.");

      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(screen.getByText("Situação 2 de 5")).toBeTruthy();
      expect(screen.getByRole("timer")).toBeTruthy();
      expect(screen.queryByText(/aderência/i)).toBeNull();
      expect(document.body.textContent).not.toMatch(/estilo|justificativa/i);
    });

    it("a consequência da escolha anterior vem antes da situação nova", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(2));
      abrir();
      await screen.findByText("O que aconteceu depois da sua escolha");
      expect(screen.getByText("Consequência da escolha anterior (1).")).toBeTruthy();
    });

    it("a primeira situação não tem consequência", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      abrir();
      await screen.findByText("Texto da situação 1.");
      expect(screen.queryByText("O que aconteceu depois da sua escolha")).toBeNull();
    });

    it("sem teste em andamento: avisa e oferece voltar ao painel", async () => {
      api.testeEmAndamento.mockRejectedValue(erroDaApi(404, "LAB_SEM_TESTE_EM_ANDAMENTO"));
      abrir();
      await screen.findByText("Você não tem um teste em andamento");
      expect(screen.getByRole("link", { name: "Voltar ao painel" }).getAttribute("href")).toBe(
        "/lab"
      );
      expect(api.iniciarTeste).not.toHaveBeenCalled();
    });

    it("módulo desligado: avisa", async () => {
      api.testeEmAndamento.mockRejectedValue(
        new ApiError("Rota nao encontrada.", 404, "NOT_FOUND")
      );
      abrir();
      await screen.findByText("O Leadership Lab ainda não está ativo");
    });

    it("falha de rede: oferece tentar de novo", async () => {
      api.testeEmAndamento
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValue(respostaDeSituacao(1));
      abrir();
      await screen.findByText("Sem conexão com o servidor");
      await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
      await screen.findByText("Texto da situação 1.");
    });
  });

  describe("responder", () => {
    it("envia número, letra e nada mais; mostra a situação seguinte com a consequência", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      api.responder.mockResolvedValue(respostaDeSituacao(2));
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");

      await escolher(usuario, "B");
      await confirmar(usuario);

      await screen.findByText("Texto da situação 2.");
      expect(api.responder).toHaveBeenCalledOnce();
      expect(api.responder).toHaveBeenCalledWith("sessao-1", { numero: 1, escolha: "B" });
      expect(screen.getByText("Consequência da escolha anterior (1).")).toBeTruthy();
      // A situação nova começa sem nada marcado.
      for (const radio of screen.getAllByRole("radio"))
        expect((radio as HTMLInputElement).checked).toBe(false);
    });

    it("o campo livre vai sem espaços nas pontas, e em branco nem vai", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      api.responder.mockResolvedValue(respostaDeSituacao(2));
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");

      await escolher(usuario, "A");
      await usuario.type(screen.getByLabelText(/O que mais você faria/), "  Chamaria o time.  ");
      await confirmar(usuario);
      await screen.findByText("Texto da situação 2.");
      expect(api.responder).toHaveBeenLastCalledWith("sessao-1", {
        numero: 1,
        escolha: "A",
        textoLivre: "Chamaria o time."
      });

      api.responder.mockResolvedValue(respostaDeSituacao(3));
      await escolher(usuario, "C");
      await usuario.type(screen.getByLabelText(/O que mais você faria/), "   ");
      await confirmar(usuario);
      await screen.findByText("Texto da situação 3.");
      expect(api.responder).toHaveBeenLastCalledWith("sessao-1", { numero: 2, escolha: "C" });
    });

    it("enquanto envia, nada pode ser alterado nem enviado de novo", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      const pendente = adiado<ReturnType<typeof respostaDeSituacao>>();
      api.responder.mockReturnValue(pendente.promessa);
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");
      await escolher(usuario, "A");
      await confirmar(usuario);

      await screen.findByText("Enviando sua resposta...");
      const botao = screen.getByRole("button", { name: "Confirmar resposta" }) as HTMLButtonElement;
      expect(botao.disabled).toBe(true);
      await usuario.click(botao);
      await usuario.keyboard("2{Enter}");
      expect(api.responder).toHaveBeenCalledOnce();
      expect(screen.getByRole("radio", { name: /^A\./ }).matches(":disabled")).toBe(true);

      await act(async () => pendente.resolver(respostaDeSituacao(2)));
      await screen.findByText("Texto da situação 2.");
    });

    it("a última resposta leva ao resultado, que já fica em cache, e o painel é atualizado", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(5));
      api.responder.mockResolvedValue(respostaDeResultado());
      const { cliente } = abrir();
      const invalidar = vi.spyOn(cliente, "invalidateQueries");
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 5.");

      await escolher(usuario, "A");
      await confirmar(usuario);

      await waitFor(() =>
        expect(screen.getByTestId("local").textContent).toBe("/lab/resultado/sessao-1")
      );
      expect(cliente.getQueryData(chaves.resultado("sessao-1"))).toMatchObject({
        resultadoId: "resultado-1"
      });
      expect(invalidar).toHaveBeenCalledWith({ queryKey: chaves.painel });
      // O teste em andamento deixou de existir: não é lido de novo.
      expect(api.testeEmAndamento).toHaveBeenCalledOnce();
    });

    it("se a resposta chegou fora do prazo, a situação seguinte vem com o aviso de omissão", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      api.responder.mockResolvedValue(respostaDeSituacao(2, { tempoEsgotadoNaAnterior: true }));
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");
      await escolher(usuario, "A");
      await confirmar(usuario);

      const aviso = await screen.findByRole("status");
      expect(aviso.textContent).toBe(
        "O tempo da situação anterior acabou, então ela foi contada como sem resposta."
      );
    });
  });

  describe("quando algo falha ao enviar", () => {
    it("falha da IA: a escolha continua marcada e tentar de novo reenvia exatamente a mesma resposta", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      api.responder
        .mockRejectedValueOnce(erroDaApi(502, "LAB_IA_INDISPONIVEL"))
        .mockResolvedValue(respostaDeSituacao(2));
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");
      await escolher(usuario, "C");
      await usuario.type(screen.getByLabelText(/O que mais você faria/), "Texto.");
      await confirmar(usuario);

      const alerta = await screen.findByRole("alert");
      expect(within(alerta).getByText("O serviço de IA não respondeu")).toBeTruthy();
      expect(within(alerta).getByText("Reenviar a mesma resposta é seguro.")).toBeTruthy();
      expect((screen.getByRole("radio", { name: /^C\./ }) as HTMLInputElement).checked).toBe(true);

      await usuario.click(within(alerta).getByRole("button", { name: "Tentar de novo" }));

      await screen.findByText("Texto da situação 2.");
      expect(api.responder).toHaveBeenCalledTimes(2);
      expect(api.responder.mock.calls[1]).toEqual(api.responder.mock.calls[0]);
    });

    it("sem conexão: oferece tentar de novo", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      api.responder
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValue(respostaDeSituacao(2));
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");
      await escolher(usuario, "A");
      await confirmar(usuario);

      const alerta = await screen.findByRole("alert");
      expect(within(alerta).getByText("Sem conexão com o servidor")).toBeTruthy();
      await usuario.click(within(alerta).getByRole("button", { name: "Tentar de novo" }));
      await screen.findByText("Texto da situação 2.");
    });

    it("tela desatualizada (a situação mudou no servidor): avisa e recarrega o estado", async () => {
      api.testeEmAndamento
        .mockResolvedValueOnce(respostaDeSituacao(1))
        .mockResolvedValue(respostaDeSituacao(3));
      api.responder.mockRejectedValue(
        erroDaApi(409, "LAB_TURNO_FORA_DE_ORDEM", "x", { situacaoEmAndamento: 3 })
      );
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");
      await escolher(usuario, "A");
      await confirmar(usuario);

      await screen.findByText("Texto da situação 3.");
      expect(screen.getByText(/Esta tela estava desatualizada/)).toBeTruthy();
      expect(api.testeEmAndamento).toHaveBeenCalledTimes(2);
    });

    it("teste encerrado ou que não é seu: avisa e oferece voltar ao painel (sem tentar de novo)", async () => {
      api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
      api.responder.mockRejectedValue(erroDaApi(409, "LAB_SESSAO_ENCERRADA"));
      abrir();
      const usuario = userEvent.setup();
      await screen.findByText("Texto da situação 1.");
      await escolher(usuario, "A");
      await confirmar(usuario);

      const alerta = await screen.findByRole("alert");
      expect(within(alerta).getByText("Este teste foi encerrado")).toBeTruthy();
      expect(within(alerta).queryByRole("button", { name: "Tentar de novo" })).toBeNull();
      expect(within(alerta).getByRole("link", { name: "Voltar ao painel" })).toBeTruthy();
    });
  });

  describe("tempo esgotado", () => {
    it("se a situação já chegou sem tempo (recarregou depois do prazo), avisa o servidor uma vez e segue", async () => {
      api.testeEmAndamento.mockResolvedValue(
        respostaDeSituacao(1, { situacao: { tempoRestanteMs: 0 } })
      );
      api.tempoEsgotado.mockResolvedValue(respostaDeSituacao(2, { tempoEsgotadoNaAnterior: true }));
      abrir();

      await screen.findByText("Texto da situação 2.");
      expect(api.tempoEsgotado).toHaveBeenCalledOnce();
      expect(api.tempoEsgotado).toHaveBeenCalledWith("sessao-1", 1);
      expect(api.responder).not.toHaveBeenCalled();
      expect(screen.getByText(/ela foi contada como sem resposta/)).toBeTruthy();
    });

    it("enquanto o servidor confere, a tela fica travada e diz o que está acontecendo", async () => {
      api.testeEmAndamento.mockResolvedValue(
        respostaDeSituacao(1, { situacao: { tempoRestanteMs: 0 } })
      );
      const pendente = adiado<ReturnType<typeof respostaDeSituacao>>();
      api.tempoEsgotado.mockReturnValue(pendente.promessa);
      abrir();

      await screen.findByText("O tempo acabou. Registrando...");
      expect(
        (screen.getByRole("button", { name: "Confirmar resposta" }) as HTMLButtonElement).disabled
      ).toBe(true);
      expect(screen.getByRole("radio", { name: /^A\./ }).matches(":disabled")).toBe(true);

      await act(async () =>
        pendente.resolver(respostaDeSituacao(2, { tempoEsgotadoNaAnterior: true }))
      );
      await screen.findByText("Texto da situação 2.");
    });

    it("se o relógio do navegador adiantou (o servidor diz que ainda há tempo), a tela volta a contar pelo do servidor", async () => {
      api.testeEmAndamento.mockResolvedValue(
        respostaDeSituacao(1, { situacao: { tempoRestanteMs: 0 } })
      );
      api.tempoEsgotado.mockRejectedValue(
        erroDaApi(409, "LAB_TEMPO_NAO_ESGOTADO", "x", { tempoRestanteMs: 45_000 })
      );
      abrir();

      await waitFor(() => expect(screen.getByRole("timer").textContent).toBe("0:45"));
      // Pode responder de novo: nada ficou travado e nenhum erro apareceu.
      expect(
        (screen.getByRole("radio", { name: /^A\./ }) as HTMLInputElement).matches(":disabled")
      ).toBe(false);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(api.tempoEsgotado).toHaveBeenCalledOnce();
    });
  });

  describe("resposta guardada, mas ainda não avaliada pela IA", () => {
    const emProcessamento = {
      tipo: "em-processamento",
      sessaoId: "sessao-1",
      numero: 2,
      totalSituacoes: 5
    } as const;

    it("explica que nada se perdeu e continua o teste com um clique, só então chamando a API que retoma", async () => {
      api.testeEmAndamento.mockResolvedValue(emProcessamento);
      api.iniciarTeste.mockResolvedValue(respostaDeSituacao(3));
      abrir();
      await screen.findByText("Sua resposta foi guardada");
      expect(screen.getByText(/Você respondeu a situação 2/)).toBeTruthy();
      // Só ler, até o clique.
      expect(api.iniciarTeste).not.toHaveBeenCalled();

      await userEvent.setup().click(screen.getByRole("button", { name: "Continuar teste" }));

      await screen.findByText("Texto da situação 3.");
      expect(api.iniciarTeste).toHaveBeenCalledOnce();
    });

    it("se a IA falhar de novo, mostra o motivo e deixa tentar mais uma vez", async () => {
      api.testeEmAndamento.mockResolvedValue(emProcessamento);
      api.iniciarTeste
        .mockRejectedValueOnce(erroDaApi(502, "LAB_IA_INDISPONIVEL"))
        .mockResolvedValue(respostaDeSituacao(3));
      abrir();
      const usuario = userEvent.setup();
      await usuario.click(await screen.findByRole("button", { name: "Continuar teste" }));

      await screen.findByText(/O serviço de IA não respondeu/);
      await usuario.click(screen.getByRole("button", { name: "Continuar teste" }));
      await screen.findByText("Texto da situação 3.");
    });

    it("se retomar terminar o teste (era a última), vai ao resultado", async () => {
      api.testeEmAndamento.mockResolvedValue({ ...emProcessamento, numero: 5 });
      api.iniciarTeste.mockResolvedValue(respostaDeResultado());
      abrir();
      await userEvent.setup().click(await screen.findByRole("button", { name: "Continuar teste" }));
      await waitFor(() =>
        expect(screen.getByTestId("local").textContent).toBe("/lab/resultado/sessao-1")
      );
    });
  });
});
