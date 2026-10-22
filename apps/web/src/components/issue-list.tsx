import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { type IssueGroup, type IssueSeverity } from "@my-flux/shared";
import { cn } from "../lib/cn";

const sections: Record<
  IssueSeverity,
  { heading: (n: number) => string; icon: ReactNode; box: string; open: boolean }
> = {
  blocking: {
    heading: (n) => `Impedem o envio para aprovação (${n})`,
    icon: <OctagonAlert size={14} aria-hidden />,
    box: "border-red-200 bg-red-50 text-red-900",
    open: true
  },
  warning: {
    heading: (n) => `Alertas (${n})`,
    icon: <AlertTriangle size={14} aria-hidden />,
    box: "border-amber-200 bg-amber-50 text-amber-900",
    open: true
  },
  info: {
    heading: (n) => `Informações (${n})`,
    icon: <Info size={14} aria-hidden />,
    box: "border-slate-200 bg-slate-50 text-slate-700",
    open: false
  }
};

/**
 * Pendências e validações da escala em linguagem simples. Mostra o que fazer e deixa o código técnico num bloco
 * recolhido ("Detalhes técnicos") para quem faz o suporte. Só `blocking` impede o envio para aprovação.
 */
export function IssueList({
  groups,
  className,
  blockingHeading
}: {
  groups: IssueGroup[];
  className?: string;
  /** Título da seção impeditiva quando o contexto não é o envio para aprovação (ex.: edição de um dia). */
  blockingHeading?: (n: number) => string;
}) {
  if (groups.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {(["blocking", "warning", "info"] as const).map((severity) => {
        const items = groups.filter((g) => g.severity === severity);
        if (items.length === 0) return null;
        const section = sections[severity];
        return (
          <details
            key={severity}
            open={section.open}
            className={cn("rounded border p-3 text-xs", section.box)}
          >
            <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
              {section.icon}
              {severity === "blocking" && blockingHeading
                ? blockingHeading(items.length)
                : section.heading(items.length)}
            </summary>
            <ul className="mt-2 space-y-2">
              {items.map((issue) => (
                <li
                  key={`${issue.employeeName}|${issue.code}|${issue.detail}`}
                  className="rounded bg-white/60 p-2"
                >
                  <p className="font-semibold">{issue.title}</p>
                  <p>{issue.detail}</p>
                  {issue.action ? (
                    <p className="mt-0.5">
                      <span className="font-semibold">O que fazer: </span>
                      {issue.action}
                    </p>
                  ) : null}
                  <details className="mt-1 text-[11px] opacity-80">
                    <summary className="cursor-pointer">Detalhes técnicos</summary>
                    <p className="mt-0.5 break-words font-mono">
                      {issue.technical}
                      {issue.count > 1 ? ` (${issue.count} dias)` : ""}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
