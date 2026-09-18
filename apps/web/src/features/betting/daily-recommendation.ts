import type { OddsBookmaker, OddsEvent } from "./odds-api-client";
import type { SportsDbEvent } from "../sports-data/the-sports-db-provider";
import { localStart, saoPauloDate } from "./dates";

export const MAX_ODDS_AGE_MS = 15 * 60_000;
export type BestOdd = {
  bookmaker: string;
  bookmakerKey: string;
  name: string;
  price: number;
  lastUpdate: string;
};
export type MarketCandidate = {
  consensusProbability: number;
  event: OddsEvent;
  localStart: string;
  outcome: BestOdd;
  sources: number;
};
export type DailyRecommendation = Omit<MarketCandidate, "event"> & {
  event: SportsDbEvent;
  oddsEvent: OddsEvent;
};
export type AccumulatorSuggestion = {
  combinedOdd: number;
  combinedProbability: number;
  legs: Array<{ outcome: BestOdd; probability: number; event: OddsEvent }>;
};
export type MarketScope = { date?: string; upcoming?: boolean; afterHour?: number };

export function inScope(event: OddsEvent, now: Date, scope: MarketScope = {}) {
  const start = Date.parse(event.commenceTime);
  const date = scope.date ?? saoPauloDate(now);
  const cutoff = Date.parse(
    saoPauloDate(event.commenceTime) +
      "T" +
      String(scope.afterHour ?? 0).padStart(2, "0") +
      ":00:00-03:00"
  );
  return (
    event.sportKey.startsWith("soccer_") &&
    Number.isFinite(start) &&
    start > now.getTime() &&
    start >= cutoff &&
    start >= Date.parse(date + "T00:00:00-03:00") &&
    (scope.upcoming
      ? start < Date.parse(date + "T00:00:00-03:00") + 7 * 86400_000
      : saoPauloDate(event.commenceTime) === date)
  );
}

function validMarket(event: OddsEvent, book: OddsBookmaker, now: Date) {
  const age = now.getTime() - Date.parse(book.lastUpdate);
  if (!Number.isFinite(age) || age < -60_000 || age > MAX_ODDS_AGE_MS) return null;
  const outcomes = book.markets.find((market) => market.key === "h2h")?.outcomes;
  const expected = [event.homeTeam, event.awayTeam, "Draw"];
  if (
    !outcomes ||
    outcomes.length !== 3 ||
    !expected.every(
      (name) =>
        outcomes.filter(
          (outcome) => outcome.name === name && Number.isFinite(outcome.price) && outcome.price > 1
        ).length === 1
    )
  )
    return null;
  return outcomes;
}

export function getBestOdds(event: OddsEvent, now = new Date()): BestOdd[] {
  const best = new Map<string, BestOdd>();
  for (const book of event.bookmakers) {
    for (const outcome of validMarket(event, book, now) ?? []) {
      if (outcome.price > (best.get(outcome.name)?.price ?? 0)) {
        best.set(outcome.name, {
          ...outcome,
          bookmaker: book.title,
          bookmakerKey: book.key,
          lastUpdate: book.lastUpdate
        });
      }
    }
  }
  return [...best.values()];
}

function consensus(event: OddsEvent, now: Date) {
  const probabilities = new Map<string, number[]>();
  for (const book of event.bookmakers) {
    const outcomes = validMarket(event, book, now);
    if (!outcomes) continue;
    const total = outcomes.reduce((sum, outcome) => sum + 1 / outcome.price, 0);
    for (const outcome of outcomes) {
      const values = probabilities.get(outcome.name) ?? [];
      values.push(1 / outcome.price / total);
      probabilities.set(outcome.name, values);
    }
  }
  return [...probabilities]
    .map(([name, values]) => ({
      name,
      probability: values.reduce((a, b) => a + b, 0) / values.length,
      sources: values.length
    }))
    .sort((a, b) => b.probability - a.probability || a.name.localeCompare(b.name));
}

