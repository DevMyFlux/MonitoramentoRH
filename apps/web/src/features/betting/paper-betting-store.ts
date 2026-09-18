import { z } from "zod";
import { getPreferences } from "./preferences";
import { saoPauloDate } from "./dates";
import { MAX_ODDS_AGE_MS, type AccumulatorSuggestion } from "./daily-recommendation";

const paperSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string(),
  label: z.string(),
  legs: z
    .array(
      z.object({
        bookmaker: z.string(),
        bookmakerKey: z.string().optional(),
        lastUpdate: z.iso.datetime({ offset: true }).optional(),
        probability: z.number().min(0).max(1).optional(),
        event: z.string(),
        eventId: z.string(),
        odd: z.number().finite().gt(1),
        selection: z.string(),
        start: z.iso.datetime({ offset: true })
      })
    )
    .min(1)
    .max(8),
  odd: z.number().finite().gt(1),
  stakeCents: z.number().int().positive(),
  status: z.enum(["open", "won", "lost", "void"]),
  settledAt: z.iso.datetime({ offset: true }).optional()
});
export type PaperBet = z.infer<typeof paperSchema>;
export type PaperBetStatus = PaperBet["status"];
const storageKey = "betflux.paper-bets.v1";

export function loadPaperBets(): PaperBet[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value)
      ? value.flatMap((row) => {
          const parsed = paperSchema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
}

export function savePaperBets(bets: PaperBet[]) {
  const validated = z.array(paperSchema).parse(bets);
  window.localStorage.setItem(storageKey, JSON.stringify(validated));
}

export function saveAccumulatorAsPaperBet(suggestion: AccumulatorSuggestion, now = new Date()) {
  const settings = getPreferences();
  const stakeCents = Math.round(settings.paperStake * 100);
  if (
    !suggestion.legs.length ||
    suggestion.legs.some(
      (leg) =>
        Date.parse(leg.event.commenceTime) <= now.getTime() ||
        !Number.isFinite(Date.parse(leg.outcome.lastUpdate)) ||
        now.getTime() - Date.parse(leg.outcome.lastUpdate) > MAX_ODDS_AGE_MS
    )
  ) {
    throw new Error("Cotacao vencida ou partida iniciada. Atualize antes de registrar.");
  }
  const bet: PaperBet = {
    createdAt: now.toISOString(),
    id: crypto.randomUUID(),
    label:
      suggestion.legs.length === 1 ? "Simples" : "Multipla de " + suggestion.legs.length + " jogos",
    legs: suggestion.legs.map((leg) => ({
      bookmaker: leg.outcome.bookmaker,
      bookmakerKey: leg.outcome.bookmakerKey,
      lastUpdate: leg.outcome.lastUpdate,
      probability: leg.probability,
      event: leg.event.homeTeam + " x " + leg.event.awayTeam,
      eventId: leg.event.id,
      odd: leg.outcome.price,
      selection: leg.outcome.name,
      start: leg.event.commenceTime
    })),
    odd: suggestion.legs.reduce((product, leg) => product * leg.outcome.price, 1),
    stakeCents,
    status: "open"
  };
  paperSchema.parse(bet);
  const current = loadPaperBets();
  const signature = (entry: PaperBet) =>
    entry.legs
      .map((leg) => JSON.stringify([leg.eventId, leg.bookmaker, leg.selection]))
      .sort()
      .join("|");
  if (current.some((entry) => signature(entry) === signature(bet))) return false;
  const dailyUsed = current
    .filter(
      (entry) => saoPauloDate(entry.createdAt) === saoPauloDate(now) && entry.status !== "void"
    )
    .reduce((total, entry) => total + entry.stakeCents, 0);
  const available =
    settings.bankroll * 100 +
    current.reduce((sum, entry) => sum + calculatePaperBetPnl(entry), 0) -
    current
      .filter((entry) => entry.status === "open")
      .reduce((sum, entry) => sum + entry.stakeCents, 0);
  if (stakeCents > available || dailyUsed + stakeCents > settings.dailyBudget * 100) {
    throw new Error(
      "Limite da banca virtual ou do orcamento diario atingido. Confira a tela Banca."
    );
  }
  savePaperBets([bet, ...current]);
  return true;
}

export function calculatePaperBetPnl(bet: PaperBet) {
  if (bet.status === "won") return Math.round(bet.stakeCents * (bet.odd - 1));
  if (bet.status === "lost") return -bet.stakeCents;
  return 0;
}
