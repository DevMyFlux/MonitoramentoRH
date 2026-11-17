// Assistente de suporte do MY FLUX: um botão discreto no canto inferior direito, em todas as telas,
// que abre um painel de conversa. Ajuda de uso de qualquer módulo; não lê nem altera dados.
//
// A conversa fica na aba (sessionStorage) para sobreviver à troca de tela, e some ao fechar a aba.
// Só as últimas mensagens vão para o servidor (suporteLimites.historico).
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { LifeBuoy, Loader2, RotateCcw, SendHorizontal, X } from "lucide-react";
import { type SuporteMensagem, type SuporteResposta, suporteLimites } from "@my-flux/shared";
import { request } from "../my-flux/client";
import { cn } from "../../lib/cn";
import { assistenteVisivelEm, contextoDaPagina } from "./contexto-da-pagina";
import { LIMITE_DA_CHAMADA_MS, mensagemDoErro } from "./erros-do-suporte";

const CHAVE_CONVERSA = "flux.suporte.conversa";
const CHAVE_ABERTO = "flux.suporte.aberto";
/** Quantas mensagens a tela guarda (o servidor só recebe as últimas). */
const MAXIMO_NA_TELA = 40;

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = sessionStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (aba privada, bloqueio): a conversa só não sobrevive à troca de tela.
  }
}

export function AssistenteDeSuporte() {
  const { pathname } = useLocation();
  const contexto = contextoDaPagina(pathname);
  const idDoPainel = useId();
  const [aberto, setAberto] = useState<boolean>(() => ler(CHAVE_ABERTO, false));
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>(() =>
    ler<SuporteMensagem[]>(CHAVE_CONVERSA, [])
  );
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => gravar(CHAVE_CONVERSA, mensagens), [mensagens]);
  useEffect(() => gravar(CHAVE_ABERTO, aberto), [aberto]);

  useEffect(() => {
    if (aberto) campoRef.current?.focus();
  }, [aberto]);

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensagens, enviando, aberto]);

  if (!assistenteVisivelEm(pathname)) return null;

  function fechar() {
    setAberto(false);
    botaoRef.current?.focus();
  }

  async function enviar(pergunta: string) {
    const mensagem = pergunta.trim().slice(0, suporteLimites.mensagem);
    if (!mensagem || enviando) return;
    const historico = mensagens.slice(-suporteLimites.historico).map((m) => ({
      papel: m.papel,
      texto: m.texto.slice(0, suporteLimites.textoDoHistorico)
    }));
    setErro(null);
    setTexto("");
    setMensagens((atuais) =>
      [...atuais, { papel: "usuario" as const, texto: mensagem }].slice(-MAXIMO_NA_TELA)
    );
    setEnviando(true);
    try {
      const resposta = await request<SuporteResposta>(
        "/suporte/conversa",
        "POST",
        {
          mensagem,
          historico,
          pagina: { caminho: pathname.slice(0, suporteLimites.pagina), titulo: contexto.titulo }
        },
        false,
        LIMITE_DA_CHAMADA_MS
      );
      setMensagens((atuais) =>
        [...atuais, { papel: "assistente" as const, texto: resposta.resposta }].slice(
          -MAXIMO_NA_TELA
        )
      );
    } catch (falha) {
      // A pergunta volta para o campo, para a pessoa tentar de novo sem redigitar.
      setMensagens((atuais) => atuais.slice(0, -1));
      setTexto(mensagem);
      setErro(mensagemDoErro(falha));
    } finally {
      setEnviando(false);
      campoRef.current?.focus();
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(texto);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      void enviar(texto);
    }
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 print:hidden sm:bottom-5 sm:right-5"
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) fechar();
      }}
    >
      {aberto ? (
        <section
          id={idDoPainel}
          role="dialog"
          aria-label="Assistente de suporte"
          className="pointer-events-auto flex h-[min(34rem,calc(100dvh-6.5rem))] w-[min(23rem,calc(100vw-2rem))] origin-bottom-right animate-[suporte-entrar_180ms_cubic-bezier(0.22,1,0.36,1)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.35),0_4px_14px_rgb(15_23_42/0.08)]"
        >
          <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <LifeBuoy size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold leading-5">Assistente MY FLUX</h2>
              <p className="truncate text-xs text-slate-500" title={contexto.titulo}>
                Ajuda sobre {contexto.titulo}
              </p>
            </div>
            {mensagens.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setMensagens([]);
                  setErro(null);
                  campoRef.current?.focus();
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                aria-label="Nova conversa"
                title="Nova conversa"
              >
                <RotateCcw size={15} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={fechar}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
              aria-label="Fechar assistente"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>

          <div
            ref={listaRef}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
            aria-live="polite"
          >
            {mensagens.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  Olá! Posso explicar como usar qualquer área do sistema: telas, fluxos, erros e o
                  que o seu perfil pode fazer. Como posso ajudar?
                </p>
                <div className="flex flex-col items-start gap-2">
                  {contexto.sugestoes.map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => void enviar(sugestao)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              mensagens.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.papel === "usuario" ? "justify-end" : "justify-start")}
                >
                  <p
                    className={cn(
                      "max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm leading-6",
                      m.papel === "usuario"
                        ? "rounded-br-md bg-emerald-700 text-white"
                        : "rounded-bl-md bg-slate-100 text-slate-800"
                    )}
                  >
                    <span className="sr-only">
                      {m.papel === "usuario" ? "Você: " : "Assistente: "}
                    </span>
                    {m.texto}
                  </p>
                </div>
              ))
            )}
            {enviando ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Pensando…
              </div>
            ) : null}
          </div>

          <form onSubmit={aoEnviar} className="border-t border-slate-100 px-3 pb-3 pt-2">
            {erro ? (
              <p
                role="alert"
                className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
              >
                {erro}
              </p>
            ) : null}
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-emerald-400 focus-within:bg-white">
              <label htmlFor={`${idDoPainel}-campo`} className="sr-only">
                Sua dúvida
              </label>
              <textarea
                id={`${idDoPainel}-campo`}
                ref={campoRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={aoTeclar}
                maxLength={suporteLimites.mensagem}
                rows={1}
                placeholder="Escreva sua dúvida…"
                className="max-h-28 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                aria-label="Enviar"
              >
                <SendHorizontal size={15} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] leading-4 text-slate-400">
              Não informe dados pessoais. As respostas podem conter erros.
            </p>
          </form>
        </section>
      ) : null}

      <button
        ref={botaoRef}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-expanded={aberto}
        aria-controls={aberto ? idDoPainel : undefined}
        aria-label={aberto ? "Fechar assistente de suporte" : "Abrir assistente de suporte"}
        title={aberto ? undefined : "Precisa de ajuda?"}
        className="group pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-700 text-white shadow-[0_10px_30px_-8px_rgb(4_120_87/0.55),0_2px_6px_rgb(15_23_42/0.12)] ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {aberto ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <LifeBuoy size={21} aria-hidden="true" className="transition group-hover:rotate-12" />
        )}
      </button>
    </div>
  );
}
