import { apiPrefix } from "@my-flux/config";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? `http://localhost:3333${apiPrefix}`;

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Falha ao consultar a API."));
  }

  return response.json() as Promise<TResponse>;
}

export async function apiPost<TResponse, TBody extends object>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Falha ao enviar dados para a API."));
  }

  return response.json() as Promise<TResponse>;
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(55_000) });
}

export function storeSession(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem("my-flux.accessToken", accessToken);
  window.localStorage.setItem("my-flux.refreshToken", refreshToken);
  // Also mirror into sessionStorage under the keys features/my-flux/client.ts's
  // request() actually reads when refreshing an expired access token
  // (sessionStorage["flux.refresh"]). Without this, every refresh attempt
  // sent refreshToken: null and failed, forcing a full re-login on every
  // access-token expiry (~15min) even though a valid refresh token existed.
  window.sessionStorage.setItem("flux.access", accessToken);
  window.sessionStorage.setItem("flux.refresh", refreshToken);
}

function authHeaders(): Record<string, string> {
  const token = window.localStorage.getItem("my-flux.accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { code?: unknown; message?: unknown };

    if (typeof payload.message === "string") {
      return typeof payload.code === "string"
        ? `${payload.code}: ${payload.message}`
        : payload.message;
    }

    return fallback;
  } catch {
    return fallback;
  }
}
