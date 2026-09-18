import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEventStats, fetchSoccerEventsByDate } from "./the-sports-db-provider";

afterEach(() => vi.restoreAllMocks());
describe("TheSportsDB missing data", () => {
  it("handles eventstats null without inventing statistics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ eventstats: null })));
    expect(await fetchEventStats("test-id")).toEqual([]);
  });
  it("rejects malformed statistics before they reach the UI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ eventstats: "invalid" })));
    await expect(fetchEventStats("test-id")).rejects.toThrow();
  });
  it("normalizes numeric scores and nullable metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ events: [{ idEvent: "test", strHomeTeam: "Home", strAwayTeam: "Away", intHomeScore: 2, intAwayScore: 0, strLeague: null }] })));
    expect((await fetchSoccerEventsByDate("2026-09-08"))[0]).toMatchObject({ homeScore: "2", awayScore: "0" });
  });
});
