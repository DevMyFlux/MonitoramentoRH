import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPaperBets,
  saveAccumulatorAsPaperBet,
  savePaperBets,
  calculatePaperBetPnl
} from "./paper-betting-store";
import type { AccumulatorSuggestion } from "./daily-recommendation";
import { savePreferences } from "./preferences";

const now = new Date("2026-09-08T18:00:00Z");
let storage: Map<string, string>;
const suggestion: AccumulatorSuggestion = {
  combinedOdd: 2,
  combinedProbability: 0.5,
  legs: [
    {
      outcome: {
        name: "Test home",
        price: 2,
        bookmaker: "Test book",
        bookmakerKey: "test",
        lastUpdate: now.toISOString()
      },
      probability: 0.5,
      event: {
        id: "test-event",
        homeTeam: "Test home",
        awayTeam: "Test away",
        commenceTime: "2026-09-08T23:00:00Z",
        bookmakers: [],
        sportKey: "soccer_test",
        sportTitle: "Test"
      }
    }
  ]
};
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    },
    dispatchEvent: () => true
  });
  savePreferences({ bankroll: 1000, dailyBudget: 50, paperStake: 10 });
});
afterEach(() => vi.unstubAllGlobals());
describe("paper betting", () => {
  it("ignores malformed storage without crashing", () => {
    storage.set("betflux.paper-bets.v1", '[null,{"id":"broken"}]');
    expect(loadPaperBets()).toEqual([]);
    storage.set("betflux.paper-bets.v1", "{broken");
    expect(loadPaperBets()).toEqual([]);
  });
  it("saves exact snapshot once, and includes bookmaker and selection in deduplication", () => {
    expect(saveAccumulatorAsPaperBet(suggestion, now)).toBe(true);
    expect(saveAccumulatorAsPaperBet(suggestion, now)).toBe(false);
    const changed = structuredClone(suggestion);
    changed.legs[0]!.outcome.bookmaker = "Other book";
    expect(saveAccumulatorAsPaperBet(changed, now)).toBe(true);
    expect(loadPaperBets()).toHaveLength(2);
    expect(loadPaperBets()[0]!.stakeCents).toBe(1000);
  });
  it("enforces virtual daily limits and expired quotes", () => {
    savePreferences({ dailyBudget: 0 });
    expect(() => saveAccumulatorAsPaperBet(suggestion, now)).toThrow(/Limite/);
    expect(() => saveAccumulatorAsPaperBet(suggestion, new Date("2026-09-08T18:16:00Z"))).toThrow(
      /vencida/
    );
  });
  it("preserves settlement and correct P&L, including void", () => {
    saveAccumulatorAsPaperBet(suggestion, now);
    const bet = loadPaperBets()[0]!;
    expect(calculatePaperBetPnl({ ...bet, status: "won" })).toBe(1000);
    expect(calculatePaperBetPnl({ ...bet, status: "lost" })).toBe(-1000);
    expect(calculatePaperBetPnl({ ...bet, status: "void" })).toBe(0);
    savePaperBets([{ ...bet, status: "won", settledAt: now.toISOString() }]);
    expect(loadPaperBets()[0]!.status).toBe("won");
  });
});
