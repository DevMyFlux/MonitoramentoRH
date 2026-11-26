// Leadership Lab — o cliente do acompanhamento unificado (RH, ADMIN e DEV). Só leitura.
//
// Toda resposta passa pelo schema compartilhado. Os filtros vão na querystring e valem igual nas
// telas e na exportação: o servidor aplica o mesmo escopo nos dois.
import {
  labAcompanhamentoCenariosSchema,
  labAcompanhamentoPessoaDetalheSchema,
  labAcompanhamentoPessoasSchema,
  labAcompanhamentoResumoSchema
} from "@my-flux/shared";
import { download } from "../my-flux/client";
import { chamar } from "./api";

/** Os filtros como a tela os guarda: texto, e vazio quer dizer "sem filtro". */
export type FiltroDoAcompanhamento = {
  turmaId: string;
  publico: string;
  nivel: string;
  areaId: string;
  de: string;
  ate: string;
  status: string;
};

export const semFiltros: FiltroDoAcompanhamento = {
  turmaId: "",
  publico: "",
  nivel: "",
  areaId: "",
  de: "",
  ate: "",
  status: ""
};

/** "?turmaId=...&de=..." só com o que foi preenchido. */
export function consultaDosFiltros(filtro: Partial<FiltroDoAcompanhamento>, extra = ""): string {
  const partes = Object.entries(filtro)
    .filter(([, valor]) => valor !== undefined && valor !== "")
    .map(([chave, valor]) => `${chave}=${encodeURIComponent(valor)}`);
  if (extra) partes.push(extra);
  return partes.length ? `?${partes.join("&")}` : "";
}

export const labAcompanhamentoApi = {
  resumo: (filtro: FiltroDoAcompanhamento) =>
    chamar(
      labAcompanhamentoResumoSchema,
      "GET",
      `/acompanhamento/resumo${consultaDosFiltros(filtro)}`
    ),
  pessoas: (filtro: FiltroDoAcompanhamento) =>
    chamar(
      labAcompanhamentoPessoasSchema,
      "GET",
      `/acompanhamento/pessoas${consultaDosFiltros(filtro)}`
    ),
  pessoa: (participanteId: string) =>
    chamar(
      labAcompanhamentoPessoaDetalheSchema,
      "GET",
      `/acompanhamento/pessoas/${encodeURIComponent(participanteId)}`
    ),
  cenarios: (filtro: FiltroDoAcompanhamento) =>
    chamar(
      labAcompanhamentoCenariosSchema,
      "GET",
      `/acompanhamento/cenarios${consultaDosFiltros(filtro)}`
    ),
  /** Baixa o CSV da visão pedida, com os filtros da tela. */
  exportar: (filtro: FiltroDoAcompanhamento, visao: "sessoes" | "cenarios") =>
    download(
      `/leadership-lab/acompanhamento/exportar${consultaDosFiltros(filtro, `visao=${visao}`)}`,
      `acompanhamento-lab-${visao}.csv`
    )
};
