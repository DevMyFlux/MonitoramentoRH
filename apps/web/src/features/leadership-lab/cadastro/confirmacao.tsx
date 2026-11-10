import { Button, Modal } from "../ui";

type ConfirmacaoProps = {
  titulo: string;
  /** O que acontece, em uma ou duas frases. É o que impede o clique sem pensar. */
  descricao: string;
  confirmar: string;
  aberta: boolean;
  pendente?: boolean;
  /** O que deu errado na última tentativa, se deu. */
  erro?: string | null;
  perigosa?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
};

/** Pede confirmação antes de uma ação que tira acesso ou visão de alguém. */
export function Confirmacao({
  titulo,
  descricao,
  confirmar,
  aberta,
  pendente = false,
  erro = null,
  perigosa = false,
  aoConfirmar,
  aoCancelar
}: ConfirmacaoProps) {
  return (
    <Modal
      isOpen={aberta}
      title={titulo}
      description={descricao}
      onClose={aoCancelar}
      closable={!pendente}
    >
      <div className="space-y-4">
        {erro ? (
          <p
            role="alert"
            className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
          >
            {erro}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={aoCancelar} disabled={pendente}>
            Cancelar
          </Button>
          <Button
            variant={perigosa ? "danger" : "primary"}
            onClick={aoConfirmar}
            disabled={pendente}
          >
            {pendente ? "Aguarde..." : confirmar}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
