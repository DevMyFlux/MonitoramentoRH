import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

export function ErrorState({ description, onRetry, title }: ErrorStateProps) {
  return (
    <section className="rounded border border-red-200 bg-red-50 p-5">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 text-red-700" aria-hidden="true" size={20} />
        <div>
          <h2 className="font-semibold text-red-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-800">{description}</p>
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
