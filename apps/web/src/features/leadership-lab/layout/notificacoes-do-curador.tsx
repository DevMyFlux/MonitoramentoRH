// Leadership Lab — o sino de notificações do topo (só para quem acompanha o Lab: RH e DEV).
//
// Mostra o que espera decisão do curador, vindo do servidor já filtrado pelas turmas dele. Cada
// item diz o que é, de quem vem e há quanto tempo, e leva à tela onde é tratado. Abrir o item o
// marca como lido; "Marcar todas" limpa as bolinhas. Tratar o item na sua tela o tira da lista.
import type { LabNotificacao, LabTipoDeNotificacao } from "@my-flux/shared";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Lightbulb,
  MessageSquareWarning
} from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { useMarcarNotificacoes, useNotificacoes } from "../curadoria-hooks";
import { mola } from "../ui/movimento";
import { tempoRelativo } from "./tempo-relativo";

const icones: Record<LabTipoDeNotificacao, typeof Bell> = {
  resultado: ClipboardCheck,
  alerta: AlertTriangle,
  contestacao: MessageSquareWarning,
  contribuicao: Lightbulb
};

function Item({ item, aoAbrir }: { item: LabNotificacao; aoAbrir: (i: LabNotificacao) => void }) {
  const Icone = icones[item.tipo];
  const urgente = item.prioridade === "urgente";
  return (
    <li>
      <Link
        to={item.destino}
        onClick={() => aoAbrir(item)}
        className={cn(
          "group flex gap-3 rounded-lab-md px-3 py-2.5 outline-none transition-colors hover:bg-lab-tinta/5 focus-visible:bg-lab-tinta/5",
          !item.lida && "bg-lab-destaque-suave/50"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
            urgente
              ? "bg-lab-perigo-suave text-lab-perigo-texto"
              : "bg-lab-superficie-3 text-lab-tinta-2"
          )}
        >
          <Icone size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="text-lab-pequeno font-medium leading-5 text-lab-tinta">
              {item.titulo}
              {item.lida ? null : <span className="sr-only"> (não lida)</span>}
            </span>
            {item.lida ? null : (
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lab-destaque"
              />
            )}
          </span>
          <span className="mt-0.5 block text-lab-legenda leading-4 text-lab-tinta-2">
            {item.descricao}
          </span>
          <span className="mt-1 block truncate text-lab-legenda text-lab-tinta-3">
            {item.origem.participante} · {item.origem.operacao} ·{" "}
            <time dateTime={item.criadoEm}>{tempoRelativo(item.criadoEm)}</time>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function NotificacoesDoCurador() {
  const [aberto, setAberto] = useState(false);
  const idDoPainel = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const consulta = useNotificacoes(true);
  const marcar = useMarcarNotificacoes();
  const dados = consulta.data;
  const naoLidas = dados?.naoLidas ?? 0;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === "Escape" && aberto) {
      setAberto(false);
      botao.current?.focus();
    }
  }

  function abrirItem(item: LabNotificacao) {
    setAberto(false);
    if (!item.lida) marcar.mutate({ chaves: [item.chave] });
  }

  const rotulo =
    naoLidas > 0
      ? `Notificações (${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"})`
      : "Notificações";

  return (
    <div ref={raiz} className="relative" onKeyDown={aoTeclar}>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoPainel : undefined}
        onClick={() => setAberto((a) => !a)}
        className="relative grid h-11 w-11 place-items-center rounded-full text-lab-tinta-2 outline-none transition-colors hover:bg-lab-tinta/5 hover:text-lab-tinta focus-visible:ring-2 focus-visible:ring-lab-destaque"
      >
        <Bell size={19} aria-hidden="true" />
        {naoLidas > 0 ? (
          <span
            aria-hidden="true"
            className="tabular absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-lab-perigo px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-lab-fundo"
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {aberto ? (
          <motion.div
            id={idDoPainel}
            role="dialog"
            aria-label="Notificações"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={mola.viva}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lab-lg border border-lab-linha bg-lab-superficie/95 shadow-lab-2 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-lab-linha px-4 py-3">
              <div>
                <h2 className="text-lab-pequeno font-semibold text-lab-tinta">Notificações</h2>
                {dados ? (
                  <p className="text-lab-legenda text-lab-tinta-2">
                    {dados.totalPendente === 0
                      ? "Nada pendente"
                      : `${dados.totalPendente} ${dados.totalPendente === 1 ? "item espera" : "itens esperam"} você`}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={naoLidas === 0 || marcar.isPending}
                onClick={() => marcar.mutate({ todas: true })}
                className="inline-flex h-8 items-center gap-1.5 rounded-lab-sm px-2 text-lab-legenda font-medium text-lab-destaque-texto outline-none transition-colors hover:bg-lab-destaque-suave focus-visible:ring-2 focus-visible:ring-lab-destaque disabled:pointer-events-none disabled:text-lab-tinta-3"
              >
                <CheckCheck size={14} aria-hidden="true" />
                Marcar todas
              </button>
            </div>
            <div className="max-h-[min(26rem,70vh)] overflow-y-auto overscroll-contain p-1.5">
              {consulta.isPending ? (
                <p className="px-3 py-8 text-center text-lab-pequeno text-lab-tinta-2">
                  Carregando…
                </p>
              ) : consulta.isError || !dados ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-lab-pequeno text-lab-tinta-2">
                    Não foi possível carregar as notificações.
                  </p>
                  <button
                    type="button"
                    onClick={() => void consulta.refetch()}
                    className="mt-2 text-lab-pequeno font-medium text-lab-destaque-texto underline-offset-4 hover:underline"
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : dados.itens.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-lab-destaque-suave text-lab-destaque-texto">
                    <CheckCheck size={18} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-lab-pequeno font-medium text-lab-tinta">Tudo em dia</p>
                  <p className="mt-1 text-lab-legenda text-lab-tinta-2">
                    Resultados, alertas, contestações e contribuições novos aparecem aqui.
                  </p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {dados.itens.map((item) => (
                    <Item key={item.chave} item={item} aoAbrir={abrirItem} />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
