import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout";
import { clearSession, request, saveSession, session } from "./features/my-flux/client";

// TEST MODE (temporary, at the system owner's request): no login screen, every visitor is signed
// in as the seeded DEV user (apps/api/prisma/seed.ts), in production too, and the demo credentials
// below ship in the bundle. To require login again, build the web app with
// VITE_MODO_TESTE_SEM_LOGIN=false (or change the default here): the /login screen comes back and
// the bundler drops the credentials from the output.
const DEV_AUTO_LOGIN = import.meta.env.VITE_MODO_TESTE_SEM_LOGIN !== "false";

async function autoLoginAsDev(): Promise<void> {
  const payload = await request<{ accessToken: string; refreshToken: string }>(
    "/auth/login",
    "POST",
    { email: "dev@myflux.local", password: "ChangeMe!2026" }
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
        await request<{ user: unknown }>("/auth/me");
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
          <p>Não foi possível entrar automaticamente como Dev.</p>
          <p className="mt-2">Verifique se a API está no ar e recarregue a página.</p>
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
