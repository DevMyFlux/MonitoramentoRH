import { apiGet } from "../../services/api-client";

export type OddsOutcome = {
  name: string;
  price: number;
};

export type OddsBookmaker = {
  key: string;
  lastUpdate: string;
  markets: Array<{
    key: string;
    outcomes: OddsOutcome[];
  }>;
  title: string;
};

export type OddsEvent = {
  awayTeam: string;
  bookmakers: OddsBookmaker[];
  commenceTime: string;
  homeTeam: string;
  id: string;
  sportKey: string;
  sportTitle: string;
};

export type OddsResponse = {
  data: OddsEvent[];
  meta: {
    fetchedAt: string;
    source: string;
    remaining: number | null;
    requestedLeagues: number;
    successfulLeagues: number;
    partial: boolean;
    failures: Array<{ sport: string; code: string }>;
  };
};

export function fetchUpcomingOdds(
  region: "us" | "uk" | "eu" | "au",
  sport = "soccer_all",
  date?: string,
  upcoming = false
) {
  return apiGet<OddsResponse>(
    `/betting/odds/upcoming?regions=${region}&sport=${encodeURIComponent(sport)}&markets=h2h&oddsFormat=decimal${date ? `&date=${date}&upcoming=${upcoming}` : ""}`
  );
}
