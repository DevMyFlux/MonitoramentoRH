import { useCallback, useState } from "react";

// Preferências de voz deste navegador. localStorage só como conveniência: se falhar (modo privado,
// dados bloqueados), a tela segue funcionando com o padrão.
function ler(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}
function gravar(chave: string, valor: boolean): void {
  try {
    window.localStorage.setItem(chave, valor ? "1" : "0");
  } catch {
    /* sem armazenamento: a preferência vale só nesta tela */
  }
}

export const chavesDeVoz = {
  lerRespostas: "lab-voz-ler-respostas",
  cienteDoDitado: "lab-voz-ciente-do-ditado"
} as const;

/** Um interruptor lembrado entre visitas. Padrão: desligado. */
export function usePreferencia(chave: string): [boolean, (valor: boolean) => void] {
  const [valor, setValor] = useState(() => ler(chave));
  const definir = useCallback(
    (novo: boolean) => {
      gravar(chave, novo);
      setValor(novo);
    },
    [chave]
  );
  return [valor, definir];
}
