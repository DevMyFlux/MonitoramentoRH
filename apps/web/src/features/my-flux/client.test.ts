// @vitest-environment jsdom
// O token de acesso dura pouco: /auth/me também tem de renovar antes de desistir da sessão.
import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status });

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("renovação da sessão", () => {
  it("um 401 em /auth/me renova o token (mesmo numa aba nova) e repete a chamada", async () => {
    localStorage.setItem("my-flux.accessToken", "velho");
    localStorage.setItem("my-flux.refreshToken", "renovacao");
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(resposta(401, { message: "expirou" }))
      .mockResolvedValueOnce(resposta(200, { data: { accessToken: "novo" } }))
      .mockResolvedValueOnce(resposta(200, { data: { user: { id: "u" } } }));
    vi.stubGlobal("fetch", buscar);

    await expect(request("/auth/me")).resolves.toEqual({ user: { id: "u" } });
    expect(String(buscar.mock.calls[1]![0])).toContain("/auth/refresh");
    expect(JSON.parse(buscar.mock.calls[1]![1].body)).toEqual({ refreshToken: "renovacao" });
    expect(localStorage.getItem("my-flux.refreshToken")).toBe("renovacao");
  });

  it("um 401 no login não tenta renovar", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(401, { message: "credenciais" }));
    vi.stubGlobal("fetch", buscar);
    await expect(request("/auth/login", "POST", {})).rejects.toThrow("credenciais");
    expect(buscar).toHaveBeenCalledTimes(1);
  });
});
