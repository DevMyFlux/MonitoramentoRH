import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerBettingRoutes } from "./odds-routes.js";
import { HttpError } from "../../lib/http-error.js";

const originalKey = process.env.THE_ODDS_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.THE_ODDS_API_KEY;
  else process.env.THE_ODDS_API_KEY = originalKey;
  vi.restoreAllMocks();
});
async function app() {
  const instance = Fastify();
  instance.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ code: error.code });
    if (error instanceof ZodError) return reply.code(400).send({ code: "VALIDATION_ERROR" });
    return reply.code(500).send({ code: "INTERNAL_ERROR" });
  });
  await instance.register(registerBettingRoutes);
  return instance;
}
const event = {
  away_team: "Test Away",
  home_team: "Test Home",
  id: "test-1",
  sport_key: "soccer_test",
  sport_title: "Test",
  commence_time: "2026-09-08T23:00:00Z",
  bookmakers: [
    {
      key: "test",
      title: "Test",
      last_update: "2026-09-08T17:00:00Z",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Test Home", price: 2 },
            { name: "Test Away", price: 4 },
            { name: "Draw", price: 3 }
          ]
        }
      ]
    }
  ]
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "x-requests-remaining": "99" } });
describe("odds gateway", () => {
  it("fails before fetching without credentials", async () => {
    delete process.env.THE_ODDS_API_KEY;
    const fetcher = vi.spyOn(globalThis, "fetch");
    const server = await app();
    const result = await server.inject("/betting/odds/upcoming");
    expect(result.statusCode).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    await server.close();
  });
  it("normalizes all records, keeps timestamps and never returns the key", async () => {
    process.env.THE_ODDS_API_KEY = "test-secret";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      reply(
        Array.from({ length: 25 }, (_, i) => ({
          ...event,
          id: String(i),
          bookmakers: Array.from({ length: 8 }, (_, b) => ({
            ...event.bookmakers[0],
            key: String(b)
          }))
        }))
      )
    );
    const server = await app();
    const result = await server.inject("/betting/odds/upcoming?sport=soccer_test");
    expect(result.statusCode).toBe(200);
    expect(result.json().data).toHaveLength(25);
    expect(result.json().data[0].bookmakers).toHaveLength(8);
    expect(result.json().data[0].bookmakers[0].lastUpdate).toBe("2026-09-08T17:00:00Z");
    expect(result.body).not.toContain("test-secret");
    await server.close();
  });
  it("caches and coalesces concurrent requests", async () => {
    process.env.THE_ODDS_API_KEY = "test-secret";
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => reply([event]));
    const server = await app();
    const [a, b] = await Promise.all([
      server.inject("/betting/odds/upcoming?sport=soccer_test"),
      server.inject("/betting/odds/upcoming?sport=soccer_test")
    ]);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    await server.inject("/betting/odds/upcoming?sport=soccer_test");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await server.close();
  });
  it("passes Sao Paulo day boundaries and preserves partial coverage", async () => {
    process.env.THE_ODDS_API_KEY = "test-secret";
    const urls: URL[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      if (url.pathname === "/v4/sports/")
        return reply([
          {
            key: "soccer_test",
            title: "Test",
            active: true,
            group: "Soccer",
            has_outrights: false
          },
          {
            key: "soccer_other",
            title: "Other",
            active: true,
            group: "Soccer",
            has_outrights: false
          }
        ]);
      return url.pathname.includes("soccer_other") ? reply({}, 500) : reply([event]);
    });
    const server = await app();
    const result = await server.inject("/betting/odds/upcoming?sport=soccer_all&date=2026-09-08");
    expect(result.statusCode).toBe(200);
    expect(result.json().meta).toMatchObject({
      partial: true,
      requestedLeagues: 2,
      successfulLeagues: 1
    });
    expect(urls[1]!.searchParams.get("commenceTimeFrom")).toBe("2026-09-08T03:00:00Z");
    expect(urls[1]!.searchParams.get("commenceTimeTo")).toBe("2026-09-09T02:59:59Z");
    await server.close();
  });
  it.each([401, 403, 429, 500])("reports provider error %s without credentials", async (status) => {
    process.env.THE_ODDS_API_KEY = "test-secret";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => reply({}, status));
    const server = await app();
    const result = await server.inject("/betting/odds/upcoming?sport=soccer_test");
    expect(result.statusCode).toBe(502);
    expect(result.body).not.toContain("test-secret");
    await server.close();
  });
  it("rejects malformed payloads, traversal and non-decimal formats", async () => {
    process.env.THE_ODDS_API_KEY = "test-secret";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => reply({ broken: true }));
    const server = await app();
    expect((await server.inject("/betting/odds/upcoming?sport=soccer_test")).statusCode).toBe(502);
    expect((await server.inject("/betting/odds/upcoming?sport=..%2Ftest")).statusCode).toBe(400);
    expect(
      (await server.inject("/betting/odds/upcoming?sport=soccer_test&oddsFormat=american"))
        .statusCode
    ).toBe(400);
    await server.close();
  });
});
