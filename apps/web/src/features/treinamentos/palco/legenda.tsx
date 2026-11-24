// Legenda/narração digitada na tela (ideia do "Text Type" do React Bits, reactbits.dev, escrita do
// zero). O texto visível aparece letra a letra; o leitor de tela recebe o texto inteiro de uma vez
// (aria-live). Com "reduzir movimento", o texto aparece inteiro. `aoTerminar` avisa quando acabou,
// para o painel da pergunta só abrir depois da narração. Para outro texto, o pai troca a `key`.
import { useEffect, useState } from "react";

const MS_POR_LETRA = 26;

export function Legenda({
  texto,
  reduzido,
  aoTerminar
}: {
  texto: string;
  reduzido: boolean;
  aoTerminar?: () => void;
}) {
  const [mostradas, setMostradas] = useState(reduzido ? texto.length : 0);

  useEffect(() => {
    if (reduzido) return;
    const intervalo = setInterval(() => {
      setMostradas((atual) => {
        if (atual >= texto.length) {
          clearInterval(intervalo);
          return atual;
        }
        return atual + 1;
      });
    }, MS_POR_LETRA);
    return () => clearInterval(intervalo);
  }, [texto, reduzido]);

  const terminou = reduzido || mostradas >= texto.length;
  useEffect(() => {
    if (terminou) aoTerminar?.();
  }, [terminou]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl self-start rounded-mf-controle bg-black/60 px-3 py-2 text-sm leading-6 text-white sm:text-base">
      <p aria-hidden="true">
        {reduzido ? texto : texto.slice(0, mostradas)}
        {terminou ? null : <span className="ml-0.5 inline-block w-2 animate-pulse">▍</span>}
      </p>
      <p className="sr-only" aria-live="polite">
        {texto}
      </p>
    </div>
  );
}
