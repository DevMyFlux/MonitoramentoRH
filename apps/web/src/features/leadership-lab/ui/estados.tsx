import { Inbox, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { Button } from "./botao";
import { Revelar } from "./revelar";

/** Um bloco cinza com um brilho que passa devagar. Sem movimento para quem pediu menos movimento. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-lab-esqueleto rounded-lab-md bg-lab-superficie-3 bg-[linear-gradient(90deg,transparent_0%,rgb(255_255_255/0.75)_50%,transparent_100%)] bg-[length:200%_100%] motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

/** O carregamento de uma tela inteira: o desenho aproximado do que vai chegar. */
export function LoadingState() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-40 rounded-lab-lg" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-lab-lg" />
        <Skeleton className="h-28 rounded-lab-lg" />
        <Skeleton className="h-28 rounded-lab-lg" />
      </div>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
};

/** Nada para mostrar (ou nada que se possa fazer): explica e, se couber, aponta a saída. */
export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <Revelar>
      <section className="rounded-lab-lg border border-dashed border-lab-linha-forte bg-lab-superficie px-6 py-12 text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-lab-superficie-3 text-lab-tinta-3"
        >
          {icon ?? <Inbox size={22} strokeWidth={1.6} />}
        </span>
        <h2 className="text-lab-h3 text-lab-tinta">{title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-lab-pequeno leading-6 text-lab-tinta-2">
          {description}
        </p>
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
    </Revelar>
  );
}

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

/** Algo deu errado: tom de aviso, sem alarde, com "Tentar novamente" quando faz sentido. */
export function ErrorState({ description, onRetry, title }: ErrorStateProps) {
  return (
    <Revelar>
      <section className="rounded-lab-lg border border-lab-perigo/20 bg-lab-perigo-suave p-6">
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lab-perigo/10 text-lab-perigo"
          >
            <TriangleAlert size={20} />
          </span>
          <div>
            <h2 className="text-lab-h3 text-lab-perigo-texto">{title}</h2>
            <p className="mt-1 text-lab-pequeno leading-6 text-lab-perigo-texto/90">
              {description}
            </p>
            {onRetry ? (
              <Button className="mt-4" onClick={onRetry} size="sm" variant="secondary">
                Tentar novamente
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </Revelar>
  );
}
