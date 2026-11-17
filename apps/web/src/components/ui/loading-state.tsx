import { Skeleton } from "./skeleton";

/** Carregando: o esqueleto de um título, um bloco e três indicadores. */
export function LoadingState() {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}
