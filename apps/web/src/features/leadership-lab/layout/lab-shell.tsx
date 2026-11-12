import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, Suspense, useState } from "react";
import { useLocation } from "react-router-dom";
import { LoadingState, NotificacoesProvider } from "../ui";
import { transicao } from "../ui/movimento";
import "../ui/tokens.css";
import { LabHeader } from "./lab-header";
import { LabSidebar } from "./lab-sidebar";
import { chaveDaTransicao } from "./navegacao";

type LabShellProps = { breadcrumbs: string[]; children: ReactNode };

/**
 * O layout do Leadership Lab: menu lateral, topo translúcido e área de conteúdo com transição
 * entre páginas. É o equivalente do AppShell para este módulo, com o design system do Lab; o
 * resto do MY FLUX continua no AppShell. Carregado sob demanda (a rota o passa ao `App`).
 */
export function LabShell({ breadcrumbs, children }: LabShellProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <NotificacoesProvider>
        <div className="lab min-h-screen">
          <a href="#main-content" className="skip-link">
            Ir para o conteúdo
          </a>
          <AnimatePresence>
            {menuAberto ? (
              <motion.button
                key="fundo-do-menu"
                type="button"
                aria-label="Fechar menu"
                className="fixed inset-0 z-30 bg-lab-tinta/30 backdrop-blur-[2px] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transicao.base}
                onClick={() => setMenuAberto(false)}
              />
            ) : null}
          </AnimatePresence>
          <LabSidebar aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />
          <div className="lg:pl-[var(--lab-largura-menu)]">
            <LabHeader breadcrumbs={breadcrumbs} aoAbrirMenu={() => setMenuAberto(true)} />
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 outline-none lg:px-10 lg:pt-10"
            >
              {/* Só entrada: a página antiga sai na hora. Um "sair" animado a deixaria viva (e
                  reagindo a dados novos) por mais um instante, atrás da nova. */}
              <motion.div
                key={chaveDaTransicao(pathname)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: transicao.base }}
              >
                <Suspense fallback={<LoadingState />}>{children}</Suspense>
              </motion.div>
            </main>
          </div>
        </div>
      </NotificacoesProvider>
    </MotionConfig>
  );
}
