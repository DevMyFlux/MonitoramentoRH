import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  breadcrumbs: string[];
  children: ReactNode;
};

export function AppShell({ breadcrumbs, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const menu = document.getElementById("main-sidebar");
    const focusable = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>("a[href], button, input") ?? []).filter(
        (el) => el.getClientRects().length > 0
      );
    focusable()[0]?.focus();
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
    <div className="min-h-screen bg-[#f6f8fa]">
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
        <Header breadcrumbs={breadcrumbs} onOpenMenu={() => setIsSidebarOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="workspace mx-auto max-w-[1560px] p-5 outline-none lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
