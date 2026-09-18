import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout";
import { clearSession, request, session } from "./features/my-flux/client";

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

  useEffect(() => {
    let mounted = true;
    const onSessionExpired = () => {
      clearSession();
      navigate("/login", { replace: true });
    };

    window.addEventListener("flux-session-expired", onSessionExpired);
    if (!session()) {
      navigate("/login", { replace: true });
    } else {
      void request<{ user: unknown }>("/auth/me")
        .then(() => {
          if (mounted) setChecking(false);
        })
        .catch(() => {
          if (!mounted) return;
          clearSession();
          navigate("/login", { replace: true });
        });
    }

    return () => {
      mounted = false;
      window.removeEventListener("flux-session-expired", onSessionExpired);
    };
  }, [location.pathname, navigate]);

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-sm text-slate-600">
        Validando sessão do MY FLUX...
      </main>
    );
  }

  return <AppShell breadcrumbs={breadcrumbs}>{children}</AppShell>;
}
