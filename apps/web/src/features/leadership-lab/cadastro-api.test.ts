// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configDosMoldes,
  participante,
  turma,
  turmaDetalhe,
  usuario,
  colaborador
} from "../../test/dados-do-cadastro";
import { RespostaInesperadaError } from "./api";
import { labCadastroApi } from "./cadastro-api";

function responder(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("labCadastroApi", () => {
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

  it("cada chamada usa o método, o caminho e o corpo certos", async () => {
    fetchFalso.mockImplementation(async () => responder(200, { data: participante() }));
    await labCadastroApi.cadastrarParticipante({ userId: "u1", employeeId: "e1" });
    expect(ultima()).toEqual({
      url: "/participantes",
      metodo: "POST",
      corpo: { userId: "u1", employeeId: "e1" }
    });
    await labCadastroApi.atualizarParticipante("p1", { ativo: false });
    expect(ultima()).toEqual({
      url: "/participantes/p1",
      metodo: "PATCH",
      corpo: { ativo: false }
    });

    fetchFalso.mockImplementation(async () => responder(200, { data: turma() }));
    await labCadastroApi.criarTurma({ nome: "Nova" });
    expect(ultima()).toEqual({ url: "/turmas", metodo: "POST", corpo: { nome: "Nova" } });
    await labCadastroApi.atualizarTurma("t1", { ativa: false });
    expect(ultima()).toEqual({ url: "/turmas/t1", metodo: "PATCH", corpo: { ativa: false } });

    fetchFalso.mockImplementation(async () => responder(200, { data: turmaDetalhe() }));
    await labCadastroApi.turma("t1");
    expect(ultima()).toMatchObject({ url: "/turmas/t1", metodo: "GET" });
    await labCadastroApi.incluirNaTurma("t1", "p1");
    expect(ultima()).toEqual({
      url: "/turmas/t1/participantes",
      metodo: "POST",
      corpo: { participanteId: "p1" }
    });
    await labCadastroApi.removerDaTurma("t1", "p1");
    expect(ultima()).toMatchObject({ url: "/turmas/t1/participantes/p1", metodo: "DELETE" });
    expect(ultima().corpo).toBeUndefined();

    fetchFalso.mockImplementation(async () => responder(200, { data: configDosMoldes() }));
    await labCadastroApi.configDosMoldes();
    expect(ultima()).toMatchObject({ url: "/config/moldes", metodo: "GET" });
    await labCadastroApi.atualizarMolde("supervisor", {
      tempoLimiteS: 45,
      ativo: true,
      cargoIds: ["c1"]
    });
    expect(ultima()).toEqual({
      url: "/config/moldes/supervisor",
      metodo: "PUT",
      corpo: { tempoLimiteS: 45, ativo: true, cargoIds: ["c1"] }
    });
  });

  it("a busca vai codificada na URL, e só o que está no contrato volta", async () => {
    fetchFalso.mockImplementation(async () =>
      responder(200, { data: [{ ...colaborador(), passwordHash: "segredo" }] })
    );
    const lidos = await labCadastroApi.colaboradoresElegiveis("ana & maria/ç");
    expect(ultima().url).toBe(
      `/colaboradores-elegiveis?busca=${encodeURIComponent("ana & maria/ç")}`
    );
    expect(JSON.stringify(lidos)).not.toContain("segredo");

    fetchFalso.mockImplementation(async () => responder(200, { data: [usuario()] }));
    await labCadastroApi.usuariosElegiveis("ana@");
    expect(ultima().url).toBe("/usuarios-elegiveis?busca=ana%40");
  });

  it("um id com caractere especial não escapa do caminho", async () => {
    fetchFalso.mockImplementation(async () => responder(200, { data: turmaDetalhe() }));
    await labCadastroApi.turma("../participantes");
    expect(ultima().url).toBe("/turmas/..%2Fparticipantes");
  });

  it("resposta fora do contrato vira um erro claro, não um undefined na tela", async () => {
    fetchFalso.mockImplementation(async () => responder(200, { data: [{ id: "x" }] }));
    await expect(labCadastroApi.participantes()).rejects.toBeInstanceOf(RespostaInesperadaError);
    fetchFalso.mockImplementation(async () => responder(200, { data: { moldes: [] } }));
    await expect(labCadastroApi.configDosMoldes()).rejects.toBeInstanceOf(RespostaInesperadaError);
  });
});
