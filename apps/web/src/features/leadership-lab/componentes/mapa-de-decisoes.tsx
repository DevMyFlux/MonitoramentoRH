import type { LabSituacaoDoResultado } from "@my-flux/shared";
import { Background, Controls, Handle, type NodeProps, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Flag, TimerOff } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../../lib/cn";
import {
  type DadosDaOmissao,
  type DadosDaOpcao,
  type DadosDaSituacao,
  descreverCaminho,
  montarMapaDeDecisoes
} from "../mapa-de-decisoes-dados";

const semAlca = "!h-1.5 !w-1.5 !border-0 !bg-transparent";

function tomDaAderencia(aderencia: number, semResposta: boolean): string {
  if (semResposta) return "border-amber-600";
  if (aderencia >= 100) return "border-emerald-600";
  if (aderencia >= 70) return "border-sky-500";
  if (aderencia >= 40) return "border-amber-500";
  return "border-red-500";
}

function NoDaSituacao({ data }: NodeProps) {
  const d = data as unknown as DadosDaSituacao;
  return (
    <div
      className={cn(
        "w-[248px] rounded-xl border-2 bg-white p-3 shadow-sm",
        tomDaAderencia(d.aderencia, d.semResposta)
      )}
    >
      <Handle id="esquerda" type="target" position={Position.Left} className={semAlca} />
      <Handle id="baixo" type="source" position={Position.Bottom} className={semAlca} />
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-950">
        Situação {d.numero}
        {d.marco ? (
          <Flag size={12} className="fill-amber-400 text-amber-600" aria-hidden="true" />
        ) : null}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{d.resumo}</p>
    </div>
  );
}

function NoDaOpcao({ data }: NodeProps) {
  const d = data as unknown as DadosDaOpcao;
  return (
    <div
      className={cn(
        "w-[248px] rounded-xl border p-3 text-xs leading-[18px]",
        d.escolhida
          ? "border-2 border-emerald-600 bg-emerald-50 text-slate-900 shadow-md"
          : "border-dashed border-slate-300 bg-slate-50 text-slate-500"
      )}
    >
      <Handle id="cima" type="target" position={Position.Top} className={semAlca} />
      <Handle id="direita" type="source" position={Position.Right} className={semAlca} />
      <p className="flex items-start gap-1.5">
        <span
          className={cn(
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
            d.escolhida ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-600"
          )}
        >
          {d.letra}
        </span>
        <span>
          {d.texto}
          {d.escolhida ? null : (
            <span className="mt-1 block text-[10px] italic">Alternativa não escolhida</span>
          )}
        </span>
      </p>
      {d.consequencia ? (
        <p className="mt-2 flex gap-1.5 border-t border-emerald-200 pt-2 text-[11px] leading-[17px] text-emerald-950">
          <Check size={12} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
          {d.consequencia}
        </p>
      ) : null}
    </div>
  );
}

function NoDaOmissao({ data }: NodeProps) {
  const d = data as unknown as DadosDaOmissao;
  return (
    <div className="w-[248px] rounded-xl border-2 border-amber-600 bg-amber-50 p-3 text-xs leading-[18px] text-amber-950">
      <Handle id="cima" type="target" position={Position.Top} className={semAlca} />
      <Handle id="direita" type="source" position={Position.Right} className={semAlca} />
      <p className="flex items-center gap-1.5 font-semibold">
        <TimerOff size={14} aria-hidden="true" /> Tempo esgotado
      </p>
      {d.consequencia ? <p className="mt-1 text-[11px] leading-[17px]">{d.consequencia}</p> : null}
    </div>
  );
}

// Definido fora do componente: o React Flow recria os nós se este objeto mudar a cada render.
const tiposDeNo = { situacao: NoDaSituacao, opcao: NoDaOpcao, omissao: NoDaOmissao };

/**
 * O caminho do teste como um mapa: as cinco situações em sequência, a escolha de cada uma em
 * destaque (com a consequência) e as alternativas esmaecidas. Só leitura: não se arrasta nem se
 * edita nada. O mesmo caminho vai em texto para leitor de tela, e a lista detalhada fica na página.
 */
export function MapaDeDecisoes({ situacoes }: { situacoes: readonly LabSituacaoDoResultado[] }) {
  const { nodes, edges } = useMemo(() => montarMapaDeDecisoes(situacoes), [situacoes]);
  const caminho = useMemo(() => descreverCaminho(situacoes), [situacoes]);
  return (
    <div>
      <ol className="sr-only" aria-label="Caminho percorrido">
        {caminho.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ol>
      <div
        data-testid="mapa-de-decisoes"
        role="group"
        aria-label="Mapa de decisões: arraste para ver todo o caminho, use os botões para ampliar"
        className="h-[28rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-[34rem]"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={tiposDeNo}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.2}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          preventScrolling={false}
        >
          <Background gap={20} color="#e2e8f0" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Verde: o caminho que você percorreu. Tracejado: as alternativas que você não escolheu. A cor
        da borda da situação mostra a aderência da escolha.
      </p>
    </div>
  );
}
