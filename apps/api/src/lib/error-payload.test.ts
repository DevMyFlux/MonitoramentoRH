import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorPayload, validationErrorPayload } from "./error-payload.js";

describe("errorPayload", () => {
  it("mantém o código técnico e troca só a mensagem por uma frase amigável", () => {
    const payload = errorPayload({
      code: "NO_EMPLOYEES",
      statusCode: 409,
      message: "Nenhum colaborador ativo nesta unidade."
    });
    expect(payload.code).toBe("NO_EMPLOYEES");
    expect(payload.message).toBe("Não há colaboradores ativos nesta unidade para montar a escala.");
    expect(payload.details?.action).toContain("Cadastre ou reative");
    // a frase original continua disponível para suporte
    expect(payload.details?.technicalMessage).toBe("Nenhum colaborador ativo nesta unidade.");
  });

  it("preserva os details originais da aplicação", () => {
    const payload = errorPayload({
      code: "STALE_VERSION",
      statusCode: 409,
      message: "Versão desatualizada.",
      details: { expected: 2 }
    });
    expect(payload.details?.expected).toBe(2);
    expect(payload.message).toBe("Versão desatualizada.");
  });

  it("erro 5xx não vaza a mensagem original e devolve só a referência da requisição", () => {
    const payload = errorPayload({
      code: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
      message: "connect ECONNREFUSED 10.0.0.5:5432",
      requestId: "req-42"
    });
    expect(JSON.stringify(payload)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
    expect(payload.message).toBe("Ocorreu um erro inesperado.");
    expect(payload.details?.reference).toBe("req-42");
    expect(payload.details?.technicalMessage).toBeUndefined();
  });

  it("5xx com código desconhecido também usa a mensagem genérica", () => {
    const payload = errorPayload({
      code: "ALGO_RARO",
      statusCode: 502,
      message: "upstream exploded: secret-token-123"
    });
    expect(payload.message).toBe("Não foi possível concluir a operação.");
    expect(JSON.stringify(payload)).not.toContain("secret-token-123");
  });
});

describe("validationErrorPayload", () => {
  it("traduz os campos para português e mantém os issues brutos", () => {
    const schema = z.object({ email: z.email(), password: z.string().min(12), month: z.string() });
    const result = schema.safeParse({ email: "nao-e-email", password: "curta" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const payload = validationErrorPayload(result.error, "req-1");
    expect(payload.code).toBe("VALIDATION_ERROR");
    expect(payload.message).toContain("Alguns dados enviados estão incompletos ou inválidos.");
    expect(payload.message).toContain("E-mail: e-mail inválido");
    expect(payload.message).toContain("Senha: precisa ter pelo menos 12 caracteres");
    expect(payload.message).toContain("Mês: campo obrigatório");
    expect(payload.message).not.toMatch(/Too small|Invalid|expected/i);
    const fields = payload.details?.fields as Array<{ path: string; message: string }>;
    expect(fields.map((f) => f.path)).toEqual(["email", "password", "month"]);
    expect(Array.isArray(payload.details?.issues)).toBe(true);
  });
});
