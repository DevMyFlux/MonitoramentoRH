const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3334/api/v1";
export type Row = Record<string, unknown> & { id: string };

/**
 * Uma resposta de erro da API. Continua sendo um `Error` com a mesma mensagem de sempre; além
 * disso guarda o status e o código estável ({ code, message, details }), que as telas do
 * Leadership Lab usam para reagir ao motivo em vez de comparar texto.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details ?? {};
  }
}

let refreshing: Promise<void> | null = null;
export function session() {
  return sessionStorage.getItem("flux.access") ?? localStorage.getItem("my-flux.accessToken");
}
export function saveSession(access: string, refresh: string) {
  sessionStorage.setItem("flux.access", access);
  sessionStorage.setItem("flux.refresh", refresh);
  localStorage.setItem("my-flux.accessToken", access);
  localStorage.setItem("my-flux.refreshToken", refresh);
}
export function clearSession() {
  sessionStorage.removeItem("flux.access");
  sessionStorage.removeItem("flux.refresh");
  localStorage.removeItem("my-flux.accessToken");
  localStorage.removeItem("my-flux.refreshToken");
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  retried = false
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      // Fastify's JSON body parser rejects an empty body when this header is
      // present (e.g. every DELETE with no payload), so only send it when
      // there is actually a JSON body to describe.
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(session() ? { Authorization: `Bearer ${session()}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000)
  });
  if (response.status === 401 && !path.startsWith("/auth/") && !retried) {
    if (!refreshing)
      refreshing = request<{ accessToken: string; refreshToken?: string }>(
        "/auth/refresh",
        "POST",
        { refreshToken: sessionStorage.getItem("flux.refresh") }
      )
        .then((r) =>
          saveSession(r.accessToken, r.refreshToken ?? sessionStorage.getItem("flux.refresh") ?? "")
        )
        .finally(() => {
          refreshing = null;
        });
    try {
      await refreshing;
      return request<T>(path, method, body, true);
    } catch {
      clearSession();
      window.dispatchEvent(new Event("flux-session-expired"));
    }
  }
  const payload = (await response.json()) as {
    data: T;
    message?: string;
    code?: string;
    details?: { issues?: { path: string[]; message: string }[]; [campo: string]: unknown };
  };
  if (!response.ok)
    throw new ApiError(
      payload.details?.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") ||
        payload.message ||
        "Não foi possível concluir a operação.",
      response.status,
      payload.code,
      payload.details
    );
  return payload.data;
}
/**
 * `name` is an optional override; by default the file is saved under the name
 * the server chose (Content-Disposition) so callers never have to duplicate
 * the server's naming rules (e.g. "Escala Hetrin - Setembro.xlsx").
 */
export async function download(path: string, name?: string) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${session()}` } });
  if (!res.ok) {
    // Error responses are JSON ({code, message, details}), not the file itself.
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || "Não foi possível exportar. Verifique seu acesso.");
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const fileName = name ?? /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "download.xlsx";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
export const text = (value: unknown): string =>
  value == null
    ? "—"
    : typeof value === "object"
      ? String((value as Row).name ?? (value as Row).title ?? "—")
      : String(value);
export const date = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(String(value)))
    : "—";
