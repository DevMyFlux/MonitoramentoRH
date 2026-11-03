import { labCodigosDeErro } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "../my-flux/client";
import { RespostaInesperadaError } from "./api";
import { descreverErro } from "./erros";

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
