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
      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {items.map((item) => (
          <button
            aria-selected={item.id === activeId}
            className={cn(
              "h-10 border-b-2 px-3 text-sm font-medium transition",
              item.id === activeId
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            )}
            key={item.id}
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
