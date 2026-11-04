// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  alerta,
  contestacao,
  contestacaoPropria,
  contribuicao,
  ficha,
  itemDaRevisao,
  pendencias
} from "../../test/dados-da-curadoria";
import { RespostaInesperadaError } from "./api";
import { labCuradoriaApi } from "./curadoria-api";

function responder(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("labCuradoriaApi", () => {
  const fetchFalso = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchFalso);
    sessionStorage.setItem("flux.access", "token-de-teste");
    // Uma Response nova a cada chamada: o corpo de uma só pode ser lido uma vez.
    fetchFalso.mockImplementation(async () => responder(200, { data: [] }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchFalso.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  const ultima = () => {
    const [url, init] = fetchFalso.mock.calls.at(-1) ?? [];
    const requisicao = (init ?? {}) as RequestInit;
    return {
      url: String(url).replace(/^.*\/leadership-lab/, ""),
      metodo: requisicao.method,
      corpo: requisicao.body === undefined ? undefined : JSON.parse(String(requisicao.body))
    };
  };
  const devolve = (data: unknown) =>
    fetchFalso.mockImplementation(async () => responder(200, { data }));

  it("as leituras usam GET, o caminho certo e o filtro na URL", async () => {
    devolve(pendencias());
    await labCuradoriaApi.pendencias();
    expect(ultima()).toMatchObject({ url: "/pendencias", metodo: "GET" });

    devolve([itemDaRevisao()]);
    await labCuradoriaApi.revisao("aguardando_validacao");
    expect(ultima()).toMatchObject({ url: "/revisao?status=aguardando_validacao", metodo: "GET" });

    devolve(ficha());
    await labCuradoriaApi.ficha("r1");
    expect(ultima()).toMatchObject({ url: "/revisao/r1", metodo: "GET" });

    devolve([alerta()]);
    await labCuradoriaApi.alertas("aberto");
    expect(ultima()).toMatchObject({ url: "/alertas?status=aberto", metodo: "GET" });

    devolve([contribuicao()]);
    await labCuradoriaApi.contribuicoes("todas");
    expect(ultima()).toMatchObject({ url: "/contribuicoes?status=todas", metodo: "GET" });

    devolve([contestacao()]);
    await labCuradoriaApi.contestacoes("pendente");
    expect(ultima()).toMatchObject({ url: "/contestacoes?status=pendente", metodo: "GET" });

    devolve([contestacaoPropria()]);
    await labCuradoriaApi.minhasContestacoes("r1");
    expect(ultima()).toMatchObject({ url: "/resultados/r1/contestacoes", metodo: "GET" });
  });

  it("as ações usam POST com o corpo certo", async () => {
    devolve(ficha());
    await labCuradoriaApi.validar("r1", {
      ajustes: [{ skillId: "gestao-os", nivel: 3 }],
      justificativa: "Porque sim."
    });
    expect(ultima()).toEqual({
      url: "/resultados/r1/validacao",
      metodo: "POST",
      corpo: { ajustes: [{ skillId: "gestao-os", nivel: 3 }], justificativa: "Porque sim." }
    });

    devolve(alerta());
    await labCuradoriaApi.tratarAlerta("a1", "Conversamos.");
    expect(ultima()).toEqual({
      url: "/alertas/a1/tratamento",
      metodo: "POST",
      corpo: { nota: "Conversamos." }
    });

    devolve(contribuicao());
    await labCuradoriaApi.decidirContribuicao("c1", "aprovada");
    expect(ultima()).toEqual({
      url: "/contribuicoes/c1/decisao",
      metodo: "POST",
      corpo: { decisao: "aprovada" }
    });

    devolve(contestacao());
    await labCuradoriaApi.decidirContestacao("t1", "aceita", "Faz sentido.");
    expect(ultima()).toEqual({
      url: "/contestacoes/t1/decisao",
      metodo: "POST",
      corpo: { decisao: "aceita", nota: "Faz sentido." }
    });

    devolve(contestacaoPropria());
    await labCuradoriaApi.contestar("r1", { ponto: "Situação 2", motivo: "Discordo." });
    expect(ultima()).toEqual({
      url: "/resultados/r1/contestacoes",
      metodo: "POST",
      corpo: { ponto: "Situação 2", motivo: "Discordo." }
    });
  });

  it("um id com caractere especial não escapa do caminho", async () => {
    devolve(ficha());
    await labCuradoriaApi.ficha("../alertas");
    expect(ultima().url).toBe("/revisao/..%2Falertas");
  });

  it("a contestação do participante nunca traz quem decidiu, mesmo que a API mandasse", async () => {
    devolve([{ ...contestacaoPropria({ status: "aceita", nota: "Ok." }), decididoPor: "Fulana" }]);
    const lidas = await labCuradoriaApi.minhasContestacoes("r1");
    expect(JSON.stringify(lidas)).not.toContain("Fulana");
  });

  it("resposta fora do contrato vira um erro claro", async () => {
    devolve([{ id: "x" }]);
    await expect(labCuradoriaApi.alertas("aberto")).rejects.toBeInstanceOf(RespostaInesperadaError);
    devolve({ resultadoId: "x" });
    await expect(labCuradoriaApi.ficha("x")).rejects.toBeInstanceOf(RespostaInesperadaError);
  });
});
