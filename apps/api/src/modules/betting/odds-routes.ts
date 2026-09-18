import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";

const querySchema = z.object({
  markets: z.literal("h2h").default("h2h"),
  oddsFormat: z.literal("decimal").default("decimal"),
  regions: z.enum(["us", "uk", "eu", "au"]).default("eu"),
  sport: z
    .string()
    .regex(/^(soccer_[a-z0-9_]+|upcoming)$/)
    .default("soccer_all"),
  date: z.iso.date().optional(),
  upcoming: z.enum(["true", "false"]).default("false")
});
const sportsSchema = z.array(
  z.object({
    key: z.string(),
    title: z.string(),
    group: z.string(),
    active: z.boolean(),
    has_outrights: z.boolean()
  })
);
const eventSchema = z.array(
  z.object({
    id: z.string(),
    home_team: z.string(),
    away_team: z.string(),
    sport_key: z.string(),
    sport_title: z.string(),
    commence_time: z.iso.datetime({ offset: true }),
    bookmakers: z.array(
      z.object({
        key: z.string(),
        title: z.string(),
        last_update: z.iso.datetime({ offset: true }),
        markets: z.array(
          z.object({
            key: z.string(),
            outcomes: z.array(z.object({ name: z.string(), price: z.number().finite() }))
          })
        )
      })
    )
  })
);
type ProviderResult = { payload: unknown; remaining: string | null; fetchedAt: string };

export async function registerBettingRoutes(app: FastifyInstance): Promise<void> {
  const cache = new Map<string, { expires: number; result: ProviderResult }>();
  const pending = new Map<string, Promise<ProviderResult>>();
  const apiKey = () => {
    const key = process.env.THE_ODDS_API_KEY?.trim();
    if (!key || /your|sua|placeholder/i.test(key)) {
      throw new HttpError(
        503,
        "ODDS_PROVIDER_NOT_CONFIGURED",
        "Chave de odds nao configurada no servidor."
      );
    }
    return key;
  };
  const requestProvider = (
    path: string,
    params: Record<string, string> = {},
    ttl = 120_000
  ): Promise<ProviderResult> => {
    const key = path + JSON.stringify(params);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.result);
    const running = pending.get(key);
    if (running) return running;
    const request = (async () => {
      const url = new URL("https://api.the-odds-api.com/v4/" + path);
      url.searchParams.set("apiKey", apiKey());
      Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
      try {
        let response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (response.status === 429) {
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        }
        if (!response.ok) {
          const [code, message] =
            response.status === 401 || response.status === 403
              ? ["ODDS_KEY_REJECTED", "A chave de odds foi recusada ou esta sem creditos."]
              : response.status === 429
                ? [
                    "ODDS_QUOTA_EXCEEDED",
                    "Limite temporario de consultas. Aguarde alguns segundos e tente novamente."
                  ]
                : ["ODDS_PROVIDER_ERROR", "O provedor nao conseguiu atender a consulta."];
          throw new HttpError(502, code!, message!);
        }
        const result = {
          payload: (await response.json()) as unknown,
          remaining: response.headers.get("x-requests-remaining"),
          fetchedAt: new Date().toISOString()
        };
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + ttl, result });
        return result;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          502,
          "ODDS_PROVIDER_UNAVAILABLE",
          "O provedor de odds nao respondeu. Tente novamente."
        );
      }
    })().finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
  const sports = async () => {
    const result = await requestProvider("sports/", {}, 3600_000);
    const parsed = sportsSchema.safeParse(result.payload);
    if (!parsed.success)
      throw new HttpError(502, "ODDS_INVALID_DATA", "Catalogo de ligas invalido.");
    return parsed.data.filter(
      (sport) => sport.active && sport.key.startsWith("soccer_") && !sport.has_outrights
    );
  };

  app.get("/betting/status", async () => ({
    data: {
      oddsConfigured: Boolean(process.env.THE_ODDS_API_KEY?.trim()),
      cacheEntries: cache.size,
      pendingRequests: pending.size,
      serverTime: new Date().toISOString(),
      automaticBetting: false
    }
  }));
  app.get("/betting/sports", async () => ({
    data: (await sports()).map(({ key, title }) => ({ key, title }))
  }));

  app.get("/betting/odds/upcoming", async (request, reply) => {
    apiKey();
    const query = querySchema.parse(request.query);
    const params: Record<string, string> = {
      regions: query.regions,
      markets: "h2h",
      oddsFormat: "decimal"
    };
    if (query.date) {
      const from = new Date(query.date + "T00:00:00-03:00");
      params.commenceTimeFrom = from.toISOString().replace(".000Z", "Z");
      params.commenceTimeTo = new Date(
        from.getTime() + (query.upcoming === "true" ? 7 : 1) * 86400_000 - 1000
      )
        .toISOString()
        .replace(".000Z", "Z");
    }
    const keys =
      query.sport === "soccer_all" ? (await sports()).map((sport) => sport.key) : [query.sport];
    const results: Array<{ sport: string; result: ProviderResult }> = [];
    const failures: Array<{ sport: string; code: string }> = [];
    let firstError: unknown;
    let index = 0;
    let fatal = false;
    const deadline = Date.now() + 40_000;
    const worker = async () => {
      while (index < keys.length) {
        const sport = keys[index++]!;
        if (fatal || Date.now() > deadline) {
          failures.push({ sport, code: "ODDS_QUERY_INTERRUPTED" });
          continue;
        }
        try {
          results.push({
            sport,
            result: await requestProvider("sports/" + sport + "/odds/", params)
          });
        } catch (error) {
          firstError ??= error;
          const code = error instanceof HttpError ? error.code : "ODDS_PROVIDER_ERROR";
          if (code === "ODDS_KEY_REJECTED" || code === "ODDS_QUOTA_EXCEEDED") fatal = true;
          failures.push({ sport, code });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, keys.length) }, worker));
    if (!results.length && firstError) throw firstError;
    const events = results.flatMap(({ sport, result }) => {
      const parsed = eventSchema.safeParse(result.payload);
      if (!parsed.success) {
        failures.push({ sport, code: "ODDS_INVALID_DATA" });
        return [];
      }
      return parsed.data;
    });
    if (results.length && failures.length === keys.length) {
      throw new HttpError(
        502,
        "ODDS_INVALID_DATA",
        "O provedor retornou dados incompletos ou invalidos."
      );
    }
    const quota = results.map(({ result }) => result.remaining).filter((value) => value !== null);
    const remaining = quota.length ? Math.min(...quota.map(Number)) : null;
    reply.header("X-Odds-Requests-Remaining", remaining ?? "");
    return {
      data: [...new Map(events.map((event) => [event.id, event])).values()].map((event) => ({
        awayTeam: event.away_team,
        homeTeam: event.home_team,
        id: event.id,
        sportKey: event.sport_key,
        sportTitle: event.sport_title,
        commenceTime: event.commence_time,
        bookmakers: event.bookmakers.map((book) => ({
          key: book.key,
          title: book.title,
          lastUpdate: book.last_update,
          markets: book.markets.map((market) => ({ key: market.key, outcomes: market.outcomes }))
        }))
      })),
      meta: {
        fetchedAt:
          results.map(({ result }) => result.fetchedAt).sort()[0] ?? new Date().toISOString(),
        source: "The Odds API",
        remaining,
        requestedLeagues: keys.length,
        successfulLeagues: keys.length - failures.length,
        failures,
        partial: failures.length > 0
      }
    };
  });
}
