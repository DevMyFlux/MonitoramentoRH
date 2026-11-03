// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { respostaDeSituacao } from "../../test/dados-do-lab";
import { novoCliente } from "../../test/render";
import { ApiError } from "../my-flux/client";
import { labApi } from "./api";
import { restanteInformadoPeloServidor, useTeste } from "./use-teste";

vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
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

async function montar() {
  const cliente = novoCliente();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useTeste(vi.fn()), { wrapper });
  await waitFor(() => expect(hook.result.current.situacaoAtual).not.toBeNull());
  return hook;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.testeEmAndamento.mockResolvedValue(respostaDeSituacao(1));
});

describe("useTeste: uma chamada de cada vez", () => {
  it("dois envios no mesmo instante mandam uma resposta só", async () => {
    api.responder.mockResolvedValue(respostaDeSituacao(2));
    const { result } = await montar();

    await act(async () => {
      void result.current.responder("A", "");
      void result.current.responder("A", "");
    });

    expect(api.responder).toHaveBeenCalledOnce();
  });

  it("o relógio zerando com uma resposta a caminho não declara tempo esgotado (daria 'resposta divergente')", async () => {
    let concluir: (valor: ReturnType<typeof respostaDeSituacao>) => void = () => undefined;
    api.responder.mockReturnValue(new Promise((resolver) => (concluir = resolver)));
    const { result } = await montar();

    await act(async () => {
      void result.current.responder("B", "");
    });
    await act(async () => {
      await result.current.declararTempoEsgotado();
    });

    expect(api.tempoEsgotado).not.toHaveBeenCalled();
    // E a tela não passa a dizer "tempo esgotado" (se a resposta falhasse, ficaria travada).
    expect(result.current.tempoAcabou).toBe(false);
    await act(async () => concluir(respostaDeSituacao(2)));
  });

  it("e uma declaração de tempo esgotado a caminho não deixa enviar uma resposta junto", async () => {
    let concluir: (valor: ReturnType<typeof respostaDeSituacao>) => void = () => undefined;
    api.tempoEsgotado.mockReturnValue(new Promise((resolver) => (concluir = resolver)));
    const { result } = await montar();

    await act(async () => {
      void result.current.declararTempoEsgotado();
    });
    await act(async () => {
      await result.current.responder("A", "");
    });

    expect(api.responder).not.toHaveBeenCalled();
    await act(async () => concluir(respostaDeSituacao(2)));
  });
});

describe("restanteInformadoPeloServidor", () => {
  const erro = (code: string, details: Record<string, unknown>) =>
    new ApiError("x", 409, code, details);

  it("lê o tempo restante do erro LAB_TEMPO_NAO_ESGOTADO", () => {
    expect(
      restanteInformadoPeloServidor(erro("LAB_TEMPO_NAO_ESGOTADO", { tempoRestanteMs: 12_000 }))
    ).toBe(12_000);
    expect(
      restanteInformadoPeloServidor(erro("LAB_TEMPO_NAO_ESGOTADO", { tempoRestanteMs: 0 }))
    ).toBe(0);
  });

  it.each([
    ["outro código", erro("LAB_EM_PROCESSAMENTO", { tempoRestanteMs: 5 })],
    ["texto no lugar do número", erro("LAB_TEMPO_NAO_ESGOTADO", { tempoRestanteMs: "5" })],
    ["número negativo", erro("LAB_TEMPO_NAO_ESGOTADO", { tempoRestanteMs: -1 })],
    ["não numérico", erro("LAB_TEMPO_NAO_ESGOTADO", { tempoRestanteMs: Number.NaN })],
    ["sem o detalhe", erro("LAB_TEMPO_NAO_ESGOTADO", {})],
    ["erro que não é da API", new TypeError("x")]
  ])("ignora: %s", (_nome, e) => {
    expect(restanteInformadoPeloServidor(e)).toBeNull();
  });
});
