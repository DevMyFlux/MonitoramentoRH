import { CornerDownRight } from "lucide-react";
import { Revelar } from "../ui";

/** O efeito da escolha anterior, antes da próxima situação. Entra com a animação padrão. */
export function ConsequenciaDaEscolha({ texto }: { texto: string }) {
  return (
    <Revelar
      as="section"
      className="rounded-lab-lg border border-lab-sucesso/20 bg-lab-sucesso-suave p-5"
    >
      <div className="flex gap-3">
        <CornerDownRight
          size={20}
          className="mt-0.5 shrink-0 text-lab-sucesso"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-lab-pequeno font-semibold text-lab-sucesso-texto">
            O que aconteceu depois da sua escolha
          </h2>
          <p className="mt-1 text-lab-corpo leading-6 text-lab-sucesso-texto/90">{texto}</p>
        </div>
      </div>
    </Revelar>
  );
}
