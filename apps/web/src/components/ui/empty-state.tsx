import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/** Estado vazio: um texto que explica o porquê e o que fazer, e a ação quando houver. */
export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-mf-linha bg-mf-cartao px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mf-realce-suave text-mf-primaria"
      >
        <Inbox size={22} />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-mf-tinta">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-mf-texto-2">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
