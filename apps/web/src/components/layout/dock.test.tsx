// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { itensDoDock } from "../../features/navigation/nav-items";
import { novoCliente } from "../../test/render";
import { Dock } from "./dock";

function montar(perfil: string | null, rota = "/colaboradores") {
  const cliente = novoCliente();
  if (perfil) {
    sessionStorage.setItem("flux.access", "token");
    cliente.setQueryData(chaveDoUsuarioAtual, {
      id: "u1",
      email: "a@b.c",
      name: "Pessoa",
      role: perfil,
      scopes: []
    });
  }
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[rota]}>
        <Dock />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_MODO_TESTE_SEM_LOGIN", "false");
  window.matchMedia = ((q: string) => ({
    matches: q.includes("max-width"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
});

describe("itensDoDock", () => {
  it("são os mesmos itens visíveis do menu, por perfil, com nome curto", () => {
    expect(itensDoDock("COMUM").map((i) => i.href)).toEqual(["/colaboradores", "/escalas", "/lab"]);
    expect(itensDoDock("RH").map((i) => i.href)).toEqual(["/colaboradores", "/escalas", "/lab/rh"]);
    expect(itensDoDock("DEV").map((i) => i.curto)).toEqual([
      "Pessoas",
      "Escalas",
      "Lab",
      "Gestão",
      "Config."
    ]);
  });
});

describe("dock (celular)", () => {
  it("mostra a navegação do perfil, marca a página atual e só aparece abaixo de lg", () => {
    montar("RH", "/escalas");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.className).toContain("lg:hidden");
    expect(screen.getByRole("link", { name: "Escalas" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Pessoas" }).getAttribute("href")).toBe(
      "/colaboradores"
    );
    expect(screen.getByRole("link", { name: "Gestão" }).getAttribute("href")).toBe("/lab/rh");
    expect(screen.queryByRole("link", { name: "Lab" })).toBeNull();
  });

  it("avisa o espaço que ocupa (para o assistente flutuar acima) e limpa ao sair", () => {
    const { unmount } = montar("RH");
    expect(document.documentElement.style.getPropertyValue("--mf-dock-h")).toBe("4.25rem");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--mf-dock-h")).toBe("");
  });

  it("sem perfil conhecido, só os itens livres; cada alvo tem altura de toque", () => {
    montar(null);
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
    expect(links[0]!.className).toContain("min-h-[52px]");
  });
});
