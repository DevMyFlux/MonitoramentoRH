import {
  labCodigosDeErro,
  labCodigosDeErroDaCuradoria,
  labCodigosDeErroDoCadastro
} from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "../my-flux/client";
import { RespostaInesperadaError } from "./api";
import { descreverErro, descreverErroDoCadastro } from "./erros";

const apiErro = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

describe("descreverErro", () => {
  it("todo código estável do módulo tem texto próprio, com título e descrição", () => {
    for (const codigo of labCodigosDeErro) {
      const erro = descreverErro(apiErro(409, codigo, "Mensagem da API."));
      expect(erro.titulo, codigo).not.toBe("");
      expect(erro.descricao, codigo).not.toBe("");
      expect(erro.tipo, codigo).toBeDefined();
    }
  });

  it("um código do módulo que a tela ainda não conhece vira a mensagem da API, não uma tela quebrada nem 'módulo desligado'", () => {
    const erro = descreverErro(apiErro(404, "LAB_CODIGO_NOVO", "Algo novo aconteceu."));
    expect(erro).toMatchObject({
      tipo: "geral",
      descricao: "Algo novo aconteceu.",
      podeTentarDeNovo: false
    });
    expect(erro.titulo).not.toBe("");
  });

  it("todo código dos cadastros do RH e da curadoria também tem texto, e é a mensagem clara da API", () => {
    for (const codigo of [...labCodigosDeErroDoCadastro, ...labCodigosDeErroDaCuradoria]) {
      const erro = descreverErro(apiErro(409, codigo, "Mensagem clara da API."));
      expect(erro.titulo, codigo).not.toBe("");
      expect(erro.descricao, codigo).toBe("Mensagem clara da API.");
      expect(erro.podeTentarDeNovo, codigo).toBe(false);
    }
  });

  it.each([
    ["LAB_FORBIDDEN", 403, "sem-acesso", false],
    ["LAB_SEM_VINCULO", 403, "sem-vinculo", false],
    ["LAB_SEM_TESTE_EM_ANDAMENTO", 404, "sem-teste", false],
    ["LAB_NOT_FOUND", 404, "teste-indisponivel", false],
    ["LAB_SESSAO_ENCERRADA", 409, "teste-indisponivel", false],
    ["LAB_TURNO_FORA_DE_ORDEM", 409, "tela-desatualizada", false],
    ["LAB_RESPOSTA_DIVERGENTE", 409, "tela-desatualizada", false],
    ["LAB_EM_PROCESSAMENTO", 409, "tentar-de-novo", true],
    ["LAB_IA_INDISPONIVEL", 502, "tentar-de-novo", true],
    ["LAB_IA_RESPOSTA_INVALIDA", 502, "tentar-de-novo", true]
  ] as const)("%s (%i) -> %s, tentar de novo: %s", (codigo, status, tipo, podeTentar) => {
    expect(descreverErro(apiErro(status, codigo))).toMatchObject({
      tipo,
      podeTentarDeNovo: podeTentar
    });
  });

  it("os erros de início de teste repetem a mensagem clara que a API já devolve", () => {
    for (const codigo of [
      "LAB_CARGO_NAO_INFORMADO",
      "LAB_MOLDE_NAO_MAPEADO",
      "LAB_MOLDE_INATIVO",
      "LAB_MOLDE_DIVERGENTE",
      "LAB_LIMITE_DIARIO"
    ]) {
      const erro = descreverErro(apiErro(409, codigo, "Você já fez 2 testes hoje. Volte amanhã."));
      expect(erro.descricao).toBe("Você já fez 2 testes hoje. Volte amanhã.");
    }
  });

  it("um 404 sem código do módulo é a rota que não existe: o módulo não está ligado", () => {
    expect(descreverErro(apiErro(404))).toMatchObject({
      tipo: "modulo-desligado",
      podeTentarDeNovo: false
    });
    expect(descreverErro(apiErro(404, "NOT_FOUND"))).toMatchObject({ tipo: "modulo-desligado" });
  });

  it("sessão expirada, falha do servidor e outros erros do cliente", () => {
    expect(descreverErro(apiErro(401, "INVALID_ACCESS_TOKEN")).titulo).toBe("Sua sessão expirou");
    expect(descreverErro(apiErro(500))).toMatchObject({ tipo: "tentar-de-novo" });
    expect(descreverErro(apiErro(503))).toMatchObject({ podeTentarDeNovo: true });
    expect(descreverErro(apiErro(400, "VALIDATION_ERROR", "Campo inválido."))).toMatchObject({
      tipo: "geral",
      descricao: "Campo inválido.",
      podeTentarDeNovo: false
    });
  });

  it("falha de rede e resposta fora do contrato permitem tentar de novo", () => {
    expect(descreverErro(new TypeError("Failed to fetch"))).toMatchObject({
      titulo: "Sem conexão com o servidor",
      podeTentarDeNovo: true
    });
    expect(
      descreverErro(new RespostaInesperadaError("/painel", ["acao: obrigatório"]))
    ).toMatchObject({
      titulo: "Recebemos uma resposta inesperada",
      podeTentarDeNovo: true
    });
  });

  it("nenhum texto mostra código técnico nem detalhe de validação ao participante", () => {
    const erro = descreverErro(
      new RespostaInesperadaError("/painel", ["acao.tipo: Invalid input"])
    );
    expect(JSON.stringify(erro)).not.toContain("acao.tipo");
    expect(JSON.stringify(descreverErro(apiErro(409, "LAB_EM_PROCESSAMENTO")))).not.toContain(
      "LAB_"
    );
  });
});

describe("descreverErroDoCadastro", () => {
  it("o 403 diz que a ÁREA não é para o perfil, e para quem ela é", () => {
    const rh = descreverErroDoCadastro(apiErro(403, "LAB_FORBIDDEN"), "acompanhamento");
    expect(rh).toMatchObject({
      tipo: "sem-acesso",
      titulo: "Esta área não é para o seu perfil",
      podeTentarDeNovo: false
    });
    expect(rh.descricao).toContain("do RH");
    const config = descreverErroDoCadastro(apiErro(403, "LAB_FORBIDDEN"), "configuracao");
    expect(config.descricao).toContain("da administração do sistema");
    // E não repete o texto do participante ("os testes são feitos pelos gestores").
    expect(JSON.stringify([rh, config])).not.toContain("gestores participantes");
  });

  it("'não encontrado' é um cadastro que sumiu ou está fora do alcance, não um teste", () => {
    const erro = descreverErroDoCadastro(apiErro(404, "LAB_NOT_FOUND"), "acompanhamento");
    expect(erro).toMatchObject({ tipo: "geral", titulo: "Registro não encontrado" });
    expect(erro.descricao).toMatch(/fora do que o seu acesso alcança/);
  });

  it("o resto segue o que descreverErro diz", () => {
    for (const erro of [
      apiErro(404),
      apiErro(401, "INVALID_ACCESS_TOKEN"),
      apiErro(500),
      apiErro(409, "LAB_TURMA_INATIVA", "A turma está encerrada."),
      new TypeError("Failed to fetch")
    ]) {
      expect(descreverErroDoCadastro(erro, "acompanhamento")).toEqual(descreverErro(erro));
    }
  });
});
