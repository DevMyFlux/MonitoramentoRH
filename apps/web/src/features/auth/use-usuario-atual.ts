// Quem está logado. A página de cada módulo já chamava /auth/me só para validar a sessão e
// descartava a resposta; o menu e a página inicial precisam do perfil, então a resposta fica em
// cache (uma chamada, compartilhada) em vez de cada tela perguntar de novo.
import type { AuthenticatedUser } from "@my-flux/types";
import { useQuery } from "@tanstack/react-query";
import { request, session } from "../my-flux/client";

export const chaveDoUsuarioAtual = ["auth", "me"] as const;

export function useUsuarioAtual() {
  return useQuery({
    queryKey: chaveDoUsuarioAtual,
    queryFn: async (): Promise<AuthenticatedUser> =>
      (await request<{ user: AuthenticatedUser }>("/auth/me")).user,
    // Só pergunta com uma sessão: sem ela o App já manda para o login.
    enabled: Boolean(session()),
    staleTime: 5 * 60_000,
    retry: false
  });
}
