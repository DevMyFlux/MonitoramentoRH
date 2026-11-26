// Leadership Lab — as consultas do acompanhamento unificado. Todas sob a chave ["lab", "acompanhamento"],
// que a decisão de uma contestação invalida (o teste deferido sai das médias).
import { useQuery } from "@tanstack/react-query";
import { type FiltroDoAcompanhamento, labAcompanhamentoApi } from "./acompanhamento-api";
import { repetirSoSeFalhaPassageira } from "./hooks";

export const chavesDoAcompanhamento = {
  todas: ["lab", "acompanhamento"] as const,
  resumo: (f: FiltroDoAcompanhamento) => ["lab", "acompanhamento", "resumo", f] as const,
  pessoas: (f: FiltroDoAcompanhamento) => ["lab", "acompanhamento", "pessoas", f] as const,
  pessoa: (id: string) => ["lab", "acompanhamento", "pessoa", id] as const,
  cenarios: (f: FiltroDoAcompanhamento) => ["lab", "acompanhamento", "cenarios", f] as const
};

export function useResumoDoAcompanhamento(filtro: FiltroDoAcompanhamento) {
  return useQuery({
    queryKey: chavesDoAcompanhamento.resumo(filtro),
    queryFn: () => labAcompanhamentoApi.resumo(filtro),
    retry: repetirSoSeFalhaPassageira
  });
}

export function usePessoasDoAcompanhamento(filtro: FiltroDoAcompanhamento, ativo: boolean) {
  return useQuery({
    queryKey: chavesDoAcompanhamento.pessoas(filtro),
    queryFn: () => labAcompanhamentoApi.pessoas(filtro),
    enabled: ativo,
    retry: repetirSoSeFalhaPassageira
  });
}

export function usePessoaDoAcompanhamento(participanteId: string) {
  return useQuery({
    queryKey: chavesDoAcompanhamento.pessoa(participanteId),
    queryFn: () => labAcompanhamentoApi.pessoa(participanteId),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useCenariosDoAcompanhamento(filtro: FiltroDoAcompanhamento, ativo: boolean) {
  return useQuery({
    queryKey: chavesDoAcompanhamento.cenarios(filtro),
    queryFn: () => labAcompanhamentoApi.cenarios(filtro),
    enabled: ativo,
    retry: repetirSoSeFalhaPassageira
  });
}
