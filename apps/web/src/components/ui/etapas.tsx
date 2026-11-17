// Etapas (stepper): o cadastro novo em passos curtos. Origem: ideia do "Stepper" do React Bits
// (reactbits.dev), escrita do zero. Por quê: cadastrar alguém pela primeira vez é uma sequência
// (dados, depois contrato, depois situação); em passos o celular mostra pouca coisa por vez e o
// RH sabe onde está. Quem edita não passa por aqui: editar é não linear, e lá ficam as abas.
// O teclado e o leitor de tela leem uma lista ordenada com aria-current="step"; avançar só é
// bloqueado quando `validar` devolve um aviso (o mesmo que o servidor exigiria depois).
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export type Passo = {
  id: string;
  rotulo: string;
  conteudo: ReactNode;
  /** Devolve o aviso que impede de avançar (ou nulo, se pode). */
  validar?: () => string | null;
};

type Props = {
  passos: Passo[];
  atual: number;
  aoMudar: (indice: number) => void;
  /** Mostrado no lugar de "Avançar" no último passo (o botão de salvar). */
  acaoFinal: ReactNode;
  /** O aviso do passo que tentou avançar sem estar completo. */
  aviso?: string;
  aoAvisar: (mensagem: string) => void;
};

export function Etapas({ passos, atual, aoMudar, acaoFinal, aviso, aoAvisar }: Props) {
  const ultimo = atual === passos.length - 1;
  const passo = passos[atual];

  function avancar() {
    const mensagem = passo?.validar?.() ?? null;
    if (mensagem) return aoAvisar(mensagem);
    aoAvisar("");
    aoMudar(Math.min(passos.length - 1, atual + 1));
  }

  return (
    <div>
      <ol aria-label="Etapas do cadastro" className="flex items-start">
        {passos.map((p, i) => {
          const feito = i < atual;
          const agora = i === atual;
          return (
            <li
              key={p.id}
              className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
            >
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[calc(-50%+1.25rem)] top-4 h-0.5 w-[calc(100%-2.5rem)] -translate-y-1/2 transition-colors duration-300",
                    i <= atual ? "bg-mf-brilho" : "bg-mf-linha"
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={i > atual}
                onClick={() => aoMudar(i)}
                aria-current={agora ? "step" : undefined}
                className={cn(
                  "relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold ring-2 transition-colors disabled:cursor-default",
                  feito && "bg-mf-brilho text-white ring-mf-brilho",
                  agora &&
                    "bg-white text-mf-primaria ring-mf-brilho shadow-[0_0_0_4px_rgb(var(--mf-brilho)/0.15)]",
                  !feito && !agora && "bg-white text-mf-texto-3 ring-mf-linha"
                )}
              >
                {feito ? <Check size={15} aria-hidden="true" /> : i + 1}
                <span className="sr-only">
                  {p.rotulo}
                  {feito ? " (concluída)" : agora ? " (etapa atual)" : ""}
                </span>
              </button>
              <span
                aria-hidden="true"
                className={cn("text-xs font-medium", agora ? "text-mf-tinta" : "text-mf-texto-3")}
              >
                {p.rotulo}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="py-5" key={passo?.id}>
        {passo?.conteudo}
      </div>

      {aviso ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-mf-perigo/20 bg-mf-perigo-suave p-3 text-sm text-mf-perigo"
        >
          {aviso}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-mf-linha pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={atual === 0}
          onClick={() => {
            aoAvisar("");
            aoMudar(Math.max(0, atual - 1));
          }}
        >
          Voltar
        </Button>
        {ultimo ? (
          acaoFinal
        ) : (
          <Button type="button" onClick={avancar}>
            Continuar
          </Button>
        )}
      </div>
    </div>
  );
}
