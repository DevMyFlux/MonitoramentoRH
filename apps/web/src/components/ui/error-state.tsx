import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

/** Erro com a causa em linguagem simples e, quando dá, a nova tentativa. Vermelho, sem enfeite. */
export function ErrorState({ description, onRetry, title }: ErrorStateProps) {
  return (
    <section role="alert" className="rounded-2xl border border-mf-perigo/20 bg-mf-perigo-suave p-5">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 shrink-0 text-mf-perigo" aria-hidden="true" size={20} />
        <div>
          <h2 className="font-semibold text-mf-perigo">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-mf-perigo">{description}</p>
          {onRetry ? (
            <Button className="mt-4" onClick={onRetry} size="sm" variant="secondary">
              Tentar novamente
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
