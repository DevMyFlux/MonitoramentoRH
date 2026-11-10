import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { Revelar } from "../ui";

type CartaoDeTreinamentoProps = {
  /** A linha pequena de contexto acima do título ("Próximo treinamento"). */
  eyebrow: string;
  titulo: string;
  descricao: string;
  /** O tom do ponto do eyebrow e do brilho: destaque (pronto), info (em andamento) ou neutro. */
  tom?: "destaque" | "neutro";
  /** O que fica à direita em telas largas (a linha do tempo, por exemplo). */
  lateral?: ReactNode;
  /** O botão ou o aviso de ação. */
  acao?: ReactNode;
  /** Mensagens logo abaixo do texto (um erro ao iniciar, por exemplo). */
  children?: ReactNode;
};

/**
 * O cartão de treinamento: o destaque da tela inicial. Diz qual é o próximo passo do participante
 * e dá o botão para ele. Superfície branca com um brilho suave da cor de destaque no canto.
 */
export function CartaoDeTreinamento({
  eyebrow,
  titulo,
  descricao,
  tom = "destaque",
  lateral,
  acao,
  children
}: CartaoDeTreinamentoProps) {
  return (
    <Revelar
      as="section"
      className="relative isolate overflow-hidden rounded-lab-xl border border-lab-linha bg-lab-superficie p-7 shadow-lab-2 sm:p-9"
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full blur-3xl",
          tom === "destaque" ? "bg-lab-destaque/[0.12]" : "bg-lab-tinta/[0.05]"
        )}
      />
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lab-legenda font-medium text-lab-tinta-2">
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 rounded-full",
                tom === "destaque" ? "bg-lab-destaque" : "bg-lab-tinta-3"
              )}
            />
            {eyebrow}
          </p>
          <h2 className="mt-3 text-lab-h1 text-lab-tinta">{titulo}</h2>
          <p className="mt-3 max-w-xl text-lab-corpo text-lab-tinta-2">{descricao}</p>
          {children}
          {acao ? <div className="mt-6">{acao}</div> : null}
        </div>
        {lateral ? <div className="min-w-0 lg:w-80">{lateral}</div> : null}
      </div>
    </Revelar>
  );
}
