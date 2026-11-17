import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  activeId: string;
  items: TabItem[];
  onChange: (id: string) => void;
};

export function Tabs({ activeId, items, onChange }: TabsProps) {
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div>
      <div
        className="flex gap-1 overflow-x-auto border-b border-mf-linha [scrollbar-width:none]"
        role="tablist"
      >
        {items.map((item) => (
          <button
            aria-selected={item.id === activeId}
            className={cn(
              "min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors",
              item.id === activeId
                ? "border-mf-brilho text-mf-primaria"
                : "border-transparent text-mf-texto-3 hover:text-mf-tinta"
            )}
            key={item.id}
            // A aba escolhida sempre aparece, mesmo quando as abas passam da largura da tela.
            ref={(el) => {
              if (el && item.id === activeId)
                el.scrollIntoView?.({ inline: "center", block: "nearest" });
            }}
            onClick={() => onChange(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="py-4" role="tabpanel">
        {activeItem?.content}
      </div>
    </div>
  );
}
