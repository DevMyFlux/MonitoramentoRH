export function LoadingState() {
  return (
    <div className="space-y-3" aria-label="Carregando">
      <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-20 animate-pulse rounded bg-slate-200" />
        <div className="h-20 animate-pulse rounded bg-slate-200" />
        <div className="h-20 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}
