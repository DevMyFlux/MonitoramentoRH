// Os códigos de erro que o servidor pode devolver e os que a tela sabe tratar (a lista em
// packages/shared) têm de ser os mesmos. Código novo no servidor sem a tela saber dele, ou o
// contrário, reprova aqui.
import {
  labCodigosDeErro,
  labCodigosDeErroDaCuradoria,
  labCodigosDeErroDoSimulador,
  labCodigosDeErroDoCadastro,
  type LabAtor
} from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import type { HttpError } from "../../../lib/http-error.js";
import { errosDoCadastro } from "../cadastro/erros.js";
import { errosDaCuradoria } from "../curadoria/erros.js";
import { assertAcesso } from "../lab-access.js";
import { erros } from "./erros.js";

function codigoDe(acao: () => void): string {
  try {
    acao();
  } catch (erro) {
    return (erro as HttpError).code;
  }
  throw new Error("esperava um erro");
}

describe("códigos de erro do Leadership Lab", () => {
  it("os do servidor são exatamente os que o front trata", () => {
    const doServidor = new Set<string>();

    // Todo erro do motor, sem esquecer nenhum: percorre a tabela inteira.
    for (const fabrica of Object.values(erros) as Array<(argumento: never) => HttpError>) {
      doServidor.add(fabrica(1 as never).code);
    }
    doServidor.add(erros.ia("CONTRATO").code); // a outra variante de erros.ia

    // Os da curadoria. Os argumentos não importam: só o código.
    for (const fabrica of Object.values(errosDaCuradoria) as Array<
      (argumento: never) => HttpError
    >) {
      doServidor.add(fabrica("motivo" as never).code);
    }

    // Os dos cadastros do RH. Os argumentos não importam: só o código.
    for (const fabrica of Object.values(errosDoCadastro) as Array<
      (argumento: never) => HttpError
    >) {
      doServidor.add(fabrica([] as never).code);
    }

    // Os da matriz de permissões (lab-access.ts).
    const comum: LabAtor = { userId: "u", role: "COMUM", participanteId: null, permissoes: [] };
    doServidor.add(codigoDe(() => assertAcesso({ ...comum, role: "RH" }, "painel:ler")));
    doServidor.add(codigoDe(() => assertAcesso(comum, "painel:ler")));

    expect([...doServidor].sort()).toEqual(
      [
        ...new Set([
          ...labCodigosDeErro,
          ...labCodigosDeErroDoCadastro,
          ...labCodigosDeErroDaCuradoria,
          ...labCodigosDeErroDoSimulador
        ])
      ].sort()
    );
  });
});
