import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "../ui";
import type { ErroDaTela } from "../erros";

/** Os erros que são só informação (não adianta tentar de novo), em vez de alarme. */
const INFORMATIVOS = new Set<ErroDaTela["tipo"]>([
  "modulo-desligado",
  "sem-acesso",
  "sem-vinculo",
  "sem-teste",
  "teste-indisponivel"
]);

type ErroDaTelaDoLabProps = {
  erro: ErroDaTela;
  /** Quando o erro permite, mostra "Tentar novamente". */
  aoTentarDeNovo?: () => void;
  /** Um botão ou link de saída (por exemplo, "Voltar ao painel"). */
  acao?: ReactNode;
};

/** Um erro de página inteira: informativo (sem acesso, módulo desligado...) ou alarme. */
export function ErroDaTelaDoLab({ erro, aoTentarDeNovo, acao }: ErroDaTelaDoLabProps) {
  if (INFORMATIVOS.has(erro.tipo)) {
    return <EmptyState title={erro.titulo} description={erro.descricao} action={acao} />;
  }
  return (
    <div className="space-y-4">
      <ErrorState
        title={erro.titulo}
        description={erro.descricao}
        {...(erro.podeTentarDeNovo && aoTentarDeNovo ? { onRetry: aoTentarDeNovo } : {})}
      />
      {acao}
    </div>
  );
}
