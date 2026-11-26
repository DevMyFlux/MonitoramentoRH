// <TreinamentoPalco>: o Palco de UM cenário de treinamento, reutilizável. Abertura, cena de abertura,
// 5 perguntas (cada uma com o seu plano, narração e painel dentro do quadro), a reação de cada
// alternativa e a conclusão. Quem o usa fornece os três passos que falam com o servidor (iniciar,
// responder, finalizar); o Palco cuida da cena, do teclado, da tela cheia e do movimento reduzido.
//
// Usado pelo teste do Leadership Lab (a trilha de cenários) e pela página /treinamentos/jogar.
//
// Recarregar não reinicia: quem usa passa a tentativa em andamento (com as respostas já dadas) e o
// Palco retoma na primeira pergunta sem resposta, com a cena reconstruída a partir das reações. O
// gabarito nunca chega aqui: cada resposta devolve só a reação da alternativa escolhida.
import type { TreinoBeat, TreinoVisaoDoParticipante } from "@my-flux/shared";
import { FileText, Maximize2, Play, SkipForward, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RespostaDada } from "../api";
import {
  aplicarCena,
  cenaDepoisDas,
  depoisDaReacao,
  etapaDeRetomada,
  type EstadoDaCena,
  type EtapaDoPalco
} from "../fluxo";
import { Legenda } from "./legenda";
import { pacoteDeCena } from "./pacotes";
import { PainelDePergunta, PainelDeReacao } from "./painel-de-pergunta";
import { useMovimentoReduzido } from "./movimento";
import { Palco } from "./palco";
import { useTelaCheia } from "./use-tela-cheia";

export type TentativaDoPalco = { id: string; respostas: RespostaDada[] };

export type PropsDoTreinamentoPalco = {
  /** O cenário SEM gabarito (visaoDoParticipante). */
  cenario: TreinoVisaoDoParticipante;
  /** A tentativa em andamento, com as respostas já dadas; nulo antes de iniciar. */
  tentativaInicial: TentativaDoPalco | null;
  /** O texto de cima da abertura (ex.: "Teste do Leadership Lab · cenário 1 de 3"). */
  eyebrow: string;
  /** Abre pela apresentação mesmo com a tentativa já criada e sem respostas (a trilha do Lab). */
  abrirPelaAbertura?: boolean;
  /** O clique em "Iniciar": devolve a tentativa (nova ou a que já existia). */
  aoIniciar: () => Promise<TentativaDoPalco | null>;
  /** Uma resposta: devolve só a reação da alternativa escolhida. */
  aoResponder: (
    tentativaId: string,
    perguntaId: string,
    alternativa: number
  ) => Promise<{ perguntaId: string; alternativa: number; reacao: TreinoBeat }>;
  /** O clique em "Ver o desfecho" (onFinish): o servidor conclui e a tela segue para onde quiser. */
  aoFinalizar: (tentativaId: string) => Promise<void>;
};

/** Quanto tempo cada legenda da cena de abertura fica na tela depois de digitada. */
const PAUSA_DA_LEGENDA_MS = 1800;

