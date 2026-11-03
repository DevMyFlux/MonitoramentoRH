// Leadership Lab — erros do motor do teste, com o código estável que o front usa para reagir
// e uma mensagem que o participante pode ler. Nenhuma mensagem revela a avaliação nem o que
// a IA respondeu: detalhes técnicos vão para o log_ia, não para a resposta.
import { HttpError } from "../../../lib/http-error.js";
import { LAB_NAO_ENCONTRADO } from "../lab-access.js";
import type { CodigoDeFalhaIa } from "./cliente-ia.js";

export const erros = {
  /** Sessão inexistente e sessão alheia respondem exatamente igual. */
  naoEncontrado: () => new HttpError(404, LAB_NAO_ENCONTRADO.code, LAB_NAO_ENCONTRADO.message),

  termoPendente: () =>
    new HttpError(
      403,
      "LAB_TERMO_PENDENTE",
      "Aceite o termo de ciência do Leadership Lab para iniciar um teste."
    ),

  cargoNaoInformado: () =>
    new HttpError(
      409,
      "LAB_CARGO_NAO_INFORMADO",
      "Seu cadastro não tem cargo informado. Procure o RH."
    ),

  moldeNaoMapeado: () =>
    new HttpError(
      409,
      "LAB_MOLDE_NAO_MAPEADO",
      "O seu cargo ainda não está associado a um teste do Leadership Lab. Procure o RH."
    ),

  moldeInativo: () =>
    new HttpError(409, "LAB_MOLDE_INATIVO", "O teste do seu cargo ainda não foi liberado."),

  moldeDivergente: () =>
    new HttpError(422, "LAB_MOLDE_DIVERGENTE", "O teste escolhido não é o do seu cargo."),

  limiteDiario: (limite: number) =>
    new HttpError(
      429,
      "LAB_LIMITE_DIARIO",
      `Você já fez ${limite} ${limite === 1 ? "teste" : "testes"} hoje. Volte amanhã.`,
      { limite }
    ),

  sessaoEncerrada: () => new HttpError(409, "LAB_SESSAO_ENCERRADA", "Este teste foi encerrado."),

  turnoForaDeOrdem: (esperado: number) =>
    new HttpError(409, "LAB_TURNO_FORA_DE_ORDEM", "Esta não é a situação em andamento.", {
      situacaoEmAndamento: esperado
    }),

  respostaDivergente: () =>
    new HttpError(
      409,
      "LAB_RESPOSTA_DIVERGENTE",
      "Esta situação já foi respondida de outra forma e não pode ser alterada."
    ),

  emProcessamento: () =>
    new HttpError(
      409,
      "LAB_EM_PROCESSAMENTO",
      "Sua resposta está sendo processada. Aguarde um instante e tente de novo."
    ),

  tempoNaoEsgotado: (tempoRestanteMs: number) =>
    new HttpError(409, "LAB_TEMPO_NAO_ESGOTADO", "O tempo desta situação ainda não acabou.", {
      tempoRestanteMs
    }),

  testeEmAndamento: () =>
    new HttpError(
      409,
      "LAB_TESTE_EM_ANDAMENTO",
      "O resultado só fica disponível depois da última situação."
    ),

  /** A IA não respondeu, ou respondeu fora do contrato. O participante pode tentar de novo. */
  ia: (codigo: CodigoDeFalhaIa) =>
    codigo === "CONTRATO"
      ? new HttpError(
          502,
          "LAB_IA_RESPOSTA_INVALIDA",
          "O serviço de IA respondeu de forma inesperada. Tente de novo."
        )
      : new HttpError(
          502,
          "LAB_IA_INDISPONIVEL",
          "O serviço de IA não está disponível agora. Tente de novo em instantes."
        )
};
