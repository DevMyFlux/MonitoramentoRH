import { CornerDownRight } from "lucide-react";

/** O efeito da escolha anterior, antes da próxima situação. Entra com uma animação curta. */
export function ConsequenciaDaEscolha({ texto }: { texto: string }) {
  return (
    <section
      aria-label="O que aconteceu depois da sua escolha"
      className="animate-lab-entrada rounded-2xl border border-emerald-200 bg-emerald-50 p-4 motion-reduce:animate-none"
    >
      <div className="flex gap-3">
        <CornerDownRight
          size={20}
          className="mt-0.5 shrink-0 text-emerald-700"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-sm font-semibold text-emerald-950">
            O que aconteceu depois da sua escolha
          </h2>
          <p className="mt-1 text-sm leading-6 text-emerald-950/90">{texto}</p>
        </div>
      </div>
    </section>
  );
}
