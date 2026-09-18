import { describe, expect, it } from "vitest";
import {
  buildDailyRecommendation,
  buildAccumulatorSuggestion,
  buildTopMarketCandidates,
  findOddsForEvent,
  getBestOdds,
  inScope
} from "./daily-recommendation";
import { saoPauloDate } from "./dates";
import type { OddsEvent } from "./odds-api-client";

const now = new Date("2026-09-08T18:00:00Z");
function event(id: string, price = 2, start = "2026-09-08T23:00:00Z"): OddsEvent {
  return {
    id,
    homeTeam: "Home " + id,
    awayTeam: "Away " + id,
    commenceTime: start,
    sportKey: "soccer_test",
    sportTitle: "Test league",
    bookmakers: [
      {
        key: "test",
        title: "Test book",
        lastUpdate: now.toISOString(),
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Home " + id, price },
              { name: "Away " + id, price: 4 },
              { name: "Draw", price: 3.5 }
            ]
          }
        ]
      }
    ]
  };
}
describe("calendar and valid market", () => {
  it("rolls over at Sao Paulo midnight, not UTC midnight", () => {
    expect(saoPauloDate("2026-09-09T02:59:59Z")).toBe("2026-09-08");
    expect(saoPauloDate("2026-09-09T03:00:00Z")).toBe("2026-09-09");
  });
  it("excludes already started and other dates unless week is explicit", () => {
    expect(inScope(event("1", 2, now.toISOString()), now)).toBe(false);
    const tomorrow = event("2", 2, "2026-09-09T23:00:00Z");
    expect(inScope(tomorrow, now)).toBe(false);
    expect(inScope(tomorrow, now, { upcoming: true })).toBe(true);
    expect(inScope(event("3", 2, "2026-09-20T23:00:00Z"), now, { upcoming: true })).toBe(false);
  });
  it("honors 18h Sao Paulo inclusive", () => {
    expect(inScope(event("1", 2, "2026-09-08T20:59:00Z"), now, { afterHour: 18 })).toBe(false);
    expect(inScope(event("2", 2, "2026-09-08T21:00:00Z"), now, { afterHour: 18 })).toBe(true);
  });
  it("rejects stale, malformed and future bookmaker timestamps", () => {
    for (const lastUpdate of ["2026-09-08T17:44:59Z", "invalid", "2026-09-08T19:00:00Z"]) {
      const row = event("1");
      row.bookmakers[0]!.lastUpdate = lastUpdate;
      expect(getBestOdds(row, now)).toEqual([]);
    }
  });
  it("requires complete 1X2 and never falls back to another market", () => {
    const row = event("1");
    row.bookmakers[0]!.markets[0]!.key = "totals";
    expect(getBestOdds(row, now)).toEqual([]);
    row.bookmakers[0]!.markets[0]!.key = "h2h";
    row.bookmakers[0]!.markets[0]!.outcomes.pop();
    expect(getBestOdds(row, now)).toEqual([]);
  });
  it.each([0, 1, -2, NaN, Infinity])("rejects invalid decimal price %s", (price) => {
    expect(getBestOdds(event("1", price), now)).toEqual([]);
  });
  it("can suggest from an odds event when TheSportsDB has no fixture", () => {
    const result = buildDailyRecommendation([], [event("1")], "2026-09-08", now);
    expect(result?.outcome.name).toBe("Home 1");
    expect(result?.oddsEvent.id).toBe("1");
  });
  it("does not match repeated teams on another date or recommend a cancelled fixture", () => {
    const fixture = {
      eventId: "f",
      homeTeam: "Home 1",
      awayTeam: "Away 1",
      league: "Test",
      date: "2026-09-07",
      status: "FT"
    };
    expect(findOddsForEvent(fixture, [event("1")])).toBeUndefined();
    expect(
      buildDailyRecommendation(
        [{ ...fixture, date: "2026-09-08", status: "CANCELLED" }],
        [event("1")],
        "2026-09-08",
        now
      )
    ).toBeNull();
  });
  it("averages no-vig probabilities per book, then picks a price for the same favorite", () => {
    const row = event("1", 2);
    row.bookmakers.push({
      key: "other",
      title: "Other",
      lastUpdate: now.toISOString(),
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: row.homeTeam, price: 2.4 },
            { name: row.awayTeam, price: 3 },
            { name: "Draw", price: 3.2 }
          ]
        }
      ]
    });
    const result = buildTopMarketCandidates([row], 5, now)[0]!;
    expect(result.outcome.price).toBe(2.4);
    expect(result.sources).toBe(2);
    expect(result.consensusProbability).toBeCloseTo(
      (1 / 2 / (1 / 2 + 1 / 4 + 1 / 3.5) + 1 / 2.4 / (1 / 2.4 + 1 / 3 + 1 / 3.2)) / 2
    );
  });
});
describe("accumulator", () => {
  it("returns a bounded, same-book, multi-event ticket near target", () => {
    const result = buildAccumulatorSuggestion(
      [event("1", 2), event("2", 2), event("3", 1.75)],
      7,
      now
    )!;
    expect(result.combinedOdd).toBe(7);
    expect(result.legs).toHaveLength(3);
    expect(new Set(result.legs.map((leg) => leg.outcome.bookmakerKey)).size).toBe(1);
    expect(result.combinedProbability).toBeCloseTo(
      result.legs.reduce((p, leg) => p * leg.probability, 1)
    );
  });
  it("never fills today's ticket with tomorrow", () => {
    expect(
      buildAccumulatorSuggestion([event("1"), event("2", 2, "2026-09-09T23:00:00Z")], 4, now)
    ).toBeNull();
  });
  it("excludes duplicate events, repeated teams, single legs and extreme targets", () => {
    const one = event("1");
    const repeated = { ...event("2"), homeTeam: one.homeTeam };
    expect(buildAccumulatorSuggestion([one, one], 4, now)).toBeNull();
    expect(buildAccumulatorSuggestion([one, repeated], 4, now)).toBeNull();
    for (const target of [NaN, 0, 1, 101, Infinity])
      expect(buildAccumulatorSuggestion([one], target, now)).toBeNull();
    expect(buildAccumulatorSuggestion([one], 2, now)).toBeNull();
  });
  it("does not combine prices from different bookmakers", () => {
    const second = event("2");
    second.bookmakers[0]!.key = "other";
    expect(buildAccumulatorSuggestion([event("1"), second], 4, now)).toBeNull();
  });
});
