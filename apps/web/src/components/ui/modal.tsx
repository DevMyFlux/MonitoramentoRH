import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type ModalProps = {
  children: ReactNode;
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
};

export function Modal({ children, description, isOpen, onClose, title }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <section
        aria-modal="true"
        className="w-full max-w-lg rounded border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <Button aria-label="Fechar" icon={<X size={18} />} onClick={onClose} variant="ghost" />
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}
