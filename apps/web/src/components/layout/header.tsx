import { LogOut, Menu, Search, Settings, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui";
import { Breadcrumbs } from "./breadcrumbs";
import { clearSession } from "../../features/my-flux/client";
import { useUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { resumoDoEscopo } from "../../features/auth/resumo-do-escopo";

type HeaderProps = { breadcrumbs: string[]; onOpenMenu: () => void; onBuscar: () => void };

export function Header({ breadcrumbs, onOpenMenu, onBuscar }: HeaderProps) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const usuario = useUsuarioAtual().data;
  const escopo = usuario ? resumoDoEscopo(usuario) : null;
  function logout() {
    clearSession();
    cache.clear();
    navigate("/login", { replace: true });
  }
  return (
    <header className="sticky top-0 z-30 vidro border-b border-mf-linha/70">
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
          {/* Busca de módulos: o mesmo campo do menu lateral, a um atalho de distância. */}
          <button
            type="button"
            onClick={onBuscar}
            aria-label="Buscar módulo (Ctrl+K)"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-mf-controle border border-mf-linha bg-mf-cartao/70 px-3 text-xs text-mf-texto-3 transition hover:border-mf-brilho/40 hover:text-mf-primaria"
          >
            <Search size={16} aria-hidden="true" />
            <span className="hidden md:inline">Buscar módulo</span>
            <kbd className="hidden rounded-md border border-mf-linha px-1.5 py-0.5 font-mono text-[10px] text-mf-texto-3 xl:inline">
              Ctrl K
            </kbd>
          </button>
          {escopo ? (
            <span
              className="hidden items-center gap-1.5 rounded-full bg-mf-realce-suave px-3 py-1.5 text-xs text-mf-primaria ring-1 ring-inset ring-mf-realce sm:inline-flex"
              title="O seu perfil e o alcance dos dados que você pode ver"
            >
              <ShieldCheck size={14} aria-hidden="true" />
              <span className="font-semibold">{escopo.perfil}</span>
              <span aria-hidden="true">·</span>
              <span>{escopo.alcance}</span>
            </span>
          ) : null}
          <span className="ml-2 mr-2 hidden text-xs capitalize text-mf-texto-3 2xl:block">
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
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-mf-controle text-mf-texto-3 hover:bg-mf-realce-suave hover:text-mf-primaria"
          >
            <Settings size={18} />
          </Link>
          <span className="mx-1 h-6 w-px bg-mf-linha" />
          <Button icon={<LogOut size={16} />} onClick={logout} variant="ghost">
            <span className="hidden sm:inline">Sair</span>
            <span className="sr-only sm:hidden">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
