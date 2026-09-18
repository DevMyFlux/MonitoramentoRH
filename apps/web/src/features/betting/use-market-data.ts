import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "../../services/api-client";
import { fetchUpcomingOdds } from "./odds-api-client";
import { buildTopMarketCandidates, inScope } from "./daily-recommendation";
import { saoPauloDate } from "./dates";
import { usePreferences } from "./preferences";

export function useMarketData() {
  const preferences = usePreferences();
  const [params, setParams] = useSearchParams();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const dateParam = params.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && Number.isFinite(Date.parse(dateParam))
      ? dateParam
      : saoPauloDate(now);
  const upcoming = params.get("scope") === "week";
  const hour = Number(params.get("after") ?? 0);
  const afterHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0;
  const scope = { date, upcoming, afterHour };
  const bookmaker = params.get("book") ?? "";
  const sports = useQuery({
    queryKey: ["odds-sports"],
    queryFn: () => apiGet<{ data: Array<{ key: string; title: string }> }>("/betting/sports"),
    staleTime: 3600_000,
    retry: false
  });
  const query = useQuery({
    queryKey: ["betflux-odds", preferences.region, preferences.sport, date, upcoming],
    queryFn: () => fetchUpcomingOdds(preferences.region, preferences.sport, date, upcoming),
    retry: false,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    refetchInterval: preferences.autoRefresh ? 300_000 : false
  });
  const rawData = query.isError ? [] : (query.data?.data ?? []);
  const bookmakers = [
    ...new Map(
      rawData.flatMap((event) => event.bookmakers.map((book) => [book.key, book.title] as const))
    ).entries()
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const data = bookmaker
    ? rawData.map((event) => ({
        ...event,
        bookmakers: event.bookmakers.filter((book) => book.key === bookmaker)
      }))
    : rawData;
  const events = data.filter((event) => inScope(event, now, scope));
  const candidates = buildTopMarketCandidates(data, data.length, now, scope);
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  return {
    preferences,
    query,
    sports,
    now,
    scope,
    events,
    candidates,
    updateFilter,
    bookmaker,
    bookmakers
  };
}

export type MarketData = ReturnType<typeof useMarketData>;

export function oddsError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("ODDS_PROVIDER_NOT_CONFIGURED"))
    return "Chave de odds ausente no servidor. Nenhuma cotacao foi carregada.";
  if (message.includes("ODDS_KEY_REJECTED"))
    return "A chave foi recusada pelo provedor. Verifique sua validade e os creditos.";
  if (message.includes("ODDS_QUOTA_EXCEEDED"))
    return "Limite temporario de consultas. Aguarde alguns segundos e tente atualizar.";
  if (message.includes("ODDS_INVALID_DATA"))
    return "O provedor retornou dados invalidos. Nenhuma sugestao foi gerada.";
  return "Nao foi possivel consultar as odds. Verifique a conexao e tente atualizar; os dados antigos nao serao usados para sugerir bilhetes.";
}