export function TreinamentoPalco({
  cenario,
  tentativaInicial,
  eyebrow,
  abrirPelaAbertura = false,
  aoIniciar,
  aoResponder,
  aoFinalizar
}: PropsDoTreinamentoPalco) {
  const reduzido = useMovimentoReduzido();
  const pacote = pacoteDeCena(cenario.scenePack);

  const [tentativaId, setTentativaId] = useState(tentativaInicial?.id ?? null);
  const [respostas, setRespostas] = useState<RespostaDada[]>(tentativaInicial?.respostas ?? []);
  const [etapa, setEtapa] = useState<EtapaDoPalco>(() =>
    // Na trilha do Lab o servidor já criou o cenário: ele abre pela apresentação, não pelas perguntas.
    abrirPelaAbertura && (tentativaInicial?.respostas.length ?? 0) === 0
      ? { tipo: "abertura" }
      : etapaDeRetomada(cenario, tentativaInicial)
  );
  const [estado, setEstado] = useState<EstadoDaCena>(() =>
    cenaDepoisDas(cenario, tentativaInicial?.respostas ?? [], pacote.estadoInicial)
  );
  // De qual pergunta a narração já terminou (o painel só abre depois dela).
  const [narracaoProntaDe, setNarracaoProntaDe] = useState<string | null>(null);
  const [legendaDaAbertura, setLegendaDaAbertura] = useState(0);
  const [legendaTerminada, setLegendaTerminada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [tremor, setTremor] = useState(0);
  const [clarao, setClarao] = useState(0);
  const modulo = useRef<HTMLDivElement>(null);
  const telaCheia = useTelaCheia(modulo);

  const pergunta =
    etapa.tipo === "pergunta" || etapa.tipo === "reacao"
      ? cenario.questions[etapa.indice]
      : undefined;
  const ultimaReacao =
    etapa.tipo === "reacao" ? respostas.find((r) => r.perguntaId === pergunta?.id) : undefined;

  // A cena de abertura passa pelos planos das primeiras perguntas (do geral ao detalhe).
  const planosDaAbertura = useMemo(
    () =>
      ["wide", ...new Set(cenario.questions.map((q) => q.shot))].slice(
        0,
        cenario.intro.captions.length
      ),
    [cenario]
  );

  const narracaoPronta = pergunta !== undefined && narracaoProntaDe === pergunta.id;

  // Cena de abertura: cada legenda, depois de digitada, espera um pouco e passa para a próxima; a
  // última abre a Pergunta 1, sem pausa artificial. Pular a cena (ou sair dela) cancela a espera.
  // Com movimento reduzido, as legendas ficam juntas e a pessoa segue pelo botão.
  useEffect(() => {
    if (etapa.tipo !== "cena-de-abertura" || !legendaTerminada || reduzido) return;
    const espera = setTimeout(() => {
      setLegendaTerminada(false);
      if (legendaDaAbertura + 1 < cenario.intro.captions.length)
        setLegendaDaAbertura(legendaDaAbertura + 1);
      else setEtapa({ tipo: "pergunta", indice: 0 });
    }, PAUSA_DA_LEGENDA_MS);
    return () => clearTimeout(espera);
  }, [etapa.tipo, legendaTerminada, legendaDaAbertura, reduzido, cenario.intro.captions.length]);

  async function iniciar(emTelaCheia: boolean) {
    setErro("");
    setEnviando(true);
    if (emTelaCheia) void telaCheia.entrar();
    try {
      const tentativa = await aoIniciar();
      const dadas = tentativa?.respostas ?? [];
      setTentativaId(tentativa?.id ?? null);
      setRespostas(dadas);
      setEstado(cenaDepoisDas(cenario, dadas, pacote.estadoInicial));
      setEtapa(dadas.length ? etapaDeRetomada(cenario, tentativa) : { tipo: "cena-de-abertura" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar.");
    } finally {
      setEnviando(false);
    }
  }

  async function responder(alternativa: number) {
    if (!tentativaId || !pergunta) return;
    setErro("");
    setEnviando(true);
    try {
      const r = await aoResponder(tentativaId, pergunta.id, alternativa);
      const dada = { perguntaId: r.perguntaId, alternativa: r.alternativa, reacao: r.reacao };
      setRespostas((atuais) => [...atuais.filter((x) => x.perguntaId !== dada.perguntaId), dada]);
      setEstado((atual) => aplicarCena(atual, r.reacao.scene));
      if (r.reacao.tone === "bad") setTremor((n) => n + 1);
      if (r.reacao.scene.state === "arc") setClarao((n) => n + 1);
      setEtapa({
        tipo: "reacao",
        indice: cenario.questions.findIndex((q) => q.id === pergunta.id)
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a resposta.");
    } finally {
      setEnviando(false);
    }
  }

  async function concluir() {
    if (!tentativaId) return;
    setErro("");
    setEnviando(true);
    try {
      // O servidor conclui e calcula; quem usa o Palco decide o que vem depois (resultado, próximo cenário).
      await aoFinalizar(tentativaId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
      setEnviando(false);
    }
  }

  const plano =
    etapa.tipo === "cena-de-abertura"
      ? planosDaAbertura[Math.min(legendaDaAbertura, planosDaAbertura.length - 1)]
      : etapa.tipo === "abertura" || etapa.tipo === "concluir"
        ? "wide"
        : pergunta?.shot;

  return (
    <div
      ref={modulo}
      className={telaCheia.planoB ? "palco-tela-cheia bg-[#020617]" : "bg-[#020617]"}
    >
      <h1 className="sr-only">{cenario.title}</h1>
      <Palco
        pacote={cenario.scenePack}
        estado={estado}
        plano={plano}
        tremor={tremor}
        clarao={clarao}
        hud={{
          titulo: cenario.title,
          ...(pergunta && etapa.tipo !== "cena-de-abertura" ? { hora: pergunta.time } : {})
        }}
        telaCheia={telaCheia}
        acoes={
          etapa.tipo === "cena-de-abertura" ? (
            <button
              type="button"
              onClick={() => setEtapa({ tipo: "pergunta", indice: 0 })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-mf-controle bg-black/50 px-3 text-sm text-white hover:bg-black/70"
            >
              <SkipForward size={16} aria-hidden="true" />
              Pular cena
            </button>
          ) : null
        }
        legenda={
          etapa.tipo === "cena-de-abertura" ? (
            reduzido ? (
              <div className="max-w-3xl self-start rounded-mf-controle bg-black/60 px-3 py-2 text-sm leading-6">
                {cenario.intro.captions.map((legenda) => (
                  <p key={legenda}>{legenda}</p>
                ))}
              </div>
            ) : (
              <Legenda
                key={legendaDaAbertura}
                texto={cenario.intro.captions[legendaDaAbertura] ?? ""}
                reduzido={false}
                aoTerminar={() => setLegendaTerminada(true)}
              />
            )
          ) : etapa.tipo === "pergunta" && pergunta ? (
            <Legenda
              key={pergunta.id}
              texto={pergunta.narration}
              reduzido={reduzido}
              aoTerminar={() => setNarracaoProntaDe(pergunta.id)}
            />
          ) : null
        }
      >
        {etapa.tipo === "abertura" ? (
          <section
            aria-labelledby="abertura-titulo"
            className="palco-vidro rounded-mf-cartao p-5 sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--palco-brilho-2))]">
              {eyebrow}
            </p>
            <h2
              id="abertura-titulo"
              className="mt-1 font-display text-2xl font-extrabold sm:text-3xl"
            >
              {cenario.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">{cenario.summary}</p>
            {cenario.exemplo ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-mf-controle bg-[rgb(var(--palco-atencao)/0.15)] px-3 py-1.5 text-xs text-[rgb(var(--palco-atencao))]">
                <TriangleAlert size={14} aria-hidden="true" />
                EXEMPLO: conteúdo ainda em validação técnica.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-300">
              5 perguntas, sem limite de tempo. Cada escolha mostra o que acontece na hora.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={() => void iniciar(false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-5 text-sm font-semibold text-[#020617] disabled:opacity-50"
              >
                <Play size={16} aria-hidden="true" />
                Iniciar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => void iniciar(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-mf-controle border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                <Maximize2 size={16} aria-hidden="true" />
                Iniciar em tela cheia
              </button>
            </div>
            {erro ? (
              <p role="alert" className="mt-2 text-sm text-[rgb(var(--palco-risco))]">
                {erro}
              </p>
            ) : null}
          </section>
        ) : null}

        {etapa.tipo === "cena-de-abertura" && reduzido ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEtapa({ tipo: "pergunta", indice: 0 })}
              className="min-h-11 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-5 text-sm font-semibold text-[#020617]"
            >
              Começar as perguntas
            </button>
          </div>
        ) : null}

        {etapa.tipo === "pergunta" && pergunta && narracaoPronta ? (
          <PainelDePergunta
            key={pergunta.id}
            pergunta={pergunta}
            numero={etapa.indice + 1}
            total={cenario.questions.length}
            enviando={enviando}
            erro={erro}
            aoResponder={(alternativa) => void responder(alternativa)}
          />
        ) : null}

        {etapa.tipo === "pergunta" && !narracaoPronta ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => pergunta && setNarracaoProntaDe(pergunta.id)}
              className="min-h-11 rounded-mf-controle bg-black/50 px-4 text-sm text-white hover:bg-black/70"
            >
              Mostrar a pergunta
            </button>
          </div>
        ) : null}

        {etapa.tipo === "reacao" && ultimaReacao ? (
          <PainelDeReacao
            reacao={ultimaReacao.reacao}
            rotuloDoBotao={
              etapa.indice + 1 < cenario.questions.length
                ? "Próxima pergunta"
                : "Seguir para o desfecho"
            }
            aoContinuar={() => setEtapa(depoisDaReacao(cenario, etapa.indice))}
          />
        ) : null}

        {etapa.tipo === "concluir" ? (
          <section aria-labelledby="concluir-titulo" className="palco-vidro rounded-mf-cartao p-5">
            <h2 id="concluir-titulo" className="font-display text-xl font-bold">
              As 5 decisões foram tomadas
            </h2>
            <p className="mt-1 text-sm text-slate-200">
              Veja o que as suas escolhas, somadas, provocaram.
            </p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={enviando}
                aria-busy={enviando}
                onClick={() => void concluir()}
                className="min-h-11 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-5 text-sm font-semibold text-[#020617] disabled:opacity-50"
              >
                {enviando ? "Calculando..." : "Ver o desfecho"}
              </button>
            </div>
            {erro ? (
              <p role="alert" className="mt-2 text-sm text-[rgb(var(--palco-risco))]">
                {erro}
              </p>
            ) : null}
          </section>
        ) : null}
      </Palco>

      {/* Transcrição: tudo o que foi narrado e as reações, em texto */}
      <details className="mt-4 rounded-mf-cartao border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-white">
          <FileText size={16} aria-hidden="true" />
          Transcrição da cena
        </summary>
        <ol className="mt-3 space-y-2">
          {cenario.intro.captions.map((legenda) => (
            <li key={legenda}>{legenda}</li>
          ))}
          {cenario.questions.map((q) => {
            const dada = respostas.find((r) => r.perguntaId === q.id);
            if (!dada && q.id !== pergunta?.id) return null;
            return (
              <li key={q.id}>
                <p>{q.narration}</p>
                {dada ? (
                  <p className="text-slate-300">
                    Sua escolha: {q.alternatives[dada.alternativa]?.text} — {dada.reacao.title}.{" "}
                    {dada.reacao.text}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
