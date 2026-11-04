// Leadership Lab — consultas e ações da curadoria do RH e da contestação do participante.
//
// Cada ação invalida só o que ela muda. Decidir algo muda também os números das abas (pendências).
import type { LabCriarContestacaoEntrada, LabValidarResultadoEntrada } from "@my-flux/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { labCuradoriaApi } from "./curadoria-api";
import { repetirSoSeFalhaPassageira } from "./hooks";

export const chavesDaCuradoria = {
  pendencias: ["lab", "curadoria", "pendencias"] as const,
  revisao: (status: string) => ["lab", "curadoria", "revisao", status] as const,
  todasAsRevisoes: ["lab", "curadoria", "revisao"] as const,
  ficha: (resultadoId: string) => ["lab", "curadoria", "ficha", resultadoId] as const,
  alertas: (status: string) => ["lab", "curadoria", "alertas", status] as const,
  todosOsAlertas: ["lab", "curadoria", "alertas"] as const,
  contribuicoes: (status: string) => ["lab", "curadoria", "contribuicoes", status] as const,
  todasAsContribuicoes: ["lab", "curadoria", "contribuicoes"] as const,
  contestacoes: (status: string) => ["lab", "curadoria", "contestacoes", status] as const,
  todasAsContestacoes: ["lab", "curadoria", "contestacoes"] as const,
  minhasContestacoes: (resultadoId: string) => ["lab", "contestacoes", resultadoId] as const
};

/** Os números das abas. Se falhar, as abas só ficam sem número: nada depende deles. */
export function usePendencias() {
  return useQuery({
    queryKey: chavesDaCuradoria.pendencias,
    queryFn: labCuradoriaApi.pendencias,
    retry: false,
    staleTime: 15_000
  });
}

export function useRevisao(status: string) {
  return useQuery({
    queryKey: chavesDaCuradoria.revisao(status),
    queryFn: () => labCuradoriaApi.revisao(status),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useFicha(resultadoId: string) {
  return useQuery({
    queryKey: chavesDaCuradoria.ficha(resultadoId),
    queryFn: () => labCuradoriaApi.ficha(resultadoId),
    retry: repetirSoSeFalhaPassageira
  });
}

/** A resposta já é a ficha atualizada: vai direto ao cache, e a fila e os números se refazem. */
export function useValidar(resultadoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: LabValidarResultadoEntrada) =>
      labCuradoriaApi.validar(resultadoId, entrada),
    onSuccess: (ficha) => {
      cliente.setQueryData(chavesDaCuradoria.ficha(resultadoId), ficha);
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.todasAsRevisoes });
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.pendencias });
    }
  });
}

export function useAlertas(status: string) {
  return useQuery({
    queryKey: chavesDaCuradoria.alertas(status),
    queryFn: () => labCuradoriaApi.alertas(status),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useTratarAlerta() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: string }) =>
      labCuradoriaApi.tratarAlerta(id, nota),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.todosOsAlertas });
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.todasAsRevisoes });
      void cliente.invalidateQueries({ queryKey: ["lab", "curadoria", "ficha"] });
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.pendencias });
    }
  });
}

export function useContribuicoes(status: string) {
  return useQuery({
    queryKey: chavesDaCuradoria.contribuicoes(status),
    queryFn: () => labCuradoriaApi.contribuicoes(status),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useDecidirContribuicao() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisao }: { id: string; decisao: "aprovada" | "rejeitada" }) =>
      labCuradoriaApi.decidirContribuicao(id, decisao),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.todasAsContribuicoes });
      void cliente.invalidateQueries({ queryKey: ["lab", "curadoria", "ficha"] });
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.pendencias });
    }
  });
}

export function useContestacoes(status: string) {
  return useQuery({
    queryKey: chavesDaCuradoria.contestacoes(status),
    queryFn: () => labCuradoriaApi.contestacoes(status),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useDecidirContestacao() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decisao,
      nota
    }: {
      id: string;
      decisao: "aceita" | "rejeitada";
      nota: string;
    }) => labCuradoriaApi.decidirContestacao(id, decisao, nota),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.todasAsContestacoes });
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.todasAsRevisoes });
      void cliente.invalidateQueries({ queryKey: ["lab", "curadoria", "ficha"] });
      void cliente.invalidateQueries({ queryKey: chavesDaCuradoria.pendencias });
    }
  });
}

// ---- Participante ---------------------------------------------------------

export function useMinhasContestacoes(resultadoId: string) {
  return useQuery({
    queryKey: chavesDaCuradoria.minhasContestacoes(resultadoId),
    queryFn: () => labCuradoriaApi.minhasContestacoes(resultadoId),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useContestar(resultadoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: LabCriarContestacaoEntrada) =>
      labCuradoriaApi.contestar(resultadoId, entrada),
    onSuccess: () =>
      cliente.invalidateQueries({ queryKey: chavesDaCuradoria.minhasContestacoes(resultadoId) })
  });
}
