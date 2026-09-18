import { ChevronRight, Home } from "lucide-react";

type BreadcrumbsProps = {
  items: string[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Caminho da página"
      className="flex min-w-0 items-center gap-2 text-xs text-slate-500 sm:text-sm"
    >
      <Home aria-hidden="true" size={16} />
      {items.map((item, index) => (
        <span
          className={`min-w-0 items-center gap-2 ${index === 0 ? "hidden sm:flex" : "flex"}`}
          key={item}
        >
          <ChevronRight aria-hidden="true" size={14} />
          <span
            className="truncate font-medium text-slate-700"
            aria-current={index === items.length - 1 ? "page" : undefined}
          >
            {item === "MY FLUX" ? "MyFlux" : item}
          </span>
        </span>
      ))}
    </nav>
  );
}
