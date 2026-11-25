/* eslint-disable react-refresh/only-export-components */
// Métricas de "necessário", "coberto" e "cobertura" da tela de Escalas. Vêm do dimensionamento do
// QLP (módulo OCULTO, ainda não finalizado), por isso saíram da tela ativa. O cálculo continua no
// resultado da escala (generatedResult.metrics); aqui ficam só a leitura e a exibição, que a tela
// de Escalas usa apenas com o QLP ativo em packages/shared/src/modules.ts.
import { CartaoSpotlight, Contador } from "../../components/ui";
import { cn } from "../../lib/cn";

export type MetricasDeCobertura = { required: number; covered: number; coverage: number };

type VersaoComResultado = Record<string, unknown> | null;

export function metricasDaVersao(version: VersaoComResultado): MetricasDeCobertura | null {
  const resultado = version?.generatedResult as { metrics?: MetricasDeCobertura } | undefined;
  return resultado?.metrics ?? null;
}

/** O trecho "· Cobertura 87%" da linha de cada versão da escala. */
export function textoDeCobertura(version: VersaoComResultado): string {
  return ` · Cobertura ${metricasDaVersao(version)?.coverage ?? "—"}%`;
}

export function CartoesDeCobertura({ metricas: m }: { metricas: MetricasDeCobertura | null }) {
  const cobertura = Math.max(0, Math.min(100, m?.coverage ?? 0));
  const cartoes = [
    { rotulo: "Necessário", valor: m?.required, dica: "pessoa-dia que o rodízio escala" },
    { rotulo: "Coberto", valor: m?.covered, dica: "pessoa-dia com trabalho" }
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cartoes.map((c) => (
        <CartaoSpotlight key={c.rotulo} className="p-3.5">
          <p className="text-xs font-medium text-mf-texto-2">{c.rotulo}</p>
          <p className="mt-1.5 font-display text-3xl font-bold leading-none text-mf-tinta">
            {c.valor === undefined ? (
              "—"
            ) : (
              <Contador valor={c.valor} formatar={(n) => String(Math.round(n))} />
            )}
          </p>
          <p className="mt-1.5 text-[11px] text-mf-texto-3">{c.dica}</p>
        </CartaoSpotlight>
      ))}
      <CartaoSpotlight className="col-span-2 p-3.5 sm:col-span-1">
        <p className="text-xs font-medium text-mf-texto-2">Cobertura</p>
        <p
          className={cn(
            "mt-1.5 font-display text-3xl font-bold leading-none",
            cobertura < 100 ? "text-mf-alerta" : "text-mf-primaria"
          )}
        >
          {m?.coverage === undefined ? (
            "—"
          ) : (
            <>
              <Contador valor={m.coverage} formatar={(n) => String(Math.round(n))} />%
            </>
          )}
        </p>
        <div
          role="img"
          aria-label={`Cobertura de ${m?.coverage ?? 0}%`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-mf-linha"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700",
              cobertura < 100 ? "bg-mf-alerta" : "bg-mf-brilho"
            )}
            style={{ width: `${cobertura}%` }}
          />
        </div>
      </CartaoSpotlight>
    </div>
  );
}