export function buildTopMarketCandidates(
  events: OddsEvent[],
  limit = 5,
  now = new Date(),
  scope: MarketScope = {}
): MarketCandidate[] {
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .filter((event) => inScope(event, now, scope))
    .flatMap((event) => {
      const favorite = consensus(event, now)[0];
      const outcome = getBestOdds(event, now).find((item) => item.name === favorite?.name);
      return favorite && outcome
        ? [
            {
              event,
              outcome,
              consensusProbability: favorite.probability,
              sources: favorite.sources,
              localStart: localStart(event.commenceTime)
            }
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.consensusProbability - a.consensusProbability ||
        a.event.commenceTime.localeCompare(b.event.commenceTime)
    )
    .slice(0, limit);
}

export function findOddsForEvent(event: SportsDbEvent, oddsEvents: OddsEvent[]) {
  return oddsEvents.find(
    (odds) =>
      normalizeTeamName(event.homeTeam) === normalizeTeamName(odds.homeTeam) &&
      normalizeTeamName(event.awayTeam) === normalizeTeamName(odds.awayTeam) &&
      (event.timestamp ? saoPauloDate(event.timestamp) : event.date) ===
        saoPauloDate(odds.commenceTime)
  );
}

export function buildDailyRecommendation(
  events: SportsDbEvent[],
  oddsEvents: OddsEvent[],
  selectedDate: string,
  now = new Date()
): DailyRecommendation | null {
  for (const candidate of buildTopMarketCandidates(oddsEvents, oddsEvents.length, now, {
    date: selectedDate
  })) {
    const fixture = events.find((event) => findOddsForEvent(event, [candidate.event]));
    if (fixture && /^(FT|AET|PEN|POSTPONED|CANCELLED|ABD|MATCH FINISHED)$/i.test(fixture.status))
      continue;
    return {
      ...candidate,
      oddsEvent: candidate.event,
      event: fixture ?? {
        eventId: candidate.event.id,
        homeTeam: candidate.event.homeTeam,
        awayTeam: candidate.event.awayTeam,
        league: candidate.event.sportTitle,
        date: selectedDate,
        timestamp: candidate.event.commenceTime,
        status: "NS"
      }
    };
  }
  return null;
}

export function buildAccumulatorSuggestion(
  events: OddsEvent[],
  targetOdd: number,
  now = new Date(),
  scope: MarketScope = {}
): AccumulatorSuggestion | null {
  if (!Number.isFinite(targetOdd) || targetOdd < 2 || targetOdd > 100) return null;
  const candidates = buildTopMarketCandidates(events, 24, now, scope);
  const books = [
    ...new Set(candidates.flatMap((item) => item.event.bookmakers.map((book) => book.key)))
  ].sort();
  let best: AccumulatorSuggestion | null = null;
  // Bounded search: 2-6 distinct fixtures, one bookmaker, within 15% of the target.
  for (const key of books) {
    if (key.includes("_ex_") || key === "matchbook") continue;
    const legs = candidates
      .flatMap((candidate) => {
        const book = candidate.event.bookmakers.find((item) => item.key === key);
        const odd =
          book &&
          validMarket(candidate.event, book, now)?.find(
            (item) => item.name === candidate.outcome.name
          );
        return book && odd
          ? [
              {
                event: candidate.event,
                probability: candidate.consensusProbability,
                outcome: {
                  ...odd,
                  bookmaker: book.title,
                  bookmakerKey: key,
                  lastUpdate: book.lastUpdate
                }
              }
            ]
          : [];
      })
      .slice(0, 18);
    const visit = (
      index: number,
      selected: AccumulatorSuggestion["legs"],
      teams: Set<string>,
      odd: number,
      probability: number
    ) => {
      if (selected.length >= 2 && odd >= targetOdd * 0.85 && odd <= targetOdd * 1.15) {
        const distance = Math.abs(odd - targetOdd);
        if (
          !best ||
          distance < Math.abs(best.combinedOdd - targetOdd) - 0.001 ||
          (Math.abs(distance - Math.abs(best.combinedOdd - targetOdd)) < 0.001 &&
            probability > best.combinedProbability)
        ) {
          best = { legs: [...selected].sort((a, b) => a.event.commenceTime.localeCompare(b.event.commenceTime)), combinedOdd: odd, combinedProbability: probability };
        }
      }
      if (selected.length === 6 || odd > targetOdd * 1.15) return;
      for (let i = index; i < legs.length; i++) {
        const leg = legs[i]!;
        const names = [
          normalizeTeamName(leg.event.homeTeam),
          normalizeTeamName(leg.event.awayTeam)
        ];
        if (names.some((name) => teams.has(name))) continue;
        visit(
          i + 1,
          [...selected, leg],
          new Set([...teams, ...names]),
          odd * leg.outcome.price,
          probability * leg.probability
        );
      }
    };
    visit(0, [], new Set(), 1, 1);
  }
  return best;
}

function normalizeTeamName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
