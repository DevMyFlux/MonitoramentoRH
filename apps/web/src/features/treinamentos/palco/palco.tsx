// O Palco: o quadro cinematográfico onde a cena acontece. Camadas, de baixo para cima: mundo SVG
// (com a câmera), partículas, vinheta, grão, clarão, letterbox, HUD e, por cima, o painel (perguntas,
// reações, desfecho), SEMPRE dentro do quadro. A câmera anima com `animate` do motion (sem GSAP);
// com "reduzir movimento", vai direto ao plano, sem tremor, partículas nem grão.
import { animate } from "motion/react";
import { Maximize2, Minimize2, Radio, Thermometer } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../../lib/cn";
import type { EstadoDaCena } from "../fluxo";
import { MundoDoPacote } from "./mundos";
import {
  ALTURA_DA_CENA,
  cameraDoPlano,
  LARGURA_DA_CENA,
  pacoteDeCena,
  transformDaCamera,
  type Camera
} from "./pacotes";
import { useMovimentoReduzido } from "./movimento";
import { Particulas } from "./particulas";
import "./palco.css";

/** Anima a câmera até o plano; `tremor` muda para sacudir (ações fortes). */
function useCamera(alvo: Camera, reduzido: boolean, tremor: number) {
  const grupo = useRef<SVGGElement>(null);
  const atual = useRef<Camera>(alvo);

  useEffect(() => {
    const aplicar = (camera: Camera, desvio = { x: 0, y: 0 }) =>
      grupo.current?.setAttribute("transform", transformDaCamera(camera, desvio));
    const de = atual.current;
    if (reduzido) {
      atual.current = alvo;
      aplicar(alvo);
      return;
    }
    const controle = animate(0, 1, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (t) => {
        const camera = {
          cx: de.cx + (alvo.cx - de.cx) * t,
          cy: de.cy + (alvo.cy - de.cy) * t,
          escala: de.escala + (alvo.escala - de.escala) * t
        };
        atual.current = camera;
        aplicar(camera);
      }
    });
    return () => controle.stop();
  }, [alvo.cx, alvo.cy, alvo.escala, reduzido]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduzido || tremor === 0) return;
    const controle = animate(1, 0, {
      duration: 0.45,
      onUpdate: (forca) =>
        grupo.current?.setAttribute(
          "transform",
          transformDaCamera(atual.current, {
            x: (Math.random() - 0.5) * 18 * forca,
            y: (Math.random() - 0.5) * 12 * forca
          })
        )
    });
    return () => controle.stop();
  }, [tremor, reduzido]);

  return grupo;
}

export type PropsDoPalco = {
  pacote: string;
  estado: EstadoDaCena;
  plano: string | undefined;
  /** Incrementar sacode a câmera. */
  tremor?: number;
  /** Incrementar dispara o clarão branco. */
  clarao?: number;
  /** Rótulo do plano e horário no HUD. */
  hud: { titulo: string; hora?: string };
  telaCheia: { ativa: boolean; alternar: () => void };
  /** A legenda/narração (fica no terço de baixo, acima do painel). */
  legenda?: ReactNode;
  /** O painel (pergunta, reação, desfecho): sempre dentro do quadro. */
  children?: ReactNode;
  /** Ações do canto (ex.: Pular cena). */
  acoes?: ReactNode;
};

