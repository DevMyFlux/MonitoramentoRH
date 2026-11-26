import { useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import { useUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { gruposVisiveis, itemAtivo } from "../../features/navigation/nav-items";
import { cn } from "../../lib/cn";
import { Brand } from "../brand";

type SidebarProps = { isOpen?: boolean; onNavigate?: () => void };
export function Sidebar({ isOpen = true, onNavigate }: SidebarProps) {
  const [query, setQuery] = useState("");
  const permitidas = useUsuarioAtual().data?.menu;
  const { pathname } = useLocation();
  const visiveis = gruposVisiveis(permitidas);
  const ativo = itemAtivo(
    pathname,
    visiveis.flatMap((g) => g.items)
  );
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const groups = visiveis
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => normalize(item.label).includes(normalize(query)))
    }))
    .filter((group) => group.items.length);
  return (
    <aside
      id="main-sidebar"
      aria-label="Menu principal"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-mf-linha bg-mf-cartao transition-transform lg:translate-x-0",
        isOpen ? "translate-x-0" : "invisible -translate-x-full lg:visible"
      )}
    >
      <div className="flex h-24 shrink-0 items-center justify-between px-6">
        <Link to="/" onClick={onNavigate} aria-label="MyFlux — início">
          <Brand />
        </Link>
        <button
          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-mf-controle text-mf-texto-3 lg:hidden"
          aria-label="Fechar menu"
          onClick={onNavigate}
        >
          <X size={20} />
        </button>
      </div>
      <div className="mx-4 mb-5 flex items-center gap-2 rounded-mf-controle border border-mf-linha bg-mf-fundo px-3 text-mf-texto-3 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-mf-azul">
        <Search size={16} aria-hidden="true" />
        <input
          id="busca-do-menu"
          aria-label="Buscar no menu"
          className="h-11 w-full min-w-0 bg-transparent text-xs text-mf-texto outline-none focus-visible:outline-none"
          placeholder="Encontrar um módulo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="Limpar busca do menu" onClick={() => setQuery("")}>
            <X size={14} />
          </button>
        )}
      </div>
      <nav aria-label="Módulos" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-5">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-mf-texto-3">
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  aria-current={item.href === ativo ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-3 rounded-mf-controle px-3 py-2 text-[13px] font-medium transition-colors",
                    item.href === ativo
                      ? "text-mf-primaria"
                      : "text-mf-texto-2 hover:bg-mf-fundo hover:text-mf-tinta"
                  )}
                >
                  {/* Indicador do item ativo: desliza de um item para o outro (layoutId). */}
                  {item.href === ativo ? (
                    <motion.span
                      layoutId="menu-ativo"
                      aria-hidden="true"
                      transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.7 }}
                      className="absolute inset-0 rounded-mf-controle bg-mf-realce-suave ring-1 ring-inset ring-mf-realce"
                    >
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-mf-brilho" />
                    </motion.span>
                  ) : null}
                  <item.icon
                    size={17}
                    strokeWidth={item.href === ativo ? 2 : 1.7}
                    aria-hidden="true"
                    className="relative"
                  />
                  <span className="relative">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && (
          <p className="px-3 text-xs leading-5 text-mf-texto-3">
            Nenhum módulo encontrado. Tente outro nome.
          </p>
        )}
      </nav>
      {permitidas?.includes("/escalas") ? (
      <div className="m-3 rounded-xl bg-mf-primaria p-4 text-white">
        <p className="text-xs font-medium text-emerald-100">Da necessidade à escala.</p>
        <Link
          to="/escalas"
          onClick={onNavigate}
          className="mt-2 flex items-center justify-between text-xs text-white/70 hover:text-white"
        >
          Ver escalas geradas <ArrowUpRight size={16} />
        </Link>
      </div>
      ) : null}
    </aside>
  );
}
