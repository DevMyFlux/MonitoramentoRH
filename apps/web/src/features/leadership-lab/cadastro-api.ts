// Leadership Lab — o cliente dos cadastros do RH e da configuração dos moldes.
//
// Mesma regra do cliente do participante (api.ts): toda resposta passa pelo schema compartilhado
// antes de chegar a uma tela. As entradas são validadas pelo servidor com os schemas estritos de
// packages/shared; aqui só se monta a chamada.
import {
  type LabAtualizarMoldeEntrada,
  type LabAtualizarParticipanteEntrada,
  type LabAtualizarTurmaEntrada,
  type LabCadastrarParticipanteEntrada,
  type LabCriarTurmaEntrada,
  labColaboradorDoCadastroSchema,
  labConfigDosMoldesSchema,
  labParticipanteDoCadastroSchema,
  labTurmaDetalheSchema,
  labTurmaResumoSchema,
  labUsuarioElegivelSchema
} from "@my-flux/shared";
import { z } from "zod";
import { chamar } from "./api";

const comId = (id: string) => encodeURIComponent(id);
const comBusca = (busca: string) => `?busca=${encodeURIComponent(busca)}`;

export const labCadastroApi = {
  participantes: () => chamar(z.array(labParticipanteDoCadastroSchema), "GET", "/participantes"),
  colaboradoresElegiveis: (busca: string) =>
    chamar(
      z.array(labColaboradorDoCadastroSchema),
      "GET",
      `/colaboradores-elegiveis${comBusca(busca)}`
    ),
  usuariosElegiveis: (busca: string) =>
    chamar(z.array(labUsuarioElegivelSchema), "GET", `/usuarios-elegiveis${comBusca(busca)}`),
  cadastrarParticipante: (entrada: LabCadastrarParticipanteEntrada) =>
    chamar(labParticipanteDoCadastroSchema, "POST", "/participantes", entrada),
  atualizarParticipante: (id: string, entrada: LabAtualizarParticipanteEntrada) =>
    chamar(labParticipanteDoCadastroSchema, "PATCH", `/participantes/${comId(id)}`, entrada),

  turmas: () => chamar(z.array(labTurmaResumoSchema), "GET", "/turmas"),
  turma: (id: string) => chamar(labTurmaDetalheSchema, "GET", `/turmas/${comId(id)}`),
  criarTurma: (entrada: LabCriarTurmaEntrada) =>
    chamar(labTurmaResumoSchema, "POST", "/turmas", entrada),
  atualizarTurma: (id: string, entrada: LabAtualizarTurmaEntrada) =>
    chamar(labTurmaResumoSchema, "PATCH", `/turmas/${comId(id)}`, entrada),
  incluirNaTurma: (id: string, participanteId: string) =>
    chamar(labTurmaDetalheSchema, "POST", `/turmas/${comId(id)}/participantes`, { participanteId }),
  removerDaTurma: (id: string, participanteId: string) =>
    chamar(
      labTurmaDetalheSchema,
      "DELETE",
      `/turmas/${comId(id)}/participantes/${comId(participanteId)}`
    ),

  configDosMoldes: () => chamar(labConfigDosMoldesSchema, "GET", "/config/moldes"),
  atualizarMolde: (nivel: string, entrada: LabAtualizarMoldeEntrada) =>
    chamar(labConfigDosMoldesSchema, "PUT", `/config/moldes/${comId(nivel)}`, entrada)
};
