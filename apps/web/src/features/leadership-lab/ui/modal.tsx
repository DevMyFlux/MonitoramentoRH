import { X } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useId } from "react";
import { useArmadilhaDeFoco } from "./armadilha-de-foco";
import { Button } from "./botao";
import { mola, transicao } from "./movimento";

type ModalProps = {
  children: ReactNode;
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  /**
   * Falso enquanto uma ação está em andamento: Esc e o botão de fechar não fazem nada, para a tela
   * não "cancelar" algo que o servidor ainda está processando.
   */
  closable?: boolean;
};

/**
 * Janela de diálogo. Entra com um fade e um leve "assentar"; sai na hora (quem a fecha já mudou de
 * assunto). Prende o foco, fecha com Esc e devolve o foco a quem a abriu.
 */
export function Modal({
  children,
  closable = true,
  description,
  isOpen,
  onClose,
  title
}: ModalProps) {
  if (!isOpen) return null;
  return (
    <ModalAberto
      closable={closable}
      {...(description ? { description } : {})}
      onClose={onClose}
      title={title}
    >
      {children}
    </ModalAberto>
  );
}

function ModalAberto({
  children,
  closable,
  description,
  onClose,
  title
}: Omit<ModalProps, "isOpen"> & { closable: boolean }) {
  const idDoTitulo = useId();
  const idDaDescricao = useId();
  const painel = useArmadilhaDeFoco<HTMLElement>(true, () => {
    if (closable) onClose();
  });

  return (
    // !mt-0: um `space-y-*` do pai não pode empurrar a janela, que é fixa na tela.
    <div className="fixed inset-0 z-50 !mt-0 grid place-items-center p-4">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-lab-tinta/35 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transicao.base}
      />
      <motion.section
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        aria-describedby={description ? idDaDescricao : undefined}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-lab-xl bg-lab-superficie shadow-lab-3 outline-none"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={mola.suave}
      >
        <header className="flex items-start justify-between gap-4 p-6 pb-0">
          <div className="min-w-0">
            <h2 id={idDoTitulo} className="text-lab-h2 text-lab-tinta">
              {title}
            </h2>
            {description ? (
              <p id={idDaDescricao} className="mt-1.5 text-lab-pequeno leading-6 text-lab-tinta-2">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Fechar"
            icon={<X size={18} />}
            onClick={onClose}
            disabled={!closable}
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1"
          />
        </header>
        <div className="p-6">{children}</div>
      </motion.section>
    </div>
  );
}
