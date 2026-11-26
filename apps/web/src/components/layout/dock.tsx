// Dock do MY FLUX: a navegação principal numa barra de vidro colada no pé da tela, só no celular
// (abaixo de lg; no desktop vale a barra lateral). Origem: ideia do "Dock" do React Bits
// (reactbits.dev), escrita do zero, sem a lupa nos ícones: no toque ela não serve, e o que importa
// aqui é o alvo grande (44 px ou mais), o rótulo sempre visível e o item ativo bem marcado.
// Por quê: o celular é o uso principal do RH, e o polegar alcança o pé da tela, não o menu do topo.
import { motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { itemAtivo, itensDoDock } from "../../features/navigation/nav-items";
import { cn } from "../../lib/cn";

/** Altura da barra, para o conteúdo e os botões flutuantes deixarem espaço. */
export const ALTURA_DO_DOCK = "4.25rem";

export function Dock() {
  const itens = itensDoDock(useUsuarioAtual().data?.menu);
  const ativo = itemAtivo(useLocation().pathname, itens);

  // Avisa a quem flutua no canto (o assistente) quanto espaço a barra ocupa. Só vale abaixo de lg,
  // que é onde ela aparece; acima disso a variável volta a 0 pelo CSS da própria barra.
  useEffect(() => {
    const raiz = document.documentElement;
    if (typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia("(max-width: 1023px)");
    const atualizar = () =>
      raiz.style.setProperty("--mf-dock-h", consulta.matches ? ALTURA_DO_DOCK : "0px");
    atualizar();
    consulta.addEventListener("change", atualizar);
    return () => {
      consulta.removeEventListener("change", atualizar);
      raiz.style.removeProperty("--mf-dock-h");
    };
  }, []);

  if (itens.length === 0) return null;
  return (
    <nav
      aria-label="Navegação principal"
      className="vidro fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-white/70 shadow-[0_10px_30px_-10px_rgb(var(--mf-tinta)/0.3),0_2px_6px_rgb(var(--mf-tinta)/0.06)] ring-1 ring-mf-linha/70 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around gap-1 p-1.5">
        {itens.map((item) => (
          <li key={item.href} className="min-w-0 flex-1">
            <Link
              to={item.href}
              aria-current={item.href === ativo ? "page" : undefined}
              className={cn(
                "relative flex min-h-[52px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium leading-none transition-colors",
                item.href === ativo ? "text-mf-primaria" : "text-mf-texto-3 hover:text-mf-tinta"
              )}
            >
              {item.href === ativo ? (
                <motion.span
                  layoutId="dock-ativo"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.7 }}
                  className="absolute inset-0 rounded-xl bg-mf-realce-suave ring-1 ring-inset ring-mf-realce"
                />
              ) : null}
              <item.icon
                size={20}
                strokeWidth={item.href === ativo ? 2.1 : 1.7}
                aria-hidden="true"
                className="relative"
              />
              <span className="relative max-w-full truncate">{item.curto ?? item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
