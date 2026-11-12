import type { HTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "../../../lib/cn";
import { classeDaSuperficie } from "./superficie";

/** A tabela do Lab: moldura de cartão, cabeçalho discreto, linhas separadas por fios finos. */
export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={cn(classeDaSuperficie, "rolagem-fina overflow-x-auto")}>
      <table className={cn("min-w-full text-lab-pequeno", className)} {...props} />
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className="border-b border-lab-linha bg-lab-superficie-2 text-left text-lab-legenda text-lab-tinta-2"
      {...props}
    />
  );
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-lab-linha" {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className="transition-colors duration-lab-rapida hover:bg-lab-superficie-2" {...props} />
  );
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-5 py-3.5 text-lab-legenda font-medium normal-case tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-4 text-lab-tinta", className)} {...props} />;
}
