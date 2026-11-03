import type { LabAtor } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { LAB_NAO_ENCONTRADO, assertAcesso } from "./lab-access.js";

const comum: LabAtor = { userId: "u1", role: "COMUM", participanteId: "p1", permissoes: [] };
const rh: LabAtor = { userId: "u2", role: "RH", participanteId: null, permissoes: [] };
const dev: LabAtor = { userId: "u3", role: "DEV", participanteId: null, permissoes: [] };

function erroDe(fn: () => void): HttpError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    return error as HttpError;
  }
  throw new Error("Era esperado um HttpError, mas nada foi lançado.");
}

describe("assertAcesso", () => {
  it("não lança quando o acesso é permitido", () => {
    expect(() => assertAcesso(comum, "painel:ler")).not.toThrow();
    expect(() => assertAcesso(comum, "sessao:responder", { participanteId: "p1" })).not.toThrow();
    expect(() => assertAcesso(dev, "config-moldes:atualizar")).not.toThrow();
  });

  it("403 LAB_FORBIDDEN quando o perfil não pode a ação, inclusive para DEV", () => {
    for (const [ator, acao] of [
      [comum, "resultado:validar"],
      [rh, "sessao:iniciar"],
      [dev, "resultado:ler"],
      [dev, "painel:ler"]
    ] as const) {
      const erro = erroDe(() => assertAcesso(ator, acao));
      expect(erro.statusCode, `${ator.role} ${acao}`).toBe(403);
      expect(erro.code).toBe("LAB_FORBIDDEN");
    }
  });

  it("403 LAB_SEM_VINCULO, com orientação, quando o usuário não está ligado a um colaborador", () => {
    const semVinculo: LabAtor = { ...comum, participanteId: null };
    const erro = erroDe(() => assertAcesso(semVinculo, "sessao:iniciar"));
    expect(erro.statusCode).toBe(403);
    expect(erro.code).toBe("LAB_SEM_VINCULO");
    expect(erro.message).toMatch(/RH/);
  });

  it("404 para sessão de outra pessoa e para participante fora da turma, com a mesma resposta", () => {
    const alheio = erroDe(() => assertAcesso(comum, "sessao:responder", { participanteId: "p2" }));
    const foraDaTurma = erroDe(() =>
      assertAcesso(rh, "resultado:ler", {
        participanteId: "p2",
        participantesDasTurmas: new Set(["p9"])
      })
    );
    for (const erro of [alheio, foraDaTurma]) {
      expect(erro.statusCode).toBe(404);
      expect(erro.code).toBe(LAB_NAO_ENCONTRADO.code);
      expect(erro.message).toBe(LAB_NAO_ENCONTRADO.message);
    }
    // Nenhuma diferença observável entre os dois casos (nem entre "alheio" e "inexistente").
    expect({ ...alheio }).toEqual({ ...foraDaTurma });
  });

  it("a resposta de 'alheio' não revela nada sobre o dono", () => {
    const erro = erroDe(() =>
      assertAcesso(comum, "sessao:responder", { participanteId: "p-segredo" })
    );
    expect(
      JSON.stringify({ code: erro.code, message: erro.message, details: erro.details })
    ).not.toContain("p-segredo");
  });
});
