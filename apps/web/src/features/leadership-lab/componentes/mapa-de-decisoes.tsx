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
  if (semResposta) return "border-lab-aviso";
  if (aderencia >= 100) return "border-lab-destaque";
  if (aderencia >= 70) return "border-lab-info";
  if (aderencia >= 40) return "border-lab-aviso";
  return "border-lab-perigo";
}

function NoDaSituacao({ data }: NodeProps) {
  const d = data as unknown as DadosDaSituacao;
  return (
    <div
      className={cn(
        "w-[248px] rounded-lab-lg border-2 bg-lab-superficie p-3 shadow-lab-1",
        tomDaAderencia(d.aderencia, d.semResposta)
      )}
    >
      <Handle id="esquerda" type="target" position={Position.Left} className={semAlca} />
      <Handle id="baixo" type="source" position={Position.Bottom} className={semAlca} />
      <p className="flex items-center gap-1.5 text-lab-legenda font-semibold text-lab-tinta">
        Situação {d.numero}
        {d.marco ? (
          <Flag size={12} className="fill-lab-aviso/60 text-lab-aviso" aria-hidden="true" />
        ) : null}
      </p>
      <p className="mt-1 text-lab-legenda leading-5 text-lab-tinta-2">{d.resumo}</p>
    </div>
  );
}

function NoDaOpcao({ data }: NodeProps) {
  const d = data as unknown as DadosDaOpcao;
  return (
    <div
      className={cn(
        "w-[248px] rounded-lab-lg border p-3 text-lab-legenda leading-[18px]",
        d.escolhida
          ? "border-2 border-lab-destaque bg-lab-destaque-suave text-lab-tinta shadow-lab-2"
          : "border-dashed border-lab-linha-forte bg-lab-superficie-2 text-lab-tinta-2"
      )}
    >
      <Handle id="cima" type="target" position={Position.Top} className={semAlca} />
      <Handle id="direita" type="source" position={Position.Right} className={semAlca} />
      <p className="flex items-start gap-1.5">
        <span
          className={cn(
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
            d.escolhida ? "bg-lab-destaque text-white" : "bg-lab-superficie-3 text-lab-tinta-2"
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
        <p className="mt-2 flex gap-1.5 border-t border-lab-destaque/25 pt-2 text-[11px] leading-[17px] text-lab-destaque-texto">
          <Check size={12} className="mt-0.5 shrink-0 text-lab-destaque" aria-hidden="true" />
          {d.consequencia}
        </p>
      ) : null}
    </div>
  );
}

function NoDaOmissao({ data }: NodeProps) {
  const d = data as unknown as DadosDaOmissao;
  return (
    <div className="w-[248px] rounded-lab-lg border-2 border-lab-aviso bg-lab-aviso-suave p-3 text-lab-legenda leading-[18px] text-lab-aviso-texto">
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
        className="h-[28rem] w-full overflow-hidden rounded-lab-lg border border-lab-linha bg-lab-superficie-2 sm:h-[34rem]"
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
      <p className="mt-2 text-lab-legenda text-lab-tinta-2">
        Verde: o caminho que você percorreu. Tracejado: as alternativas que você não escolheu. A cor
        da borda da situação mostra a aderência da escolha.
      </p>
    </div>
  );
}
