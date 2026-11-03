import type { LabEstilo, LabTipoDePerfil } from "@my-flux/shared";
import { cn } from "../../../lib/cn";
import { formatarNumero, nomeDaFlexibilidade, nomeDoEstilo } from "../rotulos";

type PerfilDisponivel = Extract<LabTipoDePerfil, { disponivel: true }>;

// Os quatro estilos no quadrante clássico da Liderança Situacional: o eixo vertical é quanto de
// direção o líder dá; o horizontal, quanto de apoio.
const celulas: ReadonlyArray<{ estilo: LabEstilo; linha: string }> = [
  { estilo: "direcao", linha: "Mais direção · menos apoio" },
  { estilo: "orientacao", linha: "Mais direção · mais apoio" },
  { estilo: "delegacao", linha: "Menos direção · menos apoio" },
  { estilo: "apoio", linha: "Menos direção · mais apoio" }
];

/** O perfil do participante: quantas escolhas em cada estilo, o predominante e a flexibilidade. */
export function QuadranteDeEstilos({ perfil }: { perfil: PerfilDisponivel }) {
  const total = perfil.nEscolhas;
  const destacados = new Set<LabEstilo>(
    perfil.estiloPredominante ? [perfil.estiloPredominante] : perfil.estilosEmpatados
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {celulas.map(({ estilo, linha }) => {
          const n = perfil.distribuicao[estilo];
          const pct = total > 0 ? (n / total) * 100 : 0;
          const destacado = destacados.has(estilo) && n > 0;
          return (
            <div
              key={estilo}
              className={cn(
                "rounded-xl border p-4",
                destacado ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"
              )}
            >
              <p className="text-sm font-semibold text-slate-950">{nomeDoEstilo[estilo]}</p>
              <p className="text-[11px] text-slate-500">{linha}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {n}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  {n === 1 ? "escolha" : "escolhas"}
                </span>
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
                aria-hidden="true"
              >
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Estilo predominante
          </dt>
          <dd className="mt-0.5 font-semibold text-slate-950">
            {perfil.estiloPredominante
              ? nomeDoEstilo[perfil.estiloPredominante]
              : perfil.estilosEmpatados.length > 1
                ? `Empate entre ${perfil.estilosEmpatados.map((e) => nomeDoEstilo[e]).join(" e ")}`
                : "Ainda sem escolhas que envolvam a equipe"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Flexibilidade
          </dt>
          <dd className="mt-0.5 font-semibold text-slate-950">
            {perfil.flexibilidade
              ? `${nomeDaFlexibilidade[perfil.flexibilidade]}${
                  perfil.flexibilidadePct === null
                    ? ""
                    : ` (${formatarNumero(perfil.flexibilidadePct)}%)`
                }`
              : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        Baseado em {perfil.nEscolhas} {perfil.nEscolhas === 1 ? "escolha" : "escolhas"} de{" "}
        {perfil.testesConsiderados} {perfil.testesConsiderados === 1 ? "teste" : "testes"}
        {perfil.testesAguardandoValidacao > 0
          ? `, dos quais ${perfil.testesAguardandoValidacao} aguardando validação`
          : ""}
        .
      </p>
    </div>
  );
}
