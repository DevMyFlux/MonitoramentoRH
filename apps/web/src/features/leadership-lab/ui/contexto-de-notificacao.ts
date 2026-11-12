import { createContext, useContext } from "react";

export type TomDaNotificacao = "sucesso" | "erro" | "info";

export type Notificacao = {
  tom: TomDaNotificacao;
  titulo: string;
  descricao?: string;
};

export type Notificar = (notificacao: Notificacao) => void;

// Fora do provedor (testes de tela, por exemplo) notificar não faz nada em vez de quebrar.
export const ContextoDeNotificacao = createContext<Notificar>(() => undefined);

/** `notificar({ tom: "sucesso", titulo: "Salvo" })` mostra um aviso curto no canto da tela. */
export function useNotificar(): Notificar {
  return useContext(ContextoDeNotificacao);
}
