import { animate } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { duracao, easing, useAnimacaoReduzida } from "./movimento";

type NumeroAnimadoProps = {
  valor: number;
  /** Como o número aparece escrito (a mesma formatação do resto da tela). */
  formatar: (valor: number) => string;
  className?: string;
};

/**
 * Um número que "conta" até o valor ao aparecer (e de um valor a outro quando muda).
 *
 * O React sempre escreve o valor FINAL no texto: leitor de tela, impressão e testes veem o número
 * certo desde o primeiro quadro. A contagem só mexe no texto do nó por cima, e termina escrevendo
 * o mesmo valor final. Sem animação para quem pediu menos movimento.
 */
export function NumeroAnimado({ valor, formatar, className }: NumeroAnimadoProps) {
  const no = useRef<HTMLSpanElement>(null);
  const exibido = useRef(0);
  const reduzida = useAnimacaoReduzida();
  const formatarRef = useRef(formatar);
  useEffect(() => {
    formatarRef.current = formatar;
  });

  // Layout effect: o texto volta ao ponto de partida antes do primeiro quadro pintado, sem um
  // lampejo do valor final.
  useLayoutEffect(() => {
    const elemento = no.current;
    if (!elemento) return;
    if (reduzida) {
      exibido.current = valor;
      return;
    }
    elemento.textContent = formatarRef.current(exibido.current);
    const controle = animate(exibido.current, valor, {
      duration: duracao.lenta * 2,
      ease: easing.saida,
      onUpdate: (atual) => {
        exibido.current = atual;
        elemento.textContent = formatarRef.current(atual);
      },
      onComplete: () => {
        exibido.current = valor;
        elemento.textContent = formatarRef.current(valor);
      }
    });
    return () => controle.stop();
  }, [valor, reduzida]);

  return (
    <span ref={no} className={className}>
      {formatar(valor)}
    </span>
  );
}