export function Palco({
  pacote: idDoPacote,
  estado,
  plano,
  tremor = 0,
  clarao = 0,
  hud,
  telaCheia,
  legenda,
  children,
  acoes
}: PropsDoPalco) {
  const reduzido = useMovimentoReduzido();
  const pacote = pacoteDeCena(idDoPacote);
  const camera = cameraDoPlano(pacote, plano);
  const grupo = useCamera(camera, reduzido, tremor);
  const estadoCompleto = { ...pacote.estadoInicial, ...estado };
  const descricao = pacote.descrever(estadoCompleto);
  const indicadores = pacote.indicadores?.(estadoCompleto) ?? [];

  return (
    <div
      className={cn(
        "palco relative isolate w-full overflow-hidden rounded-mf-conteiner shadow-mf-3",
        // No celular o quadro é alto (o painel cabe dentro); do tablet para cima, cinema 16:9.
        telaCheia.ativa
          ? "h-full rounded-none"
          : "h-[78svh] min-h-[520px] md:aspect-video md:h-auto md:min-h-0"
      )}
    >
      <svg
        role="img"
        aria-label={descricao}
        viewBox={`0 0 ${LARGURA_DA_CENA} ${ALTURA_DA_CENA}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <g ref={grupo} transform={transformDaCamera(camera)}>
          <MundoDoPacote
            pacote={pacote.id}
            estado={{ ...pacote.estadoInicial, ...estado }}
            reduzido={reduzido}
          />
        </g>
      </svg>
      <Particulas
        modo={pacote.particulas({ ...pacote.estadoInicial, ...estado })}
        reduzido={reduzido}
      />
      <div aria-hidden="true" className="palco-vinheta pointer-events-none absolute inset-0" />
      {reduzido ? null : (
        <div aria-hidden="true" className="palco-grao pointer-events-none absolute -inset-[10%]" />
      )}
      {clarao > 0 && !reduzido ? (
        <div
          key={clarao}
          aria-hidden="true"
          className="palco-clarao pointer-events-none absolute inset-0"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="palco-letterbox pointer-events-none absolute inset-x-0 top-0 hidden md:block"
      />
      <div
        aria-hidden="true"
        className="palco-letterbox pointer-events-none absolute inset-x-0 bottom-0 hidden md:block"
      />

      {/* HUD */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          {hud.hora ? (
            <span className="rounded-md bg-black/50 px-2 py-1 font-mono tabular-nums text-white">
              {hud.hora}
            </span>
          ) : null}
          <span className="truncate rounded-md bg-black/40 px-2 py-1 font-display font-bold tracking-tight text-white">
            {hud.titulo}
          </span>
          {indicadores.map((indicador) => (
            <span
              key={indicador.rotulo}
              role="status"
              aria-label={`${indicador.rotulo}: ${indicador.valor}`}
              className="inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-white"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full",
                  indicador.tom === "ok" && "bg-[rgb(var(--palco-brilho))]",
                  indicador.tom === "atencao" && "bg-[rgb(var(--palco-atencao))]",
                  indicador.tom === "risco" && "bg-[rgb(var(--palco-risco))]",
                  indicador.tom === "neutro" && "bg-[rgb(var(--palco-neutro))]"
                )}
              />
              <span className="hidden sm:inline">{indicador.rotulo}</span>
              <span className="font-mono tabular-nums">{indicador.valor}</span>
            </span>
          ))}
          {estado.tvt ? (
            <span className="hidden items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[rgb(var(--palco-atencao))] sm:inline-flex">
              <Thermometer size={14} aria-hidden="true" />
              <span className="text-white">{estado.tvt}</span>
            </span>
          ) : null}
          {estado.icu === "alert" ? (
            <span className="hidden items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-white sm:inline-flex">
              <Radio size={14} aria-hidden="true" className="text-[rgb(var(--palco-risco))]" />
              Rádio: UTI em alerta
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {acoes}
          <button
            type="button"
            onClick={telaCheia.alternar}
            aria-pressed={telaCheia.ativa}
            className="grid min-h-11 min-w-11 place-items-center rounded-mf-controle bg-black/50 text-white hover:bg-black/70"
            aria-label={telaCheia.ativa ? "Sair da tela cheia" : "Tela cheia"}
            title={telaCheia.ativa ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {telaCheia.ativa ? (
              <Minimize2 size={18} aria-hidden="true" />
            ) : (
              <Maximize2 size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Legenda e painel, dentro do quadro */}
      {/* Altura definida (abaixo do HUD): o painel encolhe e rola por dentro, sem sair do quadro. */}
      <div className="absolute inset-x-0 bottom-0 top-16 z-10 flex flex-col justify-end gap-3 p-3 sm:p-5 [&>*]:shrink-0 [&>section]:min-h-0 [&>section]:shrink">
        {legenda}
        {children}
      </div>
    </div>
  );
}
