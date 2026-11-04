// Leadership Lab — erros dos cadastros do RH, com código estável e mensagem que o RH entende.
// A lista de códigos está em packages/shared (labCodigosDeErroDoCadastro) e um teste confere que
// são exatamente os mesmos. "Não encontrado" é o do motor: o mesmo texto para o que não existe e
// para o que está fora do escopo ou da turma de quem pergunta.
import { HttpError } from "../../../lib/http-error.js";
import { erros as errosDoMotor } from "../motor/erros.js";

export const errosDoCadastro = {
  naoEncontrado: errosDoMotor.naoEncontrado,

  participanteJaCadastrado: () =>
    new HttpError(
      409,
      "LAB_PARTICIPANTE_JA_CADASTRADO",
      "Este usuário ou este colaborador já está cadastrado como participante."
    ),

  /** Também responde ao usuário que não existe: a resposta não confirma que uma conta existe. */
  usuarioNaoElegivel: () =>
    new HttpError(
      422,
      "LAB_USUARIO_NAO_ELEGIVEL",
      "Só um usuário ativo, de perfil comum, pode ser participante."
    ),

  colaboradorNaoElegivel: () =>
    new HttpError(
      422,
      "LAB_COLABORADOR_NAO_ELEGIVEL",
      "Só um colaborador ativo, e de operação ativa, pode ser participante."
    ),

  turmaInativa: () =>
    new HttpError(409, "LAB_TURMA_INATIVA", "A turma está encerrada. Reabra-a para incluir gente."),

  participanteInativo: () =>
    new HttpError(
      409,
      "LAB_PARTICIPANTE_INATIVO",
      "O participante está desativado. Reative-o antes de incluí-lo numa turma."
    ),

  participanteJaNaTurma: () =>
    new HttpError(409, "LAB_PARTICIPANTE_JA_NA_TURMA", "O participante já está nesta turma."),

  moldeComTestesEmAndamento: (testes: number) =>
    new HttpError(
      409,
      "LAB_MOLDE_COM_TESTES_EM_ANDAMENTO",
      `Há ${testes} ${testes === 1 ? "teste em andamento" : "testes em andamento"} neste molde. ` +
        "O tempo por situação só pode mudar quando todos terminarem.",
      { testes }
    ),

  moldeSemTempo: () =>
    new HttpError(
      422,
      "LAB_MOLDE_SEM_TEMPO",
      "Defina o tempo por situação antes de liberar o teste."
    ),

  cargoEmOutroMolde: (cargos: string[]) =>
    new HttpError(
      409,
      "LAB_CARGO_EM_OUTRO_MOLDE",
      `${cargos.length === 1 ? "O cargo já pertence" : "Os cargos já pertencem"} a outro molde: ` +
        `${cargos.join(", ")}. Tire-${cargos.length === 1 ? "o" : "os"} de lá primeiro.`,
      { cargos }
    ),

  cargoInexistente: () =>
    new HttpError(
      422,
      "LAB_CARGO_INEXISTENTE",
      "Algum dos cargos informados não existe ou está inativo."
    )
};
