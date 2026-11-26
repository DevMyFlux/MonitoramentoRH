import { homeFor } from "@my-flux/shared";
import { Navigate } from "react-router-dom";
import { useUsuarioAtual } from "../features/auth/use-usuario-atual";
import { session } from "../features/my-flux/client";
import { modoDeTesteSemLogin } from "../modo-de-teste";

/**
 * A página inicial ("/"): sem sessão, o login; com sessão, a inicial do perfil (a primeira rota
 * permitida do menu; o COMUM cai no Leadership Lab).
 */
export function HomeRedirect() {
  const usuario = useUsuarioAtual();
  if (!session())
    // No modo de teste não há tela de login: a página de destino entra sozinha.
    return <Navigate to={modoDeTesteSemLogin() ? "/colaboradores" : "/login"} replace />;
  if (usuario.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-sm text-slate-600">
        Carregando...
      </main>
    );
  }
  return <Navigate to={homeFor(usuario.data?.role, usuario.data?.menu)} replace />;
}
