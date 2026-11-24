// Pré-visualização de um cenário para a AUTORIA (ADMIN, DEV): o mesmo Palco, pergunta a pergunta,
// com o gabarito à vista (quem cumpre a decisão, o tom e a reação de cada alternativa). Nada é
// gravado e nenhuma tentativa é criada. Serve para conferir planos de câmera, comandos de cena e
// textos antes de aprovar uma versão.
import type { TreinoCenario } from "@my-flux/shared";
import { useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { aplicarCena, type EstadoDaCena } from "./fluxo";
import { pacoteDeCena } from "./palco/pacotes";
import { Palco } from "./palco/palco";
import { useTelaCheia } from "./palco/use-tela-cheia";

const LETRAS = ["A", "B", "C", "D"];
const TOM = { good: "Bom caminho", warn: "Atenção", bad: "Risco" } as const;

export function PreVisualizacao({ cenario }: { cenario: TreinoCenario }) {
  const pacote = pacoteDeCena(cenario.scenePack);
  const [passo, setPasso] = useState<number>(-1); // -1 = abertura
  const [estado, setEstado] = useState<EstadoDaCena>(pacote.estadoInicial);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const telaCheia = useTelaCheia(caixa);
  const pergunta = passo >= 0 ? cenario.questions[passo] : undefined;
  const reacao =
    pergunta && escolhida !== null ? pergunta.alternatives[escolhida]?.beat : undefined;

  function irPara(indice: number) {
    setPasso(indice);
    setEscolhida(null);
  }

  return (
    <div
      ref={caixa}
      className={telaCheia.planoB ? "palco-tela-cheia overflow-y-auto bg-[#020617] p-2" : ""}
    >
      <div role="tablist" aria-label="Partes do cenário" className="mb-3 flex flex-wrap gap-2">
        {[-1, ...cenario.questions.map((_, i) => i)].map((indice) => (
          <button
            key={indice}
            type="button"
            role="tab"
            aria-selected={passo === indice}
            onClick={() => irPara(indice)}
            className={cn(
              "min-h-11 rounded-mf-controle border px-3 text-sm font-medium",
              passo === indice
                ? "border-mf-primaria bg-mf-realce-suave text-mf-primaria"
                : "border-mf-linha bg-mf-cartao text-mf-texto-2 hover:border-mf-brilho/40"
            )}
          >
            {indice === -1 ? "Abertura" : `Pergunta ${indice + 1}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEstado(pacote.estadoInicial)}
          className="min-h-11 rounded-mf-controle px-3 text-sm text-mf-texto-2 underline-offset-4 hover:underline"
        >
          Zerar a cena
        </button>
      </div>
      <Palco
        pacote={cenario.scenePack}
        estado={estado}
        plano={pergunta?.shot ?? "wide"}
        hud={{
          titulo: `${cenario.title} · pré-visualização`,
          ...(pergunta ? { hora: pergunta.time } : {})
        }}
        telaCheia={telaCheia}
        legenda={
          <div className="max-w-3xl self-start rounded-mf-controle bg-black/60 px-3 py-2 text-sm leading-6 text-white">
            {pergunta ? pergunta.narration : cenario.intro.captions.join(" ")}
          </div>
        }
      >
        <section
          aria-label="Pré-visualização do painel"
          className="palco-vidro min-h-0 overflow-y-auto rounded-mf-cartao p-4"
        >
          {pergunta ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--palco-brilho-2))]">
                Decisão: {cenario.decisions.find((d) => d.id === pergunta.decision)?.label} · plano{" "}
                {pergunta.shot}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold text-white">{pergunta.prompt}</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {pergunta.alternatives.map((a, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      aria-pressed={escolhida === i}
                      onClick={() => {
                        setEscolhida(i);
                        setEstado((atual) => aplicarCena(atual, a.beat.scene));
                      }}
                      className={cn(
                        "flex min-h-11 w-full gap-2 rounded-mf-controle border px-3 py-2 text-left text-sm",
                        escolhida === i
                          ? "border-[rgb(var(--palco-brilho))] bg-white/10"
                          : "border-white/15 bg-white/5"
                      )}
                    >
                      <span className="font-mono font-bold text-white">{LETRAS[i]}</span>
                      <span className="text-slate-100">
                        {a.text}
                        <span className="mt-1 block text-xs text-slate-300">
                          {a.taken ? "Cumpre a decisão" : "Não cumpre"} · {TOM[a.beat.tone]}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {reacao ? (
                <p className="mt-3 text-sm text-slate-100" aria-live="polite">
                  <strong className="text-white">{reacao.title}.</strong> {reacao.text}
                  {Object.keys(reacao.scene).length ? (
                    <span className="mt-1 block font-mono text-xs text-slate-300">
                      cena:{" "}
                      {Object.entries(reacao.scene)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(" ")}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h3 className="font-display text-lg font-bold text-white">{cenario.intro.title}</h3>
              <p className="mt-1 text-sm text-slate-200">{cenario.summary}</p>
              <p className="mt-2 text-xs text-slate-300">
                Pacote de cena: <span className="font-mono">{cenario.scenePack}</span>
                {pacote.id === "generico" ? " (desconhecido: usa o pacote genérico)" : ""}
              </p>
            </>
          )}
        </section>
      </Palco>
    </div>
  );
}
