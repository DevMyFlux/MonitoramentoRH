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
    <div className="w-full min-w-[9rem] max-w-[14rem]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tempo</span>
        <span
          role="timer"
          aria-label="Tempo restante"
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            urgente ? "text-red-700" : "text-slate-900"
          )}
        >
          {formatarRelogio(faltam)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-linear motion-reduce:transition-none",
            urgente ? "bg-red-600" : "bg-emerald-600"
          )}
          style={{ width: `${fracao * 100}%` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </div>
  );
}
