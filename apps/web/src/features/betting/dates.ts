export const BETFLUX_TIME_ZONE = "America/Sao_Paulo";

export function saoPauloDate(value: Date | string = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BETFLUX_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function localStart(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: BETFLUX_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short"
  });
}
