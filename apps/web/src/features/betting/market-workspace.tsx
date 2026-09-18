import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw, TicketCheck, BarChart3 } from "lucide-react";
import { Button } from "../../components/ui";
import { formatOdd, formatPercent } from "./engine";
import {
  buildAccumulatorSuggestion,
  getBestOdds,
  findOddsForEvent,
  type AccumulatorSuggestion,
  type MarketCandidate
} from "./daily-recommendation";
import { localStart, saoPauloDate } from "./dates";
import { savePreferences } from "./preferences";
import { saveAccumulatorAsPaperBet } from "./paper-betting-store";
import { oddsError, useMarketData, type MarketData } from "./use-market-data";
import {
  fetchSoccerEventsByDate,
  fetchEventStats,
  fetchRecentResults
} from "../sports-data/the-sports-db-provider";
import type { OddsEvent } from "./odds-api-client";
import { selectionLabel } from "./selection-label";

export const inputClass =
  "h-10 w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-emerald-400";
export const linkClass =
  "inline-flex min-h-9 items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-100";
export function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-6 text-slate-100">
      <header className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </header>
      {children}
    </div>
  );
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 border-t border-slate-800 py-4">
      <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={
        "border-l-2 py-2 pl-3 text-sm leading-6 " +
        (error ? "border-red-400 text-red-200" : "border-amber-300 text-slate-300")
      }
    >
      {children}
    </p>
  );
}
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function MarketControls({ market }: { market: MarketData }) {
  const [error, setError] = useState("");
  const save = (change: Parameters<typeof savePreferences>[0]) => {
    try {
      savePreferences(change);
      setError("");
    } catch {
      setError("Nao foi possivel salvar a preferencia neste navegador.");
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm">
          Data (Sao Paulo)
          <input
            aria-label="Data dos jogos"
            className={inputClass}
            type="date"
            value={market.scope.date}
            onChange={(event) =>
              market.updateFilter(
                "date",
                event.target.value === saoPauloDate(market.now) ? "" : event.target.value
              )
            }
          />
        </label>
        <label className="grid gap-2 text-sm">
          Periodo
          <select
            className={inputClass}
            value={market.scope.upcoming ? "week" : "day"}
            onChange={(event) =>
              market.updateFilter("scope", event.target.value === "week" ? "week" : "")
            }
          >
            <option value="day">Somente esta data</option>
            <option value="week">7 dias a partir desta data</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Liga
          <select
            className={inputClass}
            value={market.preferences.sport}
            onChange={(event) => save({ sport: event.target.value })}
          >
            <option value="soccer_all">Futebol: todas as ligas cobertas</option>
            {!market.sports.data?.data.some((sport) => sport.key === market.preferences.sport) &&
            market.preferences.sport !== "soccer_all" ? (
              <option value={market.preferences.sport}>{market.preferences.sport}</option>
            ) : null}
            {market.sports.data?.data.map((sport) => (
              <option key={sport.key} value={sport.key}>
                {sport.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Regiao das casas
          <select
            className={inputClass}
            value={market.preferences.region}
            onChange={(event) =>
              save({ region: event.target.value as typeof market.preferences.region })
            }
          >
            <option value="eu">Europa</option>
            <option value="uk">Reino Unido</option>
            <option value="us">Estados Unidos</option>
            <option value="au">Australia</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          A partir de
          <select
            className={inputClass}
            value={market.scope.afterHour}
            onChange={(event) => market.updateFilter("after", event.target.value)}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Casa
          <select
            className={inputClass}
            value={market.bookmaker}
            onChange={(event) => market.updateFilter("book", event.target.value)}
          >
            <option value="">Comparar todas as casas retornadas</option>
            {market.bookmaker && !market.bookmakers.some(([key]) => key === market.bookmaker) ? (
              <option value={market.bookmaker}>{market.bookmaker} (sem cotacoes)</option>
            ) : null}
            {market.bookmakers.map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span>
          The Odds API ·{" "}
          {market.query.data?.meta
            ? localStart(market.query.data.meta.fetchedAt)
            : "Sem consulta concluida"}{" "}
          · Horarios de Sao Paulo
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={market.query.isFetching}
          icon={<RefreshCw size={15} />}
          onClick={() => {
            void market.query.refetch();
            if (market.sports.isError) void market.sports.refetch();
          }}
        >
          Atualizar odds
        </Button>
      </div>
      {market.query.isFetching ? <Notice>Consultando as ligas e cotacoes reais...</Notice> : null}
      {market.query.isError ? <Notice error>{oddsError(market.query.error)}</Notice> : null}
      {market.sports.isError && !market.query.isError ? (
        <Notice>Catalogo de ligas indisponivel; a selecao atual foi mantida.</Notice>
      ) : null}
      {market.query.data?.meta.partial ? (
        <Notice>
          Consulta parcial: {market.query.data.meta.successfulLeagues} de{" "}
          {market.query.data.meta.requestedLeagues} ligas responderam. O ranking cobre apenas os
          dados recebidos.
        </Notice>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
      <p className="text-xs text-slate-400">
        Cobertura e disponibilidade variam por regiao. Betano e Superbet so aparecem quando
        retornadas pelo provedor; cotacoes estrangeiras nao confirmam acesso no Brasil.
      </p>
    </div>
  );
}

export function SimulateButton({ suggestion }: { suggestion: AccumulatorSuggestion }) {
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="sm"
          icon={<TicketCheck size={16} />}
          onClick={() => {
            try {
              setMessage(
                saveAccumulatorAsPaperBet(suggestion)
                  ? "Bilhete registrado na banca virtual. Nenhum dinheiro real foi usado."
                  : "Este bilhete ja esta no Paper betting."
              );
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Nao foi possivel salvar o bilhete."
              );
            }
          }}
        >
          Simular bilhete
        </Button>
        <Link className={linkClass} to="/paper-betting">
          Ver simulacoes <ArrowUpRight size={15} />
        </Link>
      </div>
      {message ? <Notice>{message}</Notice> : null}
    </div>
  );
}

export function CandidateList({
  candidates,
  market
}: {
  candidates: MarketCandidate[];
  market: MarketData;
}) {
  const [selected, setSelected] = useState<OddsEvent | null>(null);
  return (
    <div className="space-y-4">
      {!market.query.isPending && !market.query.isError && !candidates.length ? (
        <Notice>
          Nenhuma selecao com mercado 1X2 completo e cotacao recente neste periodo. Jogos de outras
          datas nao serao adicionados automaticamente.
        </Notice>
      ) : null}
      {candidates.map((candidate, index) => (
        <article
          key={candidate.event.id}
          className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">
                {index + 1}. {candidate.event.sportTitle} · {candidate.localStart}
              </p>
              <h3 className="mt-2 break-words font-semibold">
                {candidate.event.homeTeam} x {candidate.event.awayTeam}
              </h3>
              <p className="mt-2 text-lg font-semibold text-emerald-200">
                {selectionLabel(candidate.outcome.name)}{" "}
                <span className="text-white">@ {formatOdd(candidate.outcome.price)}</span>
              </p>
            </div>
            <span className="text-xs text-amber-200">Sugestao de mercado</span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Casa desta odd" value={candidate.outcome.bookmaker} />
            <Stat
              label="Estimativa de mercado"
              value={formatPercent(candidate.consensusProbability)}
            />
            <Stat label="Fontes do consenso" value={candidate.sources} />
            <Stat label="Cotacao atualizada" value={localStart(candidate.outcome.lastUpdate)} />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SimulateButton
              suggestion={{
                combinedOdd: candidate.outcome.price,
                combinedProbability: candidate.consensusProbability,
                legs: [
                  {
                    event: candidate.event,
                    outcome: candidate.outcome,
                    probability: candidate.consensusProbability
                  }
                ]
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<BarChart3 size={15} />}
              onClick={() =>
                setSelected(selected?.id === candidate.event.id ? null : candidate.event)
              }
            >
              Estatisticas e odds
            </Button>
          </div>
          {selected?.id === candidate.event.id ? (
            <EventStatistics event={candidate.event} now={market.now} />
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function AccumulatorPanel({
  market,
  initialTarget = "7"
}: {
  market: MarketData;
  initialTarget?: string;
}) {
  const [target, setTarget] = useState(initialTarget);
  const suggestion = buildAccumulatorSuggestion(
    market.events,
    Number(target),
    market.now,
    market.scope
  );
  return (
    <Section title="Multipla sugerida">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <label className="grid w-36 gap-2 text-sm">
          Odd alvo
          <input
            className={inputClass}
            type="number"
            min="2"
            max="100"
            step="0.1"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </label>
        <span className="text-sm text-amber-200">Risco alto · 2 a 6 jogos · Uma casa</span>
      </div>
      {Number(target) < 2 || Number(target) > 100 || !Number.isFinite(Number(target)) ? (
        <Notice error>Informe uma odd alvo entre 2 e 100.</Notice>
      ) : null}
      {!market.query.isPending && !market.query.isError && !suggestion ? (
        <Notice>
          Nao foi encontrada uma multipla entre {formatOdd(Number(target) * 0.85)} e{" "}
          {formatOdd(Number(target) * 1.15)} com favoritos no periodo selecionado, sem repetir
          equipes. A busca considera ate 18 favoritos por casa. Nao ha bilhete para sugerir com
          esses criterios.
        </Notice>
      ) : null}
      {suggestion ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Odd combinada" value={formatOdd(suggestion.combinedOdd)} />
            <Stat label="Casa unica" value={suggestion.legs[0]!.outcome.bookmaker} />
            <Stat
              label="Estimativa conjunta"
              value={formatPercent(suggestion.combinedProbability)}
            />
            <Stat
              label="Valor virtual por teste"
              value={"R$ " + formatOdd(market.preferences.paperStake)}
            />
          </div>
          <ol className="divide-y divide-slate-800">
            {suggestion.legs.map((leg) => (
              <li className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]" key={leg.event.id}>
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {leg.event.homeTeam} x {leg.event.awayTeam}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {localStart(leg.event.commenceTime)} · {leg.event.sportTitle}
                  </p>
                  <p className="mt-2 text-sm text-emerald-200">
                    {selectionLabel(leg.outcome.name)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">{formatOdd(leg.outcome.price)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Atualizada: {localStart(leg.outcome.lastUpdate)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Notice>
            A probabilidade conjunta multiplica estimativas do mercado e supoe independencia, que
            nao foi validada. Nao e probabilidade de um modelo proprio nem garantia de ganho. A casa
            pode alterar odds ou recusar a combinacao.
          </Notice>
          <SimulateButton
            key={suggestion.legs
              .map(
                (leg) =>
                  leg.event.id + leg.outcome.bookmakerKey + leg.outcome.name + leg.outcome.price
              )
              .join("|")}
            suggestion={suggestion}
          />
        </div>
      ) : null}
    </Section>
  );
}

function EventStatistics({ event, now }: { event: OddsEvent; now: Date }) {
  const fixtures = useQuery({
    queryKey: ["sportsdb-events", saoPauloDate(event.commenceTime)],
    queryFn: () => fetchSoccerEventsByDate(saoPauloDate(event.commenceTime)),
    retry: false,
    staleTime: 300_000
  });
  const fixture = fixtures.data?.find((item) => findOddsForEvent(item, [event]));
  const stats = useQuery({
    queryKey: ["event-stats", fixture?.eventId],
    queryFn: () => fetchEventStats(fixture!.eventId),
    enabled: Boolean(fixture),
    retry: false,
    staleTime: 300_000
  });
  const recent = useQuery({
    queryKey: ["event-recent", fixture?.homeTeamId, fixture?.awayTeamId],
    queryFn: async () => {
      const results = await Promise.allSettled([
        fetchRecentResults(fixture!.homeTeamId!),
        fetchRecentResults(fixture!.awayTeamId!)
      ]);
      return {
        events: results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
        partial: results.some((result) => result.status === "rejected")
      };
    },
    enabled: Boolean(fixture?.homeTeamId && fixture?.awayTeamId),
    retry: false,
    staleTime: 300_000
  });
  return (
    <div className="space-y-4 border-t border-slate-800 pt-4">
      <h4 className="text-sm font-semibold">Comparacao 1X2 · Tempo regulamentar</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {getBestOdds(event, now).map((odd) => (
          <Stat
            key={odd.name}
            label={selectionLabel(odd.name)}
            value={formatOdd(odd.price) + " · " + odd.bookmaker}
          />
        ))}
      </div>
      <h4 className="text-sm font-semibold">Estatisticas da partida · TheSportsDB</h4>
      {fixtures.isFetching || stats.isFetching ? (
        <Notice>Consultando estatisticas...</Notice>
      ) : fixtures.isError || stats.isError ? (
        <Notice>Falha ao consultar as estatisticas. As odds acima vieram de outra fonte.</Notice>
      ) : !fixture || !stats.data?.length ? (
        <Notice>
          Esta fonte nao forneceu estatisticas avancadas para a partida. Pre-jogo, posse,
          finalizacoes e placar ao vivo podem nao estar disponiveis. As cotacoes acima continuam
          validas para comparacao.
        </Notice>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.data.map((stat, index) => (
            <Stat
              key={index}
              label={stat.strStat ?? "Estatistica"}
              value={(stat.intHome ?? "-") + " x " + (stat.intAway ?? "-")}
            />
          ))}
        </div>
      )}
      {recent.isFetching ? <Notice>Consultando resultados anteriores...</Notice> : null}
      {recent.data?.partial ? (
        <Notice>Parte dos resultados anteriores nao respondeu.</Notice>
      ) : null}
      {recent.data?.events.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Resultados anteriores</h4>
          {[
            ...new Map(
              recent.data.events
                .filter((item) => item.date < saoPauloDate(event.commenceTime))
                .map((item) => [item.eventId, item])
            ).values()
          ]
            .slice(0, 10)
            .map((item) => (
              <p className="text-sm text-slate-300" key={item.eventId}>
                {item.date} · {item.homeTeam} {item.homeScore ?? "-"} x {item.awayScore ?? "-"}{" "}
                {item.awayTeam}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function MarketPage({ mode }: { mode: "home" | "live" | "top" | "accumulator" }) {
  const market = useMarketData();
  const titles = {
    home: "MY FLUX",
    live: "Jogos e odds",
    top: "Top 5 do periodo",
    accumulator: "Criador de combinadas"
  };
  return (
    <Frame title={titles[mode]}>
      <MarketControls market={market} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Jogos no periodo"
          value={market.query.isPending ? "Consultando" : market.events.length}
        />
        <Stat
          label="Com odds recentes"
          value={market.query.isPending ? "Consultando" : market.candidates.length}
        />
        <Stat label="Mercado" value="1X2 pre-jogo" />
        <Stat
          label="Data selecionada"
          value={market.scope.date + (market.scope.upcoming ? " + 6 dias" : "")}
        />
      </div>
      <Notice>
        Ranking por probabilidade implicita media das casas, retirando a margem de cada mercado. Nao
        mede valor esperado nem garante acerto. Nao ha aposta perfeita ou segura; multiplas ampliam
        o risco.
      </Notice>
      {mode !== "accumulator" ? (
        <Section
          title={
            mode === "home"
              ? "Sugestao de mercado do periodo"
              : "Selecoes por probabilidade de mercado"
          }
        >
          <CandidateList
            candidates={market.candidates.slice(0, mode === "home" ? 1 : mode === "top" ? 5 : 50)}
            market={market}
          />
          {mode === "home" ? (
            <Link className={linkClass + " mt-4"} to="/top-5">
              Ver ranking <ArrowUpRight size={16} />
            </Link>
          ) : null}
          {mode === "live" && market.candidates.length > 50 ? (
            <Notice>
              Exibindo os primeiros 50 candidatos. Restrinja a liga para consultar os demais.
            </Notice>
          ) : null}
        </Section>
      ) : null}
      {mode !== "top" ? <AccumulatorPanel market={market} /> : null}
    </Frame>
  );
}
