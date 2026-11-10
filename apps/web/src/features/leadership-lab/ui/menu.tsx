import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { mola } from "./movimento";

export type ItemDeMenu =
  | { tipo: "link"; rotulo: string; para: string; icone?: ReactNode }
  | { tipo: "acao"; rotulo: string; aoClicar: () => void; icone?: ReactNode; perigo?: boolean };

type MenuDeAcoesProps = {
  /** O que o botão que abre o menu mostra. */
  gatilho: ReactNode;
  /** Nome do botão para leitor de tela (ex.: "Menu da conta"). */
  rotulo: string;
  itens: readonly ItemDeMenu[];
  /** Um cabeçalho dentro do menu (quem está logado, por exemplo). */
  cabecalho?: ReactNode;
  className?: string;
};

const classeDoItem =
  "flex min-h-10 w-full items-center gap-3 rounded-lab-sm px-3 text-left text-lab-pequeno text-lab-tinta outline-none transition-colors focus-visible:bg-lab-tinta/5 hover:bg-lab-tinta/5";

/**
 * Menu suspenso de ações. Teclado completo: Enter/Espaço/seta abrem; setas, Home e End percorrem;
 * Esc fecha e devolve o foco ao botão; Tab fecha. Clicar fora também fecha.
 */
export function MenuDeAcoes({ gatilho, rotulo, itens, cabecalho, className }: MenuDeAcoesProps) {
  const [aberto, setAberto] = useState(false);
  const idDoMenu = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const itensDoMenu = () =>
    Array.from(lista.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  // Ao abrir, o foco vai para o primeiro item.
  useEffect(() => {
    if (aberto) itensDoMenu()[0]?.focus();
  }, [aberto]);

  // Clique fora fecha.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  function aoTeclarNoGatilho(evento: KeyboardEvent) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAberto(true);
    }
  }

  function aoTeclarNaLista(evento: KeyboardEvent) {
    const itensAtuais = itensDoMenu();
    const indice = itensAtuais.indexOf(document.activeElement as HTMLElement);
    const mover = (para: number) => {
      evento.preventDefault();
      itensAtuais[(para + itensAtuais.length) % itensAtuais.length]?.focus();
    };
    if (evento.key === "ArrowDown") mover(indice + 1);
    else if (evento.key === "ArrowUp") mover(indice - 1);
    else if (evento.key === "Home") mover(0);
    else if (evento.key === "End") mover(itensAtuais.length - 1);
    else if (evento.key === "Escape") {
      evento.preventDefault();
      fechar(true);
    } else if (evento.key === "Tab") setAberto(false);
  }

  return (
    <div ref={raiz} className={cn("relative", className)}>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoMenu : undefined}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={aoTeclarNoGatilho}
        className="flex items-center gap-2 rounded-full p-1 pr-2.5 text-lab-tinta transition-colors hover:bg-lab-tinta/5"
      >
        {gatilho}
      </button>
      <AnimatePresence>
        {aberto ? (
          <motion.div
            ref={lista}
            id={idDoMenu}
            role="menu"
            aria-label={rotulo}
            onKeyDown={aoTeclarNaLista}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
            transition={mola.viva}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lab-lg border border-lab-linha bg-lab-superficie/95 p-1.5 shadow-lab-2 backdrop-blur-xl"
          >
            {cabecalho ? (
              <div className="border-b border-lab-linha px-3 pb-3 pt-2">{cabecalho}</div>
            ) : null}
            <div className={cn(cabecalho ? "pt-1.5" : "")}>
              {itens.map((item) =>
                item.tipo === "link" ? (
                  <Link
                    key={item.rotulo}
                    to={item.para}
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => setAberto(false)}
                    className={classeDoItem}
                  >
                    {item.icone}
                    {item.rotulo}
                  </Link>
                ) : (
                  <button
                    key={item.rotulo}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      setAberto(false);
                      item.aoClicar();
                    }}
                    className={cn(classeDoItem, item.perigo && "text-lab-perigo-texto")}
                  >
                    {item.icone}
                    {item.rotulo}
                  </button>
                )
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
