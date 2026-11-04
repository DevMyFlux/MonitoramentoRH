// Leadership Lab — o cliente da curadoria do RH e da contestação do participante.
//
// Mesma regra dos demais clientes do módulo: toda resposta passa pelo schema compartilhado antes de
// chegar a uma tela. As entradas são validadas pelo servidor com os schemas estritos de
// packages/shared; aqui só se monta a chamada.
import {
  type LabCriarContestacaoEntrada,
  type LabValidarResultadoEntrada,
  labAlertaDoCuradorSchema,
  labContestacaoDoCuradorSchema,
  labContestacaoPropriaSchema,
  labContribuicaoDoCuradorSchema,
  labFichaDeRevisaoSchema,
  labItemDaRevisaoSchema,
  labPendenciasSchema
} from "@my-flux/shared";
import { z } from "zod";
import { chamar } from "./api";

const comId = (id: string) => encodeURIComponent(id);
const comStatus = (status: string) => `?status=${encodeURIComponent(status)}`;

export const labCuradoriaApi = {
  pendencias: () => chamar(labPendenciasSchema, "GET", "/pendencias"),

  revisao: (status: string) =>
    chamar(z.array(labItemDaRevisaoSchema), "GET", `/revisao${comStatus(status)}`),
  ficha: (resultadoId: string) =>
    chamar(labFichaDeRevisaoSchema, "GET", `/revisao/${comId(resultadoId)}`),
  validar: (resultadoId: string, entrada: LabValidarResultadoEntrada) =>
    chamar(labFichaDeRevisaoSchema, "POST", `/resultados/${comId(resultadoId)}/validacao`, entrada),

  alertas: (status: string) =>
    chamar(z.array(labAlertaDoCuradorSchema), "GET", `/alertas${comStatus(status)}`),
  tratarAlerta: (alertaId: string, nota: string) =>
    chamar(labAlertaDoCuradorSchema, "POST", `/alertas/${comId(alertaId)}/tratamento`, { nota }),

  contribuicoes: (status: string) =>
    chamar(z.array(labContribuicaoDoCuradorSchema), "GET", `/contribuicoes${comStatus(status)}`),
  decidirContribuicao: (id: string, decisao: "aprovada" | "rejeitada") =>
    chamar(labContribuicaoDoCuradorSchema, "POST", `/contribuicoes/${comId(id)}/decisao`, {
      decisao
    }),

  contestacoes: (status: string) =>
    chamar(z.array(labContestacaoDoCuradorSchema), "GET", `/contestacoes${comStatus(status)}`),
  decidirContestacao: (id: string, decisao: "aceita" | "rejeitada", nota: string) =>
    chamar(labContestacaoDoCuradorSchema, "POST", `/contestacoes/${comId(id)}/decisao`, {
      decisao,
      nota
    }),

  // Participante, só do próprio resultado.
  contestar: (resultadoId: string, entrada: LabCriarContestacaoEntrada) =>
    chamar(
      labContestacaoPropriaSchema,
      "POST",
      `/resultados/${comId(resultadoId)}/contestacoes`,
      entrada
    ),
  minhasContestacoes: (resultadoId: string) =>
    chamar(
      z.array(labContestacaoPropriaSchema),
      "GET",
      `/resultados/${comId(resultadoId)}/contestacoes`
    )
};
