// Peças da tela de Escalas: andamento do fluxo, lista animada de pendências, equipes por turno e a
// faísca de confirmação. Todas escritas do zero; as ideias vêm do "Stepper", "Animated List",
// "Chroma Grid" e "Click Spark" (React Bits, reactbits.dev e galerias semelhantes), sem copiar código.
// Por quê de cada uma:
//  - ProgressoDoFluxo: a escala passa por rascunho > revisão > aprovada > publicada; ver em que
//    ponto está evita erro (publicar o que não foi aprovado). É só leitura: as ações continuam nos botões.
//  - ListaDePendencias: as pendências entram em sequência, e a lista curta evita um muro de linhas.
//  - EquipesPorTurno: um resumo de quantas pessoas há em cada turno, com a luz do turno (verde: dia,
//    azul: noite) que segue o mouse.
//  - a faísca de confirmação mora em faisca.ts (funções, não componentes).
import { motion, useReducedMotion } from "motion/react";
import { Check, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { CartaoSpotlight } from "./cartao-spotlight";

// ---- Andamento do fluxo ------------------------------------------------------------------------------

const etapasDaEscala = [
  { status: "DRAFT", rotulo: "Rascunho" },
  { status: "IN_REVIEW", rotulo: "Em aprovação" },
  { status: "APPROVED", rotulo: "Aprovado" },
  { status: "PUBLISHED", rotulo: "Publicado" }
] as const;

export function ProgressoDoFluxo({ status }: { status: string }) {
  if (status === "ARCHIVED") {
    return (
      <p className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-mf-texto-2">
        Escala arquivada
      </p>
    );
  }
  const atual = Math.max(
    0,
    etapasDaEscala.findIndex((e) => e.status === status)
  );
  return (
    <ol aria-label="Andamento da escala" className="flex items-center gap-1.5 sm:gap-2">
      {etapasDaEscala.map((e, i) => {
        const feito = i < atual;
        const agora = i === atual;
        return (
          <li
            key={e.status}
            aria-current={agora ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 sm:min-w-0 sm:flex-1 sm:gap-2",
              // No celular a etapa atual leva o nome inteiro; as demais dividem o que sobra.
              agora ? "shrink-0" : "min-w-0 flex-1"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-2 transition-colors",
                feito && "bg-mf-brilho text-white ring-mf-brilho",
                agora &&
                  "bg-white text-mf-primaria ring-mf-brilho shadow-[0_0_0_3px_rgb(var(--mf-brilho)/0.15)]",
                !feito && !agora && "bg-white text-mf-texto-3 ring-mf-linha"
              )}
            >
              {feito ? <Check size={13} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium sm:truncate",
                agora ? "text-mf-tinta" : "text-mf-texto-3",
                // No celular só o passo atual mostra o nome, para a linha caber em 360 px.
                !agora && "hidden sm:inline"
              )}
            >
              {e.rotulo}
              <span className="sr-only">
                {feito ? " (concluída)" : agora ? " (etapa atual)" : ""}
              </span>
            </span>
            {i < etapasDaEscala.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-0.5 min-w-3 flex-1 rounded-full",
                  i < atual ? "bg-mf-brilho" : "bg-mf-linha"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ---- Pendências ---------------------------------------------------------------------------------------

export type PendenciaVisual = { id: string; pessoa: string; data: string; motivos: string[] };

const VISIVEIS = 6;

export function ListaDePendencias({ itens }: { itens: PendenciaVisual[] }) {
  const reduzido = useReducedMotion();
  const [todas, setTodas] = useState(false);
  if (itens.length === 0) return null;
  const mostradas = todas ? itens : itens.slice(0, VISIVEIS);
  return (
    <section
      aria-label="Pendências da escala"
      className="rounded-2xl border border-mf-alerta/25 bg-mf-alerta-suave p-4"
    >
      <h4 className="flex items-center gap-2 text-sm font-semibold text-mf-alerta">
        <TriangleAlert size={16} aria-hidden="true" />
        Pendências ({itens.length})
      </h4>
      <ul className="mt-3 space-y-1.5">
        {mostradas.map((p, i) => (
          <motion.li
            key={p.id}
            initial={reduzido ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: reduzido ? 0 : Math.min(i, 10) * 0.035 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/70 px-3 py-2 text-xs text-mf-texto"
          >
            <span className="font-medium text-mf-tinta">{p.pessoa}</span>
            <span className="tabular-nums text-mf-texto-2">{p.data}</span>
            <span className="flex flex-wrap gap-1">
              {p.motivos.map((m) => (
                <code
                  key={m}
                  className="rounded bg-mf-alerta/10 px-1.5 py-0.5 font-mono text-[11px] text-mf-alerta"
                >
                  {m}
                </code>
              ))}
            </span>
          </motion.li>
        ))}
      </ul>
      {itens.length > VISIVEIS ? (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          className="mt-3 min-h-11 rounded-lg px-2 text-xs font-semibold text-mf-alerta underline-offset-4 hover:underline"
        >
          {todas ? "Mostrar menos" : `Mostrar todas (${itens.length})`}
        </button>
      ) : null}
    </section>
  );
}

// ---- Equipes por turno --------------------------------------------------------------------------------

export function EquipesPorTurno({ equipes }: { equipes: { nome: string; pessoas: number }[] }) {
  if (equipes.length === 0) return null;
  return (
    <ul
      aria-label="Equipes por turno"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
    >
      {equipes.map((e) => {
        const noite = e.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes("noturn");
        return (
          <li key={e.nome}>
            <CartaoSpotlight tom={noite ? "azul" : "verde"} className="h-full p-3.5">
              <p className="text-xs font-medium text-mf-texto-2">{e.nome}</p>
              <p
                className={cn(
                  "mt-1.5 font-display text-2xl font-bold leading-none",
                  noite ? "text-mf-azul" : "text-mf-primaria"
                )}
              >
                {e.pessoas}
              </p>
              <p className="mt-1 text-[11px] text-mf-texto-3">
                {e.pessoas === 1 ? "pessoa" : "pessoas"}
              </p>
            </CartaoSpotlight>
          </li>
        );
      })}
    </ul>
  );
}
