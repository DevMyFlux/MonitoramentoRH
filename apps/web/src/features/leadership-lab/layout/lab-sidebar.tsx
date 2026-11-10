import { Layers2, X } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import { useUsuarioAtual } from "../../auth/use-usuario-atual";
import { gruposDoMenu, itemAtivo } from "./navegacao";
import { modoDeTesteSemLogin } from "../../../modo-de-teste";
import { cn } from "../../../lib/cn";
import { Button } from "../ui";
import { useArmadilhaDeFoco } from "../ui/armadilha-de-foco";
import { mola } from "../ui/movimento";

type LabSidebarProps = { aberta: boolean; aoFechar: () => void };

export function LabSidebar({ aberta, aoFechar }: LabSidebarProps) {
  const { pathname } = useLocation();
  const perfil = useUsuarioAtual().data?.role;
  const grupos = gruposDoMenu(perfil, modoDeTesteSemLogin());
  const ativo = itemAtivo(
    pathname,
    grupos.flatMap((g) => g.items)
  );
  const painel = useArmadilhaDeFoco<HTMLElement>(aberta, aoFechar);

  return (
    <aside
      ref={painel}
      id="main-sidebar"
      aria-label="Menu principal"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[var(--lab-largura-menu)] flex-col border-r border-lab-linha bg-lab-superficie lg:bg-lab-superficie/85 lg:backdrop-blur-2xl transition-[transform,visibility] duration-lab ease-lab motion-reduce:transition-none lg:visible lg:translate-x-0",
        aberta ? "translate-x-0 shadow-lab-3 lg:shadow-none" : "invisible -translate-x-full"
      )}
    >
      <div className="flex h-[var(--lab-altura-topo)] shrink-0 items-center justify-between px-5">
        <Link
          to="/"
          onClick={aoFechar}
          aria-label="MyFlux — início"
          className="flex items-center gap-3 rounded-lab-md"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-lab-destaque-forte text-white shadow-lab-1">
            <Layers2 size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-[1.0625rem] font-semibold tracking-tight text-lab-tinta">
              MyFlux
            </span>
            <span className="block text-lab-legenda text-lab-tinta-2">Leadership Lab</span>
          </span>
        </Link>
        <Button
          aria-label="Fechar menu"
          className="lg:hidden"
          icon={<X size={18} aria-hidden="true" />}
          onClick={aoFechar}
          size="icon"
          variant="ghost"
        />
      </div>

      <nav className="rolagem-fina min-h-0 flex-1 space-y-7 overflow-y-auto px-3 pb-6 pt-3">
        <LayoutGroup id="menu-do-lab">
          {grupos.map((grupo) => (
            <section key={grupo.label}>
              <h2 className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wide text-lab-tinta-2">
                {grupo.label}
              </h2>
              <ul className="space-y-0.5">
                {grupo.items.map((item) => {
                  const selecionado = item.href === ativo;
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        onClick={aoFechar}
                        aria-current={selecionado ? "page" : undefined}
                        className={cn(
                          "relative flex min-h-10 items-center gap-3 rounded-lab-md px-3 py-2 text-lab-pequeno font-medium transition-colors duration-lab-rapida",
                          selecionado
                            ? "text-lab-tinta"
                            : "text-lab-tinta-2 hover:bg-lab-tinta/[0.04] hover:text-lab-tinta"
                        )}
                      >
                        {selecionado ? (
                          <motion.span
                            layoutId="indicador-do-menu"
                            transition={mola.viva}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-lab-md bg-lab-tinta/[0.06]"
                          />
                        ) : null}
                        <item.icon
                          size={18}
                          strokeWidth={1.7}
                          aria-hidden="true"
                          className={cn("relative", selecionado && "text-lab-destaque")}
                        />
                        <span className="relative">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </LayoutGroup>
      </nav>
    </aside>
  );
}
