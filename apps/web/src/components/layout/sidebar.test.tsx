// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { novoCliente } from "../../test/render";
import { Sidebar } from "./sidebar";

function montar(perfil: string | null) {
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
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
const lab = () => screen.queryByRole("link", { name: "Leadership Lab" });

describe("menu lateral", () => {
  // Estes testes são do comportamento COM login (o de produção quando o modo de teste é desligado).
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv("VITE_MODO_TESTE_SEM_LOGIN", "false");
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  it("o participante (COMUM) vê o Leadership Lab, que leva ao painel dele", () => {
    montar("COMUM");
    expect(lab()?.getAttribute("href")).toBe("/lab");
  });

  it.each(["RH", "ADMIN", "DEV"])(
    "%s não vê o Leadership Lab, e o resto do menu segue igual",
    (perfil) => {
      montar(perfil);
      expect(lab()).toBeNull();
      expect(screen.getByRole("link", { name: "Colaboradores" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Escalas" })).toBeTruthy();
    }
  );

  it("enquanto não se sabe quem está logado, o item restrito não aparece (e o resto sim)", () => {
    montar(null);
    expect(lab()).toBeNull();
    expect(screen.getByRole("link", { name: "Colaboradores" })).toBeTruthy();
  });

  it("a busca do menu encontra o Leadership Lab para o participante", async () => {
    montar("COMUM");
    await userEvent.setup().type(screen.getByLabelText("Buscar no menu"), "lead");
    expect(lab()).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Escalas" })).toBeNull();
  });
});

describe("menu lateral no modo de teste (todo visitante entra como DEV)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv("VITE_MODO_TESTE_SEM_LOGIN", "true");
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  it.each(["DEV", "ADMIN", "RH", "COMUM"])(
    "%s encontra o Leadership Lab no menu (a página explica o que o perfil pode fazer)",
    (perfil) => {
      montar(perfil);
      expect(lab()?.getAttribute("href")).toBe("/lab");
    }
  );

  it("o padrão (variável ausente) é o modo de teste ligado", () => {
    vi.unstubAllEnvs();
    montar("DEV");
    expect(lab()).toBeTruthy();
  });
});
