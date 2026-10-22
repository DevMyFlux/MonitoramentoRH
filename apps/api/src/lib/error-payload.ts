import {
  describeApiError,
  friendlyFieldIssue,
  summarizeFieldIssues,
  type ZodIssueLike
} from "@my-flux/shared";
import type { ApiErrorShape } from "@my-flux/types";
import type { ZodError } from "zod";

type ErrorPayloadInput = {
  code: string;
  statusCode: number;
  /** Mensagem original lançada pela aplicação (técnica/curta). */
  message?: string;
  details?: Record<string, unknown>;
  /** Identificador da requisição, devolvido em erros 5xx para o suporte localizar o log. */
  requestId?: string;
};

/**
 * Único ponto que monta a resposta de erro da API: `code` e os `details` originais são preservados
 * (clientes e logs continuam usando o código técnico); `message` passa a ser a frase amigável.
 * Erros 5xx nunca devolvem o texto original — só a referência da requisição.
 */
export function errorPayload(input: ErrorPayloadInput): ApiErrorShape {
  const friendly = describeApiError({
    code: input.code,
    status: input.statusCode,
    ...(input.message !== undefined ? { message: input.message } : {}),
    ...(input.details ? { details: input.details } : {})
  });
  const details: Record<string, unknown> = { ...(input.details ?? {}) };
  if (friendly.action) details.action = friendly.action;
  if (input.statusCode < 500) {
    if (input.message && input.message !== friendly.message)
      details.technicalMessage = input.message;
  } else if (input.requestId) {
    details.reference = input.requestId;
  }
  return { code: input.code, message: friendly.message, details };
}

export function validationErrorPayload(error: ZodError, requestId?: string): ApiErrorShape {
  const fields = error.issues.map((issue) => friendlyFieldIssue(issue as unknown as ZodIssueLike));
  const base = errorPayload({
    code: "VALIDATION_ERROR",
    statusCode: 400,
    ...(requestId ? { requestId } : {})
  });
  return {
    code: base.code,
    message: `${base.message} ${summarizeFieldIssues(fields)}.`,
    // `issues` é o formato bruto de antes (compatibilidade); `fields` é o que a interface deve mostrar.
    details: { ...base.details, issues: error.issues, fields }
  };
}
