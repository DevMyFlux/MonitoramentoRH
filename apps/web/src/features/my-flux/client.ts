const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3334/api/v1";
export type Row = Record<string, unknown> & { id: string };
import { setSessionUser } from "../auth/session-store";
let refreshing: Promise<void> | null = null;

/**
 * Erro de uma chamada à API. `message` já é a frase amigável (o servidor a monta no catálogo central); o código
 * técnico fica em `code` — para logs/suporte — e a ação recomendada em `action`.
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly action: string | null = null,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Texto para mostrar ao usuário: a mensagem e, quando existir, o que fazer. Aceita qualquer coisa lançada. */
export function errorText(
  error: unknown,
  fallback = "Não foi possível concluir a operação."
): string {
  if (error instanceof ApiRequestError)
    return error.action ? `${error.message} ${error.action}` : error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const NETWORK_MESSAGE = "Não foi possível se conectar ao servidor.";
const NETWORK_ACTION = "Verifique sua conexão e tente novamente.";

function networkError(error: unknown): ApiRequestError {
  const timedOut =
    error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
  return new ApiRequestError(
    timedOut ? "O servidor demorou demais para responder." : NETWORK_MESSAGE,
    timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
    0,
    NETWORK_ACTION
  );
}

function apiError(
  response: Response,
  payload: { message?: string; code?: string; details?: Record<string, unknown> } | null
) {
  const action = typeof payload?.details?.action === "string" ? payload.details.action : null;
  return new ApiRequestError(
    payload?.message || "Não foi possível concluir a operação.",
    payload?.code ?? `HTTP_${response.status}`,
    response.status,
    action,
    payload?.details ?? {}
  );
}
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
  setSessionUser(null);
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
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
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
  } catch (error) {
    throw networkError(error);
  }
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
  const payload = (await response.json().catch(() => null)) as {
    data: T;
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
  } | null;
  if (!response.ok) throw apiError(response, payload);
  if (!payload) throw apiError(response, null);
  return payload.data;
}
/**
 * `name` is an optional override; by default the file is saved under the name
 * the server chose (Content-Disposition) so callers never have to duplicate
 * the server's naming rules (e.g. "Escala Hetrin - Setembro.xlsx").
 */
export async function download(path: string, name?: string) {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${session()}` } });
  } catch (error) {
    throw networkError(error);
  }
  if (!res.ok) {
    // Error responses are JSON ({code, message, details}), not the file itself.
    const payload = (await res.json().catch(() => null)) as {
      message?: string;
      code?: string;
      details?: Record<string, unknown>;
    } | null;
    throw apiError(res, payload ?? { message: "Não foi possível exportar. Verifique seu acesso." });
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
