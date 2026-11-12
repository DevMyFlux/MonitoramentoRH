// Leadership Lab — consultas e ações do participante (TanStack Query).
//
// O teste em andamento tem UM dono: o cache de `chaves.testeAtual`. A tela do teste só o lê; as
// ações (iniciar, responder, tempo esgotado) o atualizam com a resposta do servidor. Assim o que
// está na tela é sempre o que o servidor mandou por último.
import type { LabClassificarEntrada, LabConversaEntrada, LabEstadoDoTeste } from "@my-flux/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../my-flux/client";
import { labApi } from "./api";

export const chaves = {
  painel: ["lab", "painel"] as const,
  testeAtual: ["lab", "teste-atual"] as const,
  resultado: (sessaoId: string) => ["lab", "resultado", sessaoId] as const
};

/**
 * O teste em andamento, com o instante (performance.now) em que chegou ao navegador. O cronômetro
 * conta a partir deste instante, então voltar a uma tela que já estava em cache não "devolve" o
 * tempo que passou.
 */
export type TesteRecebido = { resposta: LabEstadoDoTeste; recebidaEm: number };

/** Erro do cliente (4xx) não melhora repetindo; falha de rede ou 5xx ganha uma segunda tentativa. */
export function repetirSoSeFalhaPassageira(tentativas: number, erro: unknown): boolean {
  if (erro instanceof ApiError && erro.status < 500) return false;
  return tentativas < 1;
}

/** Uma mensagem ao facilitador. A conversa mora no componente: não há cache nem persistência. */
export function useConversar(sessaoId: string) {
  return useMutation({
    mutationFn: (entrada: LabConversaEntrada) => labApi.conversar(sessaoId, entrada),
    retry: false
  });
}

/** Uma mensagem ao facilitador no espaço de aprendizagem (sem teste). */
export function useAprender() {
  return useMutation({
    mutationFn: (entrada: LabConversaEntrada) => labApi.aprender(entrada),
    retry: false
  });
}

export function usePainel() {
  return useQuery({
    queryKey: chaves.painel,
    queryFn: labApi.painel,
    retry: repetirSoSeFalhaPassageira
  });
}

export function useAceitarTermo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: labApi.aceitarTermo,
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.painel })
  });
}

/**
 * Inicia o teste (ação do clique em "Iniciar teste"). Guarda a primeira situação no cache, e a
 * tela do teste já abre mostrando-a.
 */
export function useIniciarTeste() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (categoriaId?: string) => labApi.iniciarTeste(categoriaId),
    onSuccess: (resposta) => {
      if (resposta.tipo === "situacao") {
        const recebido: TesteRecebido = { resposta, recebidaEm: performance.now() };
        cliente.setQueryData(chaves.testeAtual, recebido);
      }
      void cliente.invalidateQueries({ queryKey: chaves.painel });
    }
  });
}

export function useResultado(sessaoId: string) {
  return useQuery({
    queryKey: chaves.resultado(sessaoId),
    queryFn: () => labApi.resultado(sessaoId),
    retry: repetirSoSeFalhaPassageira
  });
}

/** Os temas da simulação local. Só se pede quando o painel diz que é modo demonstração. */
export function useTemasSimulados(habilitado: boolean) {
  return useQuery({
    queryKey: ["lab", "temas-simulados"] as const,
    queryFn: labApi.temasSimulados,
    enabled: habilitado,
    staleTime: 5 * 60_000,
    retry: repetirSoSeFalhaPassageira
  });
}

/** Classifica o texto do participante em um tema. Não entra no cache: o texto não deve ficar por aí. */
export function useClassificarProblema() {
  return useMutation({
    mutationFn: (entrada: LabClassificarEntrada) => labApi.classificarProblema(entrada),
    gcTime: 0
  });
}
