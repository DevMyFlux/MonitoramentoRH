// Leadership Lab — "há 5 min", para as notificações.

/** "agora", "há 5 min", "há 3 h", "há 2 d" (e a data, depois de uma semana). */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const s = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86_400) return `há ${Math.floor(s / 86_400)} d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(iso));
}
