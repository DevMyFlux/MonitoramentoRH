import { homeFor, podeAbrirRota } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { type ComponentType, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout";
import { ApiError, clearSession, request, saveSession, session } from "./features/my-flux/client";
import { AssistenteDeSuporte } from "./features/suporte/assistente-de-suporte";

// MODO DE TESTE (desligado por padrão; só com VITE_MODO_TESTE_SEM_LOGIN=true): sem tela de login,
// todo visitante entra como o DEV do seed e as credenciais de demonstração vão no pacote. Nunca ligar
// em um ambiente com dados reais. Fica numa constante do build para o empacotador retirar o trecho.
const DEV_AUTO_LOGIN = import.meta.env.VITE_MODO_TESTE_SEM_LOGIN === "true";

async function autoLoginAsDev(): Promise<void> {
  const payload = await request<{ accessToken: string; refreshToken: string }>(
    "/auth/login",
    "POST",
    { email: "dev@myflux.local", password: "ChangeMe!2026" }
  );
  saveSession(payload.accessToken, payload.refreshToken);
}

/** O layout que envolve a página: o AppShell do sistema, ou o de um módulo com visual próprio. */
type LayoutDaPagina = ComponentType<{ breadcrumbs: string[]; children: ReactNode }>;

export function App({
  breadcrumbs = ["MY FLUX"],
  children,
  layout: Layout = AppShell
}: {
  breadcrumbs?: string[];
  children?: ReactNode;
  layout?: LayoutDaPagina;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState<AuthenticatedUser | null>(null);
  const [authError, setAuthError] = useState(false);
  // Bumped by the session-expired listener to force the effect below to
  // re-run (a plain state reset would re-render but NOT re-trigger the
  // async session check, since the effect isn't keyed on it).
  const [retryTick, setRetryTick] = useState(0);
  // O endereço atual, para o login voltar a ele depois (inclusive quando a sessão expira no meio).
  const pretendida = useRef("");
  useEffect(() => {
    pretendida.current = `${location.pathname}${location.search}`;
  }, [location.pathname, location.search]);

  useEffect(() => {
    let mounted = true;
    const irAoLogin = () =>
      navigate("/login", { replace: true, state: { from: pretendida.current } });

    async function conferir(): Promise<void> {
      const { user } = await request<{ user: AuthenticatedUser }>("/auth/me");
      if (mounted) {
        setUsuario(user);
        setAuthError(false);
      }
    }

    async function ensureSession(): Promise<void> {
      if (!session()) {
        if (!DEV_AUTO_LOGIN) {
          irAoLogin();
          return;
        }
        try {
          await autoLoginAsDev();
        } catch {
          if (mounted) setAuthError(true);
          return;
        }
      }

      try {
        await conferir();
      } catch (erro) {
        if (!mounted) return;
        if (!DEV_AUTO_LOGIN) {
          // Só o 401 encerra a sessão: rede fora ou erro do servidor não deslogam ninguém.
          if (erro instanceof ApiError && erro.status === 401) {
            clearSession();
            irAoLogin();
          } else setAuthError(true);
          return;
        }
        clearSession();
        try {
          await autoLoginAsDev();
          await conferir();
        } catch {
          if (mounted) setAuthError(true);
        }
      }
    }

    const onSessionExpired = () => {
      clearSession();
      if (!DEV_AUTO_LOGIN) {
        irAoLogin();
        return;
      }
      setUsuario(null);
      setRetryTick((tick) => tick + 1);
    };

    window.addEventListener("flux-session-expired", onSessionExpired);
    void ensureSession();

    return () => {
      mounted = false;
      window.removeEventListener("flux-session-expired", onSessionExpired);
    };
  }, [location.pathname, navigate, retryTick]);

  if (authError) {
    return (
      <main
        role="alert"
        className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center text-sm text-slate-600"
      >
        <div>
          <p>
            {DEV_AUTO_LOGIN
              ? "Não foi possível entrar automaticamente como Dev."
              : "Não foi possível validar a sua sessão."}
          </p>
          <p className="mt-2">Verifique se a API está no ar e recarregue a página.</p>
        </div>
      </main>
    );
  }

  // Nada da página aparece antes de se saber quem é.
  if (!usuario) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-sm text-slate-600">
        Validando sessão do MY FLUX...
      </main>
    );
  }

  if (!podeAbrirRota(usuario.role, location.pathname))
    return <Navigate to={homeFor(usuario.role, usuario.menu)} replace />;

  return (
    // O Suspense é para o layout de um módulo carregado sob demanda (o do Leadership Lab).
    <>
      <Suspense fallback={<div className="min-h-screen bg-mf-fundo" />}>
        <Layout breadcrumbs={breadcrumbs}>{children}</Layout>
      </Suspense>
      {/* O assistente de suporte: em todas as telas autenticadas, fora do layout de cada módulo. */}
      <AssistenteDeSuporte />
    </>
  );
}
