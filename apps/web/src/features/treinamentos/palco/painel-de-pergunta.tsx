// O painel de vidro dentro do quadro: a pergunta com 4 alternativas (A–D) e, depois de responder, a
// reação daquela alternativa. Acessível por teclado:
//  - as alternativas são um radiogroup com foco itinerante: setas mudam a escolha, 1–4 escolhem
//    direto, Enter confirma; o botão "Responder" também confirma;
//  - ao abrir, o foco vai para o título da pergunta; ao abrir a reação, para o título da reação;
//  - o grupo é anunciado (role="group" com aria-live="polite"); sem limite de tempo.
// Nada aqui diz qual alternativa é "certa": o tom só aparece na reação, sempre com ícone e palavra.
import type { TreinoBeat } from "@my-flux/shared";
import { CircleAlert, CircleCheck, OctagonAlert } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../../../lib/cn";

const LETRAS = ["A", "B", "C", "D"];

type PerguntaVisivel = {
  id: string;
  prompt: string;
  alternatives: { indice: number; text: string }[];
};

export function PainelDePergunta({
  pergunta,
  numero,
  total,
  enviando,
  erro,
  aoResponder
}: {
  pergunta: PerguntaVisivel;
  numero: number;
  total: number;
  enviando: boolean;
  erro: string;
  aoResponder: (alternativa: number) => void;
}) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const opcoes = useRef<(HTMLDivElement | null)[]>([]);
  const idDoTitulo = `pergunta-${pergunta.id}`;

  // Uma pergunta nova remonta o painel (key no pai): a escolha volta a vazia e o foco vem para cá.
  useEffect(() => {
    titulo.current?.focus();
  }, [pergunta.id]);

  function escolher(indice: number, focar = true) {
    setEscolhida(indice);
    if (focar) opcoes.current[indice]?.focus();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = escolhida ?? -1;
    const total = pergunta.alternatives.length;
    if (["ArrowDown", "ArrowRight"].includes(evento.key)) {
      evento.preventDefault();
      escolher((atual + 1 + total) % total);
    } else if (["ArrowUp", "ArrowLeft"].includes(evento.key)) {
      evento.preventDefault();
      escolher((atual - 1 + total) % total);
    } else if (/^[1-4]$/.test(evento.key)) {
      evento.preventDefault();
      escolher(Number(evento.key) - 1);
    } else if (evento.key === "Enter" && escolhida !== null && !enviando) {
      evento.preventDefault();
      aoResponder(escolhida);
    } else if (evento.key === " ") {
      // Espaço marca a alternativa que está com o foco.
      evento.preventDefault();
      const focada = opcoes.current.findIndex((el) => el === document.activeElement);
      if (focada >= 0) escolher(focada, false);
    }
  }

  return (
    <section
      role="group"
      aria-labelledby={idDoTitulo}
      aria-live="polite"
      className="palco-vidro min-h-0 overflow-y-auto rounded-mf-cartao p-4 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--palco-brilho-2))]">
        Pergunta {numero} de {total}
      </p>
      <h2
        id={idDoTitulo}
        ref={titulo}
        tabIndex={-1}
        className="mt-1 font-display text-lg font-bold leading-snug text-white outline-none sm:text-xl"
      >
        {pergunta.prompt}
      </h2>
      <div
        role="radiogroup"
        aria-labelledby={idDoTitulo}
        onKeyDown={aoTeclar}
        className="mt-3 grid gap-2 sm:grid-cols-2"
      >
        {pergunta.alternatives.map((alternativa, i) => {
          const marcada = escolhida === alternativa.indice;
          // Foco itinerante: só a marcada (ou a primeira, se nenhuma) entra na ordem do Tab.
          const naOrdem = marcada || (escolhida === null && i === 0);
          return (
            <div
              key={alternativa.indice}
              ref={(el) => {
                opcoes.current[alternativa.indice] = el;
              }}
              role="radio"
              aria-checked={marcada}
              tabIndex={naOrdem ? 0 : -1}
              onClick={() => escolher(alternativa.indice)}
              className={cn(
                "flex min-h-11 cursor-pointer gap-3 rounded-mf-controle border px-3 py-2.5 text-sm leading-5 transition-colors",
                marcada
                  ? "border-[rgb(var(--palco-brilho))] bg-[rgb(var(--palco-brilho)/0.16)] text-white"
                  : "border-white/15 bg-white/5 text-slate-100 hover:border-white/35"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
                  marcada
                    ? "bg-[rgb(var(--palco-brilho))] text-[rgb(var(--palco-fundo))]"
                    : "bg-white/15 text-white"
                )}
              >
                {LETRAS[i]}
              </span>
              <span>{alternativa.text}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-300">Setas ou 1–4 para escolher, Enter para responder.</p>
        <button
          type="button"
          disabled={escolhida === null || enviando}
          aria-busy={enviando}
          onClick={() => escolhida !== null && aoResponder(escolhida)}
          className="min-h-11 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-5 text-sm font-semibold text-[rgb(var(--palco-fundo))] disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Responder"}
        </button>
      </div>
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-[rgb(var(--palco-risco))]">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

const TOM = {
  good: { rotulo: "Bom caminho", Icone: CircleCheck, cor: "--palco-brilho" },
  warn: { rotulo: "Atenção", Icone: CircleAlert, cor: "--palco-atencao" },
  bad: { rotulo: "Risco", Icone: OctagonAlert, cor: "--palco-risco" }
} as const;

export function PainelDeReacao({
  reacao,
  rotuloDoBotao,
  aoContinuar
}: {
  reacao: TreinoBeat;
  rotuloDoBotao: string;
  aoContinuar: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), [reacao]);
  const { rotulo, Icone, cor } = TOM[reacao.tone];
  return (
    <section
      role="group"
      aria-labelledby="reacao-titulo"
      aria-live="polite"
      className="palco-vidro rounded-mf-cartao p-4 sm:p-5"
    >
      <p
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em]"
        style={{ color: `rgb(var(${cor}))` }}
      >
        <Icone size={15} aria-hidden="true" />
        {rotulo}
      </p>
      <h2
        id="reacao-titulo"
        ref={titulo}
        tabIndex={-1}
        className="mt-1 font-display text-xl font-bold text-white outline-none"
      >
        {reacao.title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-100">{reacao.text}</p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={aoContinuar}
          className="min-h-11 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-5 text-sm font-semibold text-[rgb(var(--palco-fundo))]"
        >
          {rotuloDoBotao}
        </button>
      </div>
    </section>
  );
}
