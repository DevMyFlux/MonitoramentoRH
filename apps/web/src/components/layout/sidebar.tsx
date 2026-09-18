import { useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { navigationGroups } from "../../features/navigation/nav-items";
import { cn } from "../../lib/cn";
import { Brand } from "../brand";

type SidebarProps = { isOpen?: boolean; onNavigate?: () => void };
export function Sidebar({ isOpen = true, onNavigate }: SidebarProps) {
  const [query, setQuery] = useState("");
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const groups = navigationGroups
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
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
        isOpen ? "translate-x-0" : "invisible -translate-x-full lg:visible"
      )}
    >
      <div className="flex h-24 shrink-0 items-center justify-between px-6">
        <Link to="/" onClick={onNavigate} aria-label="MyFlux — início">
          <Brand />
        </Link>
        <button
          className="rounded-lg p-2 text-slate-500 lg:hidden"
          aria-label="Fechar menu"
          onClick={onNavigate}
        >
          <X size={20} />
        </button>
      </div>
      <div className="mx-4 mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400">
        <Search size={16} />
        <input
          aria-label="Buscar no menu"
          className="h-10 w-full min-w-0 bg-transparent text-xs text-slate-700 outline-none"
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
      <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-5">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  end={item.href === "/"}
                  to={item.href}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition",
                      isActive
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )
                  }
                >
                  <item.icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && (
          <p className="px-3 text-xs leading-5 text-slate-500">
            Nenhum módulo encontrado. Tente outro nome.
          </p>
        )}
      </nav>
      <div className="m-3 rounded-xl bg-[#123f36] p-4 text-white">
        <p className="text-xs font-medium text-emerald-100">Da necessidade à escala.</p>
        <Link
          to="/qlp"
          onClick={onNavigate}
          className="mt-2 flex items-center justify-between text-xs text-white/70 hover:text-white"
        >
          Acompanhar planejamento <ArrowUpRight size={16} />
        </Link>
      </div>
    </aside>
  );
}
