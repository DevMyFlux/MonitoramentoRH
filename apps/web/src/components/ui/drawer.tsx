import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type DrawerProps = {
  children: ReactNode;
  isOpen: boolean;
  title: string;
  onClose: () => void;
};

export function Drawer({ children, isOpen, onClose, title }: DrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50">
      <aside
        aria-label={title}
        className="ml-auto h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <Button aria-label="Fechar" icon={<X size={18} />} onClick={onClose} variant="ghost" />
        </header>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  );
}
