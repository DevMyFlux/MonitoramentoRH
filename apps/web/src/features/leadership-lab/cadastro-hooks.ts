// Leadership Lab — consultas e ações dos cadastros do RH e da configuração dos moldes.
//
// Cada ação invalida só o que ela muda. As buscas (colaboradores e usuários elegíveis) só rodam com
// o mínimo de letras que o servidor exige, e esperam o RH parar de digitar um instante.
import {
  type LabAtualizarMoldeEntrada,
  type LabAtualizarParticipanteEntrada,
  type LabAtualizarTurmaEntrada,
  type LabCadastrarParticipanteEntrada,
  type LabCriarTurmaEntrada,
  labBuscaMinimaCaracteres
} from "@my-flux/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { labCadastroApi } from "./cadastro-api";
import { repetirSoSeFalhaPassageira } from "./hooks";

export const chavesDoCadastro = {
  participantes: ["lab", "cadastro", "participantes"] as const,
  colaboradores: (busca: string) => ["lab", "cadastro", "colaboradores", busca] as const,
  usuarios: (busca: string) => ["lab", "cadastro", "usuarios", busca] as const,
  turmas: ["lab", "cadastro", "turmas"] as const,
  turma: (id: string) => ["lab", "cadastro", "turma", id] as const,
  moldes: ["lab", "cadastro", "moldes"] as const
};

/** Espera o valor parar de mudar por `ms` antes de devolvê-lo (para não buscar a cada tecla). */
export function useValorComAtraso<T>(valor: T, ms = 300): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return atrasado;
}

/** A busca já tem letras suficientes para o servidor aceitar? */
export const buscaValida = (busca: string) => busca.trim().length >= labBuscaMinimaCaracteres;

export function useParticipantes() {
  return useQuery({
    queryKey: chavesDoCadastro.participantes,
    queryFn: labCadastroApi.participantes,
    retry: repetirSoSeFalhaPassageira
  });
}

export function useColaboradoresElegiveis(busca: string) {
  const termo = busca.trim();
  return useQuery({
    queryKey: chavesDoCadastro.colaboradores(termo),
    queryFn: () => labCadastroApi.colaboradoresElegiveis(termo),
    enabled: buscaValida(termo),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useUsuariosElegiveis(busca: string) {
  const termo = busca.trim();
  return useQuery({
    queryKey: chavesDoCadastro.usuarios(termo),
    queryFn: () => labCadastroApi.usuariosElegiveis(termo),
    enabled: buscaValida(termo),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useCadastrarParticipante() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: LabCadastrarParticipanteEntrada) =>
      labCadastroApi.cadastrarParticipante(entrada),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.participantes });
      // Quem acabou de ser ligado deixa de ser elegível.
      void cliente.invalidateQueries({ queryKey: ["lab", "cadastro", "colaboradores"] });
      void cliente.invalidateQueries({ queryKey: ["lab", "cadastro", "usuarios"] });
    }
  });
}

export function useAtualizarParticipante() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...entrada }: { id: string } & LabAtualizarParticipanteEntrada) =>
      labCadastroApi.atualizarParticipante(id, entrada),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.participantes });
      void cliente.invalidateQueries({ queryKey: ["lab", "cadastro", "turma"] });
    }
  });
}

export function useTurmas() {
  return useQuery({
    queryKey: chavesDoCadastro.turmas,
    queryFn: labCadastroApi.turmas,
    retry: repetirSoSeFalhaPassageira
  });
}

export function useTurma(id: string) {
  return useQuery({
    queryKey: chavesDoCadastro.turma(id),
    queryFn: () => labCadastroApi.turma(id),
    retry: repetirSoSeFalhaPassageira
  });
}

export function useCriarTurma() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: LabCriarTurmaEntrada) => labCadastroApi.criarTurma(entrada),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesDoCadastro.turmas })
  });
}

export function useAtualizarTurma(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (entrada: LabAtualizarTurmaEntrada) => labCadastroApi.atualizarTurma(id, entrada),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.turmas });
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.turma(id) });
    }
  });
}

/** Incluir e tirar participantes devolvem a turma inteira, já atualizada: vai direto ao cache. */
export function useIncluirNaTurma(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (participanteId: string) => labCadastroApi.incluirNaTurma(id, participanteId),
    onSuccess: (turma) => {
      cliente.setQueryData(chavesDoCadastro.turma(id), turma);
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.turmas });
    }
  });
}

export function useRemoverDaTurma(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (participanteId: string) => labCadastroApi.removerDaTurma(id, participanteId),
    onSuccess: (turma) => {
      cliente.setQueryData(chavesDoCadastro.turma(id), turma);
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.turmas });
    }
  });
}

export function useConfigDosMoldes() {
  return useQuery({
    queryKey: chavesDoCadastro.moldes,
    queryFn: labCadastroApi.configDosMoldes,
    retry: repetirSoSeFalhaPassageira
  });
}

/** A resposta já é a configuração inteira, atualizada: vai direto ao cache. */
export function useAtualizarMolde() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ nivel, ...entrada }: { nivel: string } & LabAtualizarMoldeEntrada) =>
      labCadastroApi.atualizarMolde(nivel, entrada),
    onSuccess: (config) => {
      cliente.setQueryData(chavesDoCadastro.moldes, config);
      // O molde de cada participante, mostrado no cadastro, depende dos cargos e da liberação.
      void cliente.invalidateQueries({ queryKey: chavesDoCadastro.participantes });
    }
  });
}
