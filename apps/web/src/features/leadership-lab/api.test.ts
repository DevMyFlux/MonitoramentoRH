// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../my-flux/client";
import { RespostaInesperadaError, labApi } from "./api";
import { painel, respostaDeSituacao } from "../../test/dados-do-lab";

function responder(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("labApi", () => {
  const fetchFalso = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchFalso);
    sessionStorage.setItem("flux.access", "token-de-teste");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchFalso.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  const ultimaChamada = () => {
    const [url, init] = fetchFalso.mock.calls.at(-1) ?? [];
    return { url: String(url), init: (init ?? {}) as RequestInit };
  };

  it("lê o painel com o token, e devolve o que está no contrato", async () => {
    fetchFalso.mockResolvedValue(responder(200, { data: painel() }));

    const resultado = await labApi.painel();

    expect(resultado.acao.tipo).toBe("iniciar");
    const { url, init } = ultimaChamada();
    expect(url).toMatch(/\/leadership-lab\/painel$/);
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-de-teste");
  });

  it("iniciar o teste é um POST sem corpo", async () => {
    fetchFalso.mockResolvedValue(responder(200, { data: respostaDeSituacao(1) }));

    await labApi.iniciarTeste();

    const { url, init } = ultimaChamada();
    expect(url).toMatch(/\/leadership-lab\/sessoes$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("ler o teste em andamento é um GET em /sessoes/atual (nunca um POST)", async () => {
    fetchFalso.mockResolvedValue(responder(200, { data: respostaDeSituacao(2) }));

    await labApi.testeEmAndamento();

    const { url, init } = ultimaChamada();
    expect(url).toMatch(/\/leadership-lab\/sessoes\/atual$/);
    expect(init.method).toBe("GET");
  });

  it("responder envia só número, escolha e (se houver) o texto livre", async () => {
    // Uma Response nova a cada chamada: o corpo de uma só pode ser lido uma vez.
    fetchFalso.mockImplementation(async () => responder(200, { data: respostaDeSituacao(2) }));

    await labApi.responder("sessao-1", { numero: 1, escolha: "B", textoLivre: "Chamaria o time." });

    const { url, init } = ultimaChamada();
    expect(url).toMatch(/\/leadership-lab\/sessoes\/sessao-1\/respostas$/);
    expect(JSON.parse(String(init.body))).toEqual({
      numero: 1,
      escolha: "B",
      textoLivre: "Chamaria o time."
    });

    await labApi.responder("sessao-1", { numero: 1, escolha: "A" });
    expect(JSON.parse(String(ultimaChamada().init.body))).toEqual({ numero: 1, escolha: "A" });
  });

  it("tempo esgotado envia o número da situação", async () => {
    fetchFalso.mockResolvedValue(responder(200, { data: respostaDeSituacao(2) }));
    await labApi.tempoEsgotado("sessao-1", 1);
    const { url, init } = ultimaChamada();
    expect(url).toMatch(/\/sessoes\/sessao-1\/tempo-esgotado$/);
    expect(JSON.parse(String(init.body))).toEqual({ numero: 1 });
  });

  it("o id da sessão vai codificado na URL", async () => {
    fetchFalso.mockResolvedValue(
      responder(404, { code: "LAB_NOT_FOUND", message: "x", details: {} })
    );
    await labApi.resultado("../painel?x=1").catch(() => undefined);
    expect(ultimaChamada().url).toMatch(/\/sessoes\/\.\.%2Fpainel%3Fx%3D1\/resultado$/);
  });

  it("um erro da API vira ApiError, com status, código e detalhes", async () => {
    fetchFalso.mockResolvedValue(
      responder(409, {
        code: "LAB_TEMPO_NAO_ESGOTADO",
        message: "O tempo desta situação ainda não acabou.",
        details: { tempoRestanteMs: 12_000 }
      })
    );

    const erro = await labApi.tempoEsgotado("sessao-1", 1).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({
      status: 409,
      code: "LAB_TEMPO_NAO_ESGOTADO",
      message: "O tempo desta situação ainda não acabou.",
      details: { tempoRestanteMs: 12_000 }
    });
  });

  it("uma resposta fora do contrato vira RespostaInesperadaError, não um dado quebrado", async () => {
    const { acao: _acao, ...semAcao } = painel();
    expect(_acao).toBeDefined();
    fetchFalso.mockResolvedValue(responder(200, { data: semAcao }));

    const erro = await labApi.painel().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(RespostaInesperadaError);
    expect((erro as RespostaInesperadaError).caminho).toBe("/painel");
    expect((erro as RespostaInesperadaError).problemas.join(" ")).toContain("acao");
  });

  it("o que não é do contrato é descartado: um campo de avaliação que vazasse não chega à tela", async () => {
    const vazada = respostaDeSituacao(1);
    const comVazamento = {
      ...vazada,
      situacao: { ...vazada.situacao, aderencia: 100, estilo: "direcao", justificativa: "segredo" }
    };
    fetchFalso.mockResolvedValue(responder(200, { data: comVazamento }));

    const resultado = await labApi.iniciarTeste();

    expect(JSON.stringify(resultado)).not.toContain("segredo");
    expect(JSON.stringify(resultado)).not.toContain("aderencia");
    expect(resultado).toEqual(vazada);
  });
});
