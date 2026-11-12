// Leadership Lab — erros da curadoria, com código estável e mensagem que o RH entende. A lista de
// códigos está em packages/shared (labCodigosDeErroDaCuradoria) e um teste confere que são
// exatamente os mesmos. "Não encontrado" é o do motor: o mesmo texto para o que não existe e para
// o que está fora da turma de quem pergunta.
import { HttpError } from "../../../lib/http-error.js";
import { erros as errosDoMotor } from "../motor/erros.js";

export const errosDaCuradoria = {
  naoEncontrado: errosDoMotor.naoEncontrado,

  resultadoJaValidado: () =>
    new HttpError(
      409,
      "LAB_RESULTADO_JA_VALIDADO",
      "Este resultado já foi validado. Uma validação não se refaz."
    ),

  resultadoExperimental: () =>
    new HttpError(
      409,
      "LAB_RESULTADO_EXPERIMENTAL",
      "Este resultado usa situações sem base validada (experimental) e não pode ser validado como oficial."
    ),

  justificativaObrigatoria: () =>
    new HttpError(
      422,
      "LAB_JUSTIFICATIVA_OBRIGATORIA",
      "Explique o ajuste de nível: sem justificativa o resultado não pode ser ajustado."
    ),

  ajusteInvalido: (motivo: string) =>
    new HttpError(422, "LAB_AJUSTE_INVALIDO", `Ajuste inválido: ${motivo}`),

  alertaJaTratado: () =>
    new HttpError(409, "LAB_ALERTA_JA_TRATADO", "Este alerta já foi encerrado."),

  jaDecidido: () => new HttpError(409, "LAB_JA_DECIDIDO", "Isto já foi decidido.")
};
