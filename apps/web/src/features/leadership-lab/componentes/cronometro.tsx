import { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import { formatarRelogio } from "../rotulos";

type CronometroProps = {
  /** Quanto restava quando a situação chegou, medido no servidor. */
  restanteMs: number;
  /** O limite da situação inteira, só para a barra. */
  limiteMs: number;
  /** O instante (performance.now) em que a situação chegou ao navegador. */
  recebidaEm: number;
  /** Chamado uma vez quando zera. Quem decide se o tempo acabou de fato é o servidor. */
  aoZerar: () => void;
};

/**
 * Contagem regressiva. Conta a partir de quando a situação CHEGOU (relógio monotônico do
 * navegador), então recarregar a página ou voltar a uma tela em cache não devolve tempo. É só a
 * exibição: a conta que vale é a do servidor.
 */
export function Cronometro({ restanteMs, limiteMs, recebidaEm, aoZerar }: CronometroProps) {
  const fim = recebidaEm + restanteMs;
  const [agora, setAgora] = useState(recebidaEm);

  useEffect(() => {
    const id = setInterval(() => setAgora(performance.now()), 250);
    return () => clearInterval(id);
  }, []);

  const faltam = Math.max(0, fim - agora);
  const zerou = faltam === 0;

  const aoZerarRef = useRef(aoZerar);
  useEffect(() => {
    aoZerarRef.current = aoZerar;
  });
  useEffect(() => {
    if (zerou) aoZerarRef.current();
  }, [zerou]);

  const segundos = Math.ceil(faltam / 1000);
  const urgente = segundos <= 10;
  const fracao = limiteMs > 0 ? Math.min(1, faltam / limiteMs) : 0;
  // Leitor de tela: avisa só em 30 e 10 segundos e no fim, não a cada segundo.
  const anuncio = zerou
    ? "O tempo acabou."
    : segundos === 30 || segundos === 10
      ? `Faltam ${segundos} segundos.`
      : "";

  return (
    <div className="flex items-center gap-3.5">
      <svg
        aria-hidden="true"
        width={52}
        height={52}
        viewBox="0 0 52 52"
        className="shrink-0 -rotate-90"
      >
        <circle cx={26} cy={26} r={22} fill="none" strokeWidth={5} className="stroke-lab-linha" />
        <circle
          cx={26}
          cy={26}
          r={22}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - fracao}
          className={cn(
            "transition-[stroke-dashoffset,stroke] duration-300 ease-linear motion-reduce:transition-none",
            urgente ? "stroke-lab-perigo" : "stroke-lab-destaque"
          )}
        />
      </svg>
      <div>
        <span className="block text-lab-legenda font-medium text-lab-tinta-2">Tempo</span>
        <span
          role="timer"
          aria-label="Tempo restante"
          data-urgente={urgente ? "true" : undefined}
          className={cn(
            "tabular block text-[1.75rem] font-semibold leading-8 tracking-tight",
            urgente ? "text-lab-perigo" : "text-lab-tinta"
          )}
        >
          {formatarRelogio(faltam)}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </div>
  );
}
