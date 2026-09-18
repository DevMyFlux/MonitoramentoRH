import { z } from "zod";
import { saoPauloDate } from "../betting/dates";

export type SportsDbEvent = {
  awayBadge?: string | undefined; awayScore?: string | null | undefined; awayTeam: string; awayTeamId?: string | undefined;
  country?: string | undefined; date: string; eventId: string; homeBadge?: string | undefined;
  homeScore?: string | null | undefined; homeTeam: string; homeTeamId?: string | undefined;
  league: string; localTime?: string | undefined; round?: string | undefined; status: string;
  timestamp?: string | undefined; venue?: string | undefined;
};
const optionalText = z.string().nullish().transform((value) => value ?? undefined);
const score = z.union([z.string(), z.number()]).nullish().transform((value) => value == null ? null : String(value));
const eventSchema = z.object({
  idEvent: z.string(), strHomeTeam: z.string(), strAwayTeam: z.string(),
  idHomeTeam: optionalText, idAwayTeam: optionalText, strLeague: optionalText,
  intHomeScore: score, intAwayScore: score, strStatus: optionalText, dateEvent: optionalText,
  strTimeLocal: optionalText, strTimestamp: optionalText, strVenue: optionalText, strCountry: optionalText,
  intRound: score, strHomeTeamBadge: optionalText, strAwayTeamBadge: optionalText
});
const statsSchema = z.object({ eventstats: z.array(z.object({
  intAway: score, intHome: score, strStat: optionalText
})).nullish() });
const baseUrl = "https://www.thesportsdb.com/api/v1/json/123";

async function request(path: string): Promise<unknown> {
  const response = await fetch(baseUrl + path, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Nao foi possivel consultar TheSportsDB.");
  return response.json();
}
export async function fetchSoccerEventsByDate(date: string) {
  const payload = z.object({ events: z.array(eventSchema).nullish() }).parse(await request("/eventsday.php?d=" + encodeURIComponent(date) + "&s=Soccer"));
  return (payload.events ?? []).map(normalizeEvent);
}
export async function fetchEventStats(eventId: string) {
  return statsSchema.parse(await request("/lookupeventstats.php?id=" + encodeURIComponent(eventId))).eventstats ?? [];
}
export async function fetchRecentResults(teamId: string) {
  const payload = z.object({ results: z.array(eventSchema).nullish() }).parse(await request("/eventslast.php?id=" + encodeURIComponent(teamId)));
  return (payload.results ?? []).map(normalizeEvent);
}
export function getDefaultBetFluxDate() { return saoPauloDate(); }

function normalizeEvent(event: z.infer<typeof eventSchema>): SportsDbEvent {
  return {
    awayBadge: event.strAwayTeamBadge, awayScore: event.intAwayScore, awayTeam: event.strAwayTeam,
    awayTeamId: event.idAwayTeam, country: event.strCountry, date: event.dateEvent ?? "", eventId: event.idEvent,
    homeBadge: event.strHomeTeamBadge, homeScore: event.intHomeScore, homeTeam: event.strHomeTeam,
    homeTeamId: event.idHomeTeam, league: event.strLeague ?? "Competicao nao informada", localTime: event.strTimeLocal,
    round: event.intRound ?? undefined, status: event.strStatus ?? "UNKNOWN", timestamp: event.strTimestamp, venue: event.strVenue
  };
}
