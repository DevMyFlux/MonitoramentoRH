// Leadership Lab — a parte do acesso que se repete em toda ação do curador.
import type { LabAcao, LabAtor } from "@my-flux/shared";
import { assertAcesso } from "../lab-access.js";
import { errosDaCuradoria } from "./erros.js";

/** Um id que nunca existe. Usado só para que a matriz diga "não é seu", e não "perfil errado". */
const ID_NULO = "00000000-0000-0000-0000-000000000000";

/**
 * O recurso pedido não existe. Antes de dizer "não encontrado", confere o PERFIL: quem não é do
 * papel recebe 403, como receberia para um recurso que existe. Quem é do papel recebe o mesmo 404
 * de um recurso que existe mas está fora do seu alcance (turma ou posse): a resposta não revela
 * nada.
 */
export function recursoInexistente(ator: LabAtor, acao: LabAcao): never {
  assertAcesso(ator, acao, { participanteId: ID_NULO, participantesDasTurmas: new Set() });
  throw errosDaCuradoria.naoEncontrado();
}
