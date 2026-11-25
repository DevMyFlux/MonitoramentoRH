import { describe, expect, it } from "vitest";
import { errosDaApi, perfisQueOAtorCria, validarCadastro, validarConta } from "./formulario";

const valido = {
  name: "Ana Souza",
  email: "ana@empresa.com",
  role: "COMUM",
  password: "Senha-de-teste-1!",
  cargo: "Supervisor de manutenção",
  nivelGovernanca: "supervisor",
  areaId: "00000000-0000-4000-8000-000000000001"
};

describe("formulário de conta", () => {
  it("conta completa: nenhum erro", () => {
    expect(validarConta(valido, false, "")).toEqual({});
  });

  it("em branco: um erro em português por campo, no campo certo", () => {
    const erros = validarConta(
      { name: "", email: "", role: "", password: "", cargo: "", nivelGovernanca: "", areaId: "" },
      true,
      ""
    );
    expect(erros).toEqual({
      name: "Informe o nome (pelo menos 2 letras).",
      email: "Informe um e-mail válido.",
      role: "Escolha o perfil.",
      password: "A senha inicial precisa de pelo menos 12 caracteres.",
      operationId: "Escolha a operação.",
      cargo: "Informe o cargo (pelo menos 2 letras).",
      nivelGovernanca: "Escolha o nível de governança.",
      areaId: "Escolha a área."
    });
  });

  it("só o cadastro: cargo curto e área em branco", () => {
    expect(validarCadastro({ cargo: "x", nivelGovernanca: "diretoria", areaId: "" })).toEqual({
      cargo: "Informe o cargo (pelo menos 2 letras).",
      areaId: "Escolha a área."
    });
    expect(
      validarCadastro({ cargo: "Analista", nivelGovernanca: "assistente", areaId: valido.areaId })
    ).toEqual({});
  });

  it("lê os erros por campo da API e ignora o que não é campo do formulário", () => {
    const erro = {
      details: {
        issues: [
          { path: ["areaId"], message: "Escolha uma área ativa." },
          { path: ["cargo"], message: "Informe o cargo." },
          { path: ["scopes", 0, "operationId"], message: "ignorado" },
          { path: ["cargo"], message: "segunda mensagem do mesmo campo" }
        ]
      }
    };
    expect(errosDaApi(erro)).toEqual({
      areaId: "Escolha uma área ativa.",
      cargo: "Informe o cargo."
    });
    expect(errosDaApi(new Error("falhou"))).toEqual({});
    expect(errosDaApi(null)).toEqual({});
  });

  it("os perfis que cada ator cria seguem a regra compartilhada", () => {
    expect(perfisQueOAtorCria("DEV")).toEqual(["DEV", "ADMIN", "RH", "COMUM"]);
    expect(perfisQueOAtorCria("ADMIN")).toEqual(["RH", "COMUM"]);
    expect(perfisQueOAtorCria("RH")).toEqual(["COMUM"]);
    expect(perfisQueOAtorCria("COMUM")).toEqual([]);
    expect(perfisQueOAtorCria(undefined)).toEqual([]);
  });
});
