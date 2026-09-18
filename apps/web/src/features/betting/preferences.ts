import { useSyncExternalStore } from "react";

export type Preferences = {
  region: "eu" | "uk" | "us" | "au";
  sport: string;
  bankroll: number;
  dailyBudget: number;
  paperStake: number;
  autoRefresh: boolean;
};
const defaults: Preferences = {
  region: "eu",
  sport: "soccer_all",
  bankroll: 1000,
  dailyBudget: 50,
  paperStake: 10,
  autoRefresh: false
};
const key = "betflux.preferences.v1";
let raw: string | null = null;
let cached = defaults;

export function getPreferences(): Preferences {
  try {
    const value = window.localStorage.getItem(key);
    if (value === raw) return cached;
    raw = value;
    const parsed = JSON.parse(value ?? "{}") as Partial<Preferences>;
    cached = {
      region: ["eu", "uk", "us", "au"].includes(parsed.region ?? "")
        ? parsed.region!
        : defaults.region,
      sport: /^soccer_[a-z0-9_]+$/.test(parsed.sport ?? "") ? parsed.sport! : defaults.sport,
      bankroll: validNumber(parsed.bankroll, 1, 1_000_000) ? parsed.bankroll! : defaults.bankroll,
      dailyBudget: validNumber(parsed.dailyBudget, 0, 1_000_000)
        ? parsed.dailyBudget!
        : defaults.dailyBudget,
      paperStake: validNumber(parsed.paperStake, 0.01, 1_000_000)
        ? parsed.paperStake!
        : defaults.paperStake,
      autoRefresh: parsed.autoRefresh === true
    };
  } catch {
    cached = defaults;
  }
  return cached;
}

function validNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function savePreferences(changes: Partial<Preferences>) {
  const next = { ...getPreferences(), ...changes };
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new Event("betflux-preferences"));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("betflux-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("betflux-preferences", callback);
  };
}

export function usePreferences() {
  return useSyncExternalStore(subscribe, getPreferences, () => defaults);
}
