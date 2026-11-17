// Assistente de suporte — o que dizer à pessoa quando a chamada falha.
import { ApiError } from "../my-flux/client";

/**
 * O servidor espera até 25 s pela Guarda e mais 25 s pela IA; o limite da tela tem de ser maior que
 * a soma, ou a tela desiste antes do servidor e mostra falha numa resposta que ainda chegaria.
 */
export const LIMITE_DA_CHAMADA_MS = 70_000;

/** Diz o que aconteceu, sem expor detalhe interno. Só o que a pessoa pode usar. */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.code === "SUPORTE_INDISPONIVEL")
      return "O assistente não está disponível neste ambiente no momento.";
    if (erro.status === 409 || erro.status === 429 || erro.status === 400) return erro.message;
    if (erro.status === 404)
      return "O assistente ainda não está disponível nesta versão do sistema. Avise o administrador.";
    if (erro.status === 502 || erro.status === 503 || erro.status === 504)
      return "O serviço de IA não respondeu agora. Tente de novo em instantes.";
    return "Não consegui responder agora. Tente de novo em instantes.";
  }
  if (erro instanceof DOMException && (erro.name === "TimeoutError" || erro.name === "AbortError"))
    return "A resposta demorou mais que o esperado. Tente de novo.";
  if (erro instanceof TypeError) return "Sem conexão com o servidor. Verifique a rede e tente de novo.";
  return "Não consegui responder agora. Tente de novo em instantes.";
}
