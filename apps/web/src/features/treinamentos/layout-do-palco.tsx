// O layout do Ambiente Palco: a página escurece numa transição curta ao entrar (e o resto do sistema
// volta ao claro ao sair). Sem menu lateral, sem dock e sem fundo animado do sistema: só a barra
// de volta e o conteúdo. O assistente de suporte some nestas rotas (assistenteVisivelEm).
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function LayoutDoPalco({ children }: { breadcrumbs: string[]; children: ReactNode }) {
  const reduzido = useReducedMotion() === true;
  return (
    <motion.div
      initial={reduzido ? false : { backgroundColor: "rgb(246 248 250)" }}
      animate={{ backgroundColor: "rgb(2 6 23)" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="min-h-screen bg-mf-tinta text-white"
    >
      <a href="#conteudo-do-palco" className="skip-link">
        Ir para o conteúdo
      </a>
      <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/treinamentos"
          className="inline-flex min-h-11 items-center gap-2 rounded-mf-controle px-2 text-sm font-medium text-slate-200 hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Meus treinamentos
        </Link>
        <p className="hidden font-display text-sm font-bold tracking-tight text-slate-300 sm:block">
          MY FLUX · Treinamentos Interativos
        </p>
      </header>
      <main
        id="conteudo-do-palco"
        tabIndex={-1}
        className="mx-auto max-w-[1400px] px-3 pb-10 outline-none sm:px-6"
      >
        {children}
      </main>
    </motion.div>
  );
}
