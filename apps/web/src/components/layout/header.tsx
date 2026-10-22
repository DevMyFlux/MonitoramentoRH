import { LogOut, Menu, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui";
import { Breadcrumbs } from "./breadcrumbs";
import { usePermissions } from "../../features/auth/session-store";
import { clearSession } from "../../features/my-flux/client";
type HeaderProps = { breadcrumbs: string[]; onOpenMenu: () => void };
export function Header({ breadcrumbs, onOpenMenu }: HeaderProps) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { user, roleLabel } = usePermissions();
  function logout() {
    clearSession();
    cache.clear();
    navigate("/login", { replace: true });
  }
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-[76px] items-center justify-between gap-3 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-label="Abrir menu"
            aria-controls="main-sidebar"
            className="lg:hidden"
            icon={<Menu size={20} />}
            onClick={onOpenMenu}
            variant="ghost"
          />
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="mr-4 hidden text-xs capitalize text-slate-500 xl:block">
            {new Intl.DateTimeFormat("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric"
            }).format(new Date())}
          </span>
          <Link
            to="/parametros"
            aria-label="Parâmetros"
            title="Parâmetros"
            className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-800"
          >
            <Settings size={18} />
          </Link>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          {user && (
            <span
              className="hidden text-right text-xs leading-tight text-slate-600 sm:block"
              data-testid="current-user"
            >
              <span className="block font-medium text-slate-800">{user.name}</span>
              <span>{roleLabel}</span>
            </span>
          )}
          <Button icon={<LogOut size={16} />} onClick={logout} variant="ghost">
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
