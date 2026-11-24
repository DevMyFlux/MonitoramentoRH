// Linha de etapas (só leitura) para processos com fases fixas: importação, recrutamento, QLP.
// Origem: ideia do "Stepper" do React Bits (reactbits.dev), escrita do zero, no mesmo desenho do
// andamento da escala (escalas.tsx). Por quê: mostrar onde o processo está e o que vem depois evita
// pular etapa. As ações continuam nos botões; isto não muda nada sozinho.
// Acessível: lista ordenada com aria-current="step" e "(concluída)" em texto para o leitor de tela.
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { Dica } from "./dica";

export type EtapaDaLinha = { id: string; rotulo: string; dica?: string };

type Props = {
  rotulo: string;
  etapas: readonly EtapaDaLinha[];
  /** Índice da etapa atual; -1 = nenhuma começou; >= etapas.length = todas concluídas. */
  atual: number;
  /** No celular, só a etapa atual mostra o nome (para caber em 360 px). */
  compacta?: boolean;
  /**
   * Em qualquer largura, só a etapa atual mostra o nome; as demais levam o nome na dica do círculo
   * (e continuam lidas pelo leitor de tela). Para processos longos, como as 7 etapas do candidato.
   */
  soAtual?: boolean;
};

export function LinhaDeEtapas({ rotulo, etapas, atual, compacta = false, soAtual = false }: Props) {
  return (
    <ol aria-label={rotulo} className="flex items-center gap-1.5 sm:gap-2">
      {etapas.map((etapa, i) => {
        const feita = i < atual;
        const agora = i === atual;
        const circulo = (
          <span
            aria-hidden="true"
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-2 transition-colors",
              feita && "bg-mf-brilho text-white ring-mf-brilho",
              agora &&
                "bg-white text-mf-primaria ring-mf-brilho shadow-[0_0_0_3px_rgb(var(--mf-brilho)/0.15)]",
              !feita && !agora && "bg-white text-mf-texto-3 ring-mf-linha"
            )}
          >
            {feita ? <Check size={13} /> : i + 1}
          </span>
        );
        return (
          <li
            key={etapa.id}
            aria-current={agora ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2",
              agora ? "shrink-0" : "flex-1",
              soAtual && agora && "sm:flex-none"
            )}
          >
            {etapa.dica || (soAtual && !agora) ? (
              <Dica
                texto={etapa.dica ?? etapa.rotulo}
                className="shrink-0 rounded-full no-underline"
              >
                {circulo}
              </Dica>
            ) : (
              circulo
            )}
            <span
              className={cn(
                "text-xs font-medium sm:truncate",
                agora ? "text-mf-tinta" : feita ? "text-mf-texto-2" : "text-mf-texto-3",
                compacta && !agora && "hidden sm:inline",
                soAtual && !agora && "sr-only",
                soAtual && agora && "whitespace-nowrap sm:overflow-visible"
              )}
            >
              {etapa.rotulo}
              <span className="sr-only">
                {feita ? " (concluída)" : agora ? " (etapa atual)" : ""}
              </span>
            </span>
            {i < etapas.length - 1 ? (
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
