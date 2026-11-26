// Páginas que o perfil COMUM não tem: ele só tem o Leadership Lab. Quem é COMUM e abre o endereço
// (um link salvo do módulo antigo de Treinamentos, por exemplo) vai para o Lab. É arrumação da tela;
// quem barra de verdade é a API (a trava do COMUM).
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUsuarioAtual } from "../auth/use-usuario-atual";

export function SoParaEquipe({ children }: { children: ReactNode }) {
  const usuario = useUsuarioAtual();
  // Sem saber o perfil ainda, não mostra a página nem decide: espera.
  if (usuario.isPending) return null;
  if (usuario.data?.role === "COMUM") return <Navigate to="/lab" replace />;
  return <>{children}</>;
}
