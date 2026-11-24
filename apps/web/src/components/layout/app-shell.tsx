import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { FundoAmbiente } from "../ui/fundo-ambiente";
import { Dock } from "./dock";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  breadcrumbs: string[];
  children: ReactNode;
};

export function AppShell({ breadcrumbs, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Pedido de busca com o menu do celular fechado: abre o menu e o foco vai para a busca, não para o logo.
  const focarBusca = useRef(false);

  const buscar = useCallback(() => {
    const campo = document.getElementById("busca-do-menu");
    const desktop =
      typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches;
    if (desktop) {
      campo?.focus();
      return;
    }
    focarBusca.current = true;
    setIsSidebarOpen(true);
  }, []);

  // Ctrl+K (ou Cmd+K) leva à busca de módulos de qualquer tela.
  useEffect(() => {
    const atalho = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        buscar();
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, [buscar]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const menu = document.getElementById("main-sidebar");
    const focusable = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>("a[href], button, input") ?? []).filter(
        (el) => el.getClientRects().length > 0
      );
    if (focarBusca.current) document.getElementById("busca-do-menu")?.focus();
    else focusable()[0]?.focus();
    focarBusca.current = false;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [isSidebarOpen]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate min-h-screen bg-mf-fundo">
        <FundoAmbiente />
        <a href="#main-content" className="skip-link">
          Ir para o conteúdo
        </a>
        {isSidebarOpen ? (
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          />
        ) : null}
        <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
        <div className="lg:pl-64">
          <Header
            breadcrumbs={breadcrumbs}
            onOpenMenu={() => setIsSidebarOpen(true)}
            onBuscar={buscar}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="workspace mx-auto max-w-[1560px] p-5 pb-28 outline-none lg:p-8"
          >
            {children}
          </main>
        </div>
        <Dock />
      </div>
    </MotionConfig>
  );
}
