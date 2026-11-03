import { Navigate } from "react-router-dom";
import { destinoInicial } from "../features/auth/destino-inicial";
import { useUsuarioAtual } from "../features/auth/use-usuario-atual";
import { session } from "../features/my-flux/client";

/**
 * A página inicial ("/"): leva cada perfil ao seu lugar. O participante do Leadership Lab (COMUM)
 * vai para o painel dele; os demais, para Colaboradores, como sempre. Sem sessão, ou sem conseguir
 * saber quem é, vai para Colaboradores, e é a página de lá que manda para o login.
 */
export function HomeRedirect() {
  const usuario = useUsuarioAtual();
  if (!session()) return <Navigate to="/colaboradores" replace />;
  if (usuario.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-sm text-slate-600">
        Carregando...
      </main>
    );
  }
  return <Navigate to={destinoInicial(usuario.data?.role)} replace />;
}
