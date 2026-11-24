// Treinamentos Interativos — a lista do participante (Ambiente Operação, claro): o que está aberto
// para ele nas turmas ativas, o que está em andamento e o histórico. Quem decide o que aparece é a
// API (/minhas); sem vínculo de colaborador, a API recusa e a tela explica.
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clapperboard, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, Skeleton, TituloDePagina } from "../../components/ui";
import { cn } from "../../lib/cn";
import { apiDosTreinamentos } from "../../features/treinamentos/api";

const nomeDaArea: Record<string, string> = {
  manutencao: "Manutenção",
  rh: "RH",
  seguranca: "Segurança",
  operacao: "Operação"
};
const nivel = {
  ok: { rotulo: "Bom", classe: "bg-mf-realce-suave text-mf-primaria" },
  warn: { rotulo: "Atenção", classe: "bg-mf-alerta-suave text-mf-alerta" },
  bad: { rotulo: "Risco", classe: "bg-mf-perigo-suave text-mf-perigo" }
} as const;

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function TreinamentosPage() {
  const minhas = useQuery({
    queryKey: ["treinamentos", "minhas"],
    queryFn: apiDosTreinamentos.minhas,
    retry: false
  });

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Desenvolvimento"
        titulo="Treinamentos"
        descricao="Situações do dia a dia em cena: você decide, vê o que acontece e entende por quê. Sem limite de tempo."
      />
      {minhas.isPending ? (
        <div
          role="status"
          aria-label="Carregando treinamentos"
          className="grid gap-4 md:grid-cols-2"
        >
          <Skeleton className="h-44 rounded-mf-cartao" />
          <Skeleton className="h-44 rounded-mf-cartao" />
        </div>
      ) : minhas.isError ? (
        <ErrorState
          title="Não foi possível carregar os seus treinamentos"
          description={minhas.error.message}
          onRetry={() => void minhas.refetch()}
        />
      ) : (
        <>
          <section aria-labelledby="abertos" className="space-y-3">
            <h2 id="abertos" className="font-display text-lg font-bold text-mf-tinta">
              Para fazer
            </h2>
            {minhas.data.abertas.length === 0 ? (
              <EmptyState
                title="Nenhum treinamento aberto para você"
                description="Quando o RH atribuir um treinamento à sua turma, ele aparece aqui."
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {minhas.data.abertas.map((item) => (
                  <li
                    key={item.atribuicaoId}
                    className="relative overflow-hidden rounded-mf-cartao bg-mf-tinta p-5 text-white shadow-mf-2"
                  >
                    <Clapperboard
                      aria-hidden="true"
                      className="absolute -right-4 -top-4 h-28 w-28 text-white/5"
                    />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6EE7B7]">
                      {nomeDaArea[item.area] ?? item.area} · {item.turma}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold">{item.titulo}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {item.exemplo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FBBF24]/15 px-2 py-1 text-[#FBBF24]">
                          <TriangleAlert size={12} aria-hidden="true" /> EXEMPLO
                        </span>
                      ) : null}
                      {item.prazo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                          <CalendarClock size={12} aria-hidden="true" /> Até {dataCurta(item.prazo)}
                        </span>
                      ) : null}
                      {item.concluidas > 0 ? (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          Feito {item.concluidas}×
                        </span>
                      ) : null}
                    </div>
                    {item.emAndamento ? (
                      <p className="mt-3 text-sm text-slate-200">
                        Em andamento: {item.emAndamento.respondidas} de 5 respondidas.
                      </p>
                    ) : null}
                    <Link
                      to={`/treinamentos/${item.atribuicaoId}/jogar`}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-mf-controle bg-[#34D399] px-4 text-sm font-semibold text-mf-tinta"
                    >
                      {item.emAndamento ? (
                        <RotateCcw size={16} aria-hidden="true" />
                      ) : (
                        <Play size={16} aria-hidden="true" />
                      )}
                      {item.emAndamento
                        ? "Continuar"
                        : item.concluidas > 0
                          ? "Fazer de novo"
                          : "Começar"}
                      <span className="sr-only">: {item.titulo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="historico" className="space-y-3">
            <h2 id="historico" className="font-display text-lg font-bold text-mf-tinta">
              Histórico
            </h2>
            {minhas.data.historico.length === 0 ? (
              <p className="text-sm text-mf-texto-2">
                Os treinamentos que você concluir ficam aqui.
              </p>
            ) : (
              <ul className="divide-y divide-mf-linha overflow-hidden rounded-mf-cartao border border-mf-linha bg-mf-cartao shadow-mf-1">
                {minhas.data.historico.map((h) => (
                  <li key={h.tentativaId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-mf-tinta">{h.titulo}</p>
                      <p className="text-xs text-mf-texto-3">
                        {h.concluidaEm ? `Concluído em ${dataCurta(h.concluidaEm)}` : ""}
                        {h.validada ? " · validado pelo RH" : ""}
                      </p>
                    </div>
                    <ul className="flex flex-wrap gap-1.5" aria-label="Resultados">
                      {h.resultados.map((r) => (
                        <li
                          key={r.id}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            nivel[r.nivel].classe
                          )}
                        >
                          {r.label}: {nivel[r.nivel].rotulo}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={`/treinamentos/resultado/${h.tentativaId}`}
                      className="inline-flex min-h-11 items-center rounded-mf-controle px-3 text-sm font-semibold text-mf-primaria hover:bg-mf-realce-suave"
                    >
                      Ver resultado
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
