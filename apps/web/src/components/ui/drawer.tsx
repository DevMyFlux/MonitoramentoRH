import { useEffect, type ReactNode } from "react";
import { useSobreposicao } from "./use-sobreposicao";
import { X } from "lucide-react";
import { Button } from "./button";

type DrawerProps = {
  children: ReactNode;
  isOpen: boolean;
  title: string;
  onClose: () => void;
};

/**
 * Gaveta lateral. Desliza da direita, fecha com Esc e com o clique no fundo; o cabeçalho é de vidro
 * e fica fixo ao rolar, para o botão de fechar nunca sumir (alvo de 44 px).
 */
export function Drawer({ children, isOpen, onClose, title }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [isOpen, onClose]);

  useSobreposicao(isOpen);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="gaveta-fundo fixed inset-0 z-50 bg-mf-tinta/50 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        aria-label={title}
        className="gaveta-painel ml-auto h-full w-full max-w-lg overflow-y-auto bg-mf-fundo shadow-2xl"
      >
        <header className="vidro sticky top-0 z-10 flex items-center justify-between border-b border-mf-linha/70 px-4 py-2">
          <h2 className="font-display text-lg font-bold text-mf-tinta">{title}</h2>
          <Button
            aria-label="Fechar"
            icon={<X size={18} />}
            onClick={onClose}
            variant="ghost"
            className="min-h-11 min-w-11"
          />
        </header>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  );
}
