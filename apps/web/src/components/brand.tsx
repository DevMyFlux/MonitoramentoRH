import { Layers2 } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${light ? "text-white" : "text-slate-900"}`}>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${light ? "bg-white/10 text-emerald-200 ring-1 ring-white/15" : "bg-emerald-900 text-white"}`}
      >
        <Layers2 size={23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="text-2xl font-semibold tracking-tight">
        My<span className={light ? "text-emerald-200" : "text-emerald-700"}>Flux</span>
        <span className="ml-1 text-emerald-400">.</span>
      </span>
    </div>
  );
}
