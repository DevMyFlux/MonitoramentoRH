import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout";
import { clearSession, request, saveSession, session } from "./features/my-flux/client";
import { setSessionUser, type SessionUser } from "./features/auth/session-store";

// Atalho de DESENVOLVIMENTO (opcional): entra sozinho com uma conta de teste em vez de passar pela tela de login.
// Só existe no servidor de desenvolvimento (`import.meta.env.DEV`) e só quando `VITE_DEV_AUTO_LOGIN=true`; o e-mail e a
// senha vêm de variáveis locais (`.env.local`, fora do git) — nenhuma credencial fica escrita no código.
// Em produção (build) esta constante é falsa e o login é SEMPRE exigido.
const DEV_AUTO_LOGIN = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTO_LOGIN === "true";

async function autoLoginAsDev(): Promise<void> {
  const email = import.meta.env.VITE_DEV_AUTO_LOGIN_EMAIL;
  const password = import.meta.env.VITE_DEV_AUTO_LOGIN_PASSWORD;
  if (!email || !password)
    throw new Error("Defina VITE_DEV_AUTO_LOGIN_EMAIL e VITE_DEV_AUTO_LOGIN_PASSWORD.");
  const payload = await request<{ accessToken: string; refreshToken: string }>(
    "/auth/login",
    "POST",
    { email, password }
  );
  saveSession(payload.accessToken, payload.refreshToken);
}

export function App({
  breadcrumbs = ["MY FLUX"],
  children
}: {
  breadcrumbs?: string[];
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState(false);
  // Bumped by the session-expired listener to force the effect below to
  // re-run (a plain setChecking(true) would re-render but NOT re-trigger the
  // async session check, since the effect isn't keyed on `checking`).
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadUser(): Promise<void> {
      const me = await request<{ user: SessionUser }>("/auth/me");
      setSessionUser(me.user);
    }

    async function ensureSession(): Promise<void> {
      if (!session()) {
        if (!DEV_AUTO_LOGIN) {
          navigate("/login", { replace: true });
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
        await loadUser();
        if (mounted) {
          setChecking(false);
          setAuthError(false);
        }
      } catch {
        if (!mounted) return;
        clearSession();
        if (!DEV_AUTO_LOGIN) {
          navigate("/login", { replace: true });
          return;
        }
        try {
          await autoLoginAsDev();
          await loadUser();
          if (mounted) {
            setChecking(false);
            setAuthError(false);
          }
        } catch {
          if (mounted) setAuthError(true);
        }
      }
    }

    const onSessionExpired = () => {
      clearSession();
      if (!DEV_AUTO_LOGIN) {
        navigate("/login", { replace: true });
        return;
      }
      setChecking(true);
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
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center text-sm text-slate-600">
        <div>
          <p>Não foi possível entrar automaticamente com a conta de teste.</p>
          <p className="mt-2">
            Verifique se a API está no ar e as variáveis VITE_DEV_AUTO_LOGIN_*.
          </p>
        </div>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-sm text-slate-600">
        Validando sessão do MY FLUX...
      </main>
    );
  }

  return <AppShell breadcrumbs={breadcrumbs}>{children}</AppShell>;
}
