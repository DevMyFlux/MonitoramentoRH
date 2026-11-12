// Leadership Lab — os números da visão geral do RH, derivados do que a API já devolve (a lista de
// resultados das turmas do curador). Nada aqui é regra de negócio: são contagens e médias simples
// dos valores gravados, separadas do desenho para poderem ser testadas.
import { arredondar, labLimiteDasListasDoCurador, type LabItemDaRevisao } from "@my-flux/shared";

export type ResumoDosResultados = {
  /** Quantos resultados entraram na conta. */
  total: number;
  /** A lista veio no limite do servidor: os números cobrem só os mais recentes. */
  parcial: boolean;
  participantes: number;
  aderenciaMedia: number | null;
  agilidadeMedia: number | null;
  validados: number;
};

const media = (valores: readonly number[]): number | null =>
  valores.length === 0 ? null : arredondar(valores.reduce((s, v) => s + v, 0) / valores.length, 1);

export function resumoDosResultados(itens: readonly LabItemDaRevisao[]): ResumoDosResultados {
  return {
    total: itens.length,
    parcial: itens.length >= labLimiteDasListasDoCurador,
    participantes: new Set(itens.map((i) => i.participante.id)).size,
    aderenciaMedia: media(itens.map((i) => i.aderenciaGeral)),
    agilidadeMedia: media(itens.map((i) => i.agilidade)),
    validados: itens.filter((i) => i.statusValidacao !== "aguardando_validacao").length
  };
}

export type FaixaDeAderencia = { faixa: string; resultados: number };

const LARGURA_DA_FAIXA = 20;

/** Quantos resultados caem em cada faixa de 20 pontos de aderência (a última inclui o 100). */
export function distribuicaoDaAderencia(itens: readonly LabItemDaRevisao[]): FaixaDeAderencia[] {
  const faixas = Array.from({ length: 100 / LARGURA_DA_FAIXA }, (_, i) => {
    const inicio = i * LARGURA_DA_FAIXA;
    const fim = inicio + LARGURA_DA_FAIXA;
    return { faixa: `${inicio}–${fim === 100 ? 100 : fim - 1}%`, resultados: 0 };
  });
  for (const item of itens) {
    const indice = Math.min(
      faixas.length - 1,
      Math.max(0, Math.floor(item.aderenciaGeral / LARGURA_DA_FAIXA))
    );
    const faixa = faixas[indice];
    if (faixa) faixa.resultados += 1;
  }
  return faixas;
}

export function descricaoDaDistribuicao(faixas: readonly FaixaDeAderencia[]): string {
  return faixas
    .map((f) => `${f.faixa}: ${f.resultados} ${f.resultados === 1 ? "resultado" : "resultados"}`)
    .join("; ");
}

export type LinhaPorTeste = {
  teste: string;
  resultados: number;
  aderenciaMedia: number;
  agilidadeMedia: number;
};

/** Os resultados agrupados pelo teste do cargo (molde), do que tem mais resultados para o que tem menos. */
export function resultadosPorTeste(itens: readonly LabItemDaRevisao[]): LinhaPorTeste[] {
  const grupos = new Map<string, LabItemDaRevisao[]>();
  for (const item of itens)
    grupos.set(item.moldeNome, [...(grupos.get(item.moldeNome) ?? []), item]);
  return [...grupos.entries()]
    .map(([teste, grupo]) => ({
      teste,
      resultados: grupo.length,
      aderenciaMedia: media(grupo.map((i) => i.aderenciaGeral)) ?? 0,
      agilidadeMedia: media(grupo.map((i) => i.agilidade)) ?? 0
    }))
    .sort((a, b) => b.resultados - a.resultados || a.teste.localeCompare(b.teste, "pt-BR"));
}
