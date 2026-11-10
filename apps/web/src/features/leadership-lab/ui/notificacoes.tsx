import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import {
  ContextoDeNotificacao,
  type Notificacao,
  type Notificar,
  type TomDaNotificacao
} from "./contexto-de-notificacao";
import { mola } from "./movimento";

type NotificacaoEmTela = Notificacao & { id: number };

const ICONES = { sucesso: CircleCheck, erro: CircleAlert, info: Info } as const;
const COR_DO_ICONE: Record<TomDaNotificacao, string> = {
  sucesso: "text-lab-sucesso",
  erro: "text-lab-perigo",
  info: "text-lab-info"
};
/** Quanto o aviso fica na tela. Erro fica mais: quem precisa agir precisa ler. */
const PERMANENCIA_MS: Record<TomDaNotificacao, number> = { sucesso: 5000, info: 5000, erro: 9000 };

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<NotificacaoEmTela[]>([]);
  const proximoId = useRef(1);

  const fechar = useCallback((id: number) => {
    setItens((atuais) => atuais.filter((n) => n.id !== id));
  }, []);

  const notificar = useCallback<Notificar>((notificacao) => {
    const id = proximoId.current++;
    // No máximo quatro ao mesmo tempo: a mais antiga cede lugar.
    setItens((atuais) => [...atuais.slice(-3), { ...notificacao, id }]);
  }, []);

  const valor = useMemo(() => notificar, [notificar]);

  return (
    <ContextoDeNotificacao.Provider value={valor}>
      {children}
      <div
        role="region"
        aria-label="Notificações"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {itens.map((item) => (
            <Aviso key={item.id} item={item} aoFechar={() => fechar(item.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ContextoDeNotificacao.Provider>
  );
}

function Aviso({ item, aoFechar }: { item: NotificacaoEmTela; aoFechar: () => void }) {
  const [pausado, setPausado] = useState(false);
  const Icone = ICONES[item.tom];
  const fecharRef = useRef(aoFechar);
  useEffect(() => {
    fecharRef.current = aoFechar;
  });

  useEffect(() => {
    if (pausado) return;
    const id = setTimeout(() => fecharRef.current(), PERMANENCIA_MS[item.tom]);
    return () => clearTimeout(id);
  }, [pausado, item.tom]);

  return (
    <motion.div
      layout
      role={item.tom === "erro" ? "alert" : "status"}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={mola.suave}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-lab-lg border border-lab-linha bg-lab-superficie/95 p-4 shadow-lab-2 backdrop-blur-xl"
    >
      <Icone
        size={20}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", COR_DO_ICONE[item.tom])}
      />
      <div className="min-w-0 flex-1">
        <p className="text-lab-pequeno font-semibold text-lab-tinta">{item.titulo}</p>
        {item.descricao ? (
          <p className="mt-0.5 text-lab-pequeno leading-5 text-lab-tinta-2">{item.descricao}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dispensar notificação"
        onClick={aoFechar}
        className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-lab-tinta-3 transition-colors hover:bg-lab-tinta/5 hover:text-lab-tinta"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </motion.div>
  );
}
