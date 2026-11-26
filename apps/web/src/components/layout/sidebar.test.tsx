// @vitest-environment jsdom
import { menuDoPerfil, type PerfilDeAcesso } from "@my-flux/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
      scopes: [],
      menu: menuDoPerfil(perfil as PerfilDeAcesso)
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
const acompanhamento = () => screen.queryByRole("link", { name: "Acompanhamento do Lab" });
const configuracao = () => screen.queryByRole("link", { name: "Configuração do Lab" });

describe("menu lateral", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("o participante (COMUM) vê o Leadership Lab, que leva ao painel dele", () => {
    montar("COMUM");
    expect(lab()?.getAttribute("href")).toBe("/lab");
  });

  it.each(["RH", "ADMIN"])(
    "%s não vê o Leadership Lab, e o resto do menu segue igual",
    (perfil) => {
      montar(perfil);
      expect(lab()).toBeNull();
      expect(screen.getByRole("link", { name: "Colaboradores" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Escalas" })).toBeTruthy();
    }
  );

  it("o DEV vê o Lab inteiro: painel do participante, acompanhamento e configuração", () => {
    montar("DEV");
    expect(lab()?.getAttribute("href")).toBe("/lab");
    expect(acompanhamento()?.getAttribute("href")).toBe("/lab/rh");
    expect(configuracao()?.getAttribute("href")).toBe("/lab/config");
  });

  it("cada perfil vê a sua parte do Lab: RH e ADMIN acompanham, ADMIN configura, COMUM participa", () => {
    montar("RH");
    expect(acompanhamento()?.getAttribute("href")).toBe("/lab/rh");
    expect(configuracao()).toBeNull();
    cleanup();

    montar("ADMIN");
    expect(configuracao()?.getAttribute("href")).toBe("/lab/config");
    // O ADMIN também acompanha (todas as turmas) e decide contestações.
    expect(acompanhamento()?.getAttribute("href")).toBe("/lab/rh");
    cleanup();

    montar("COMUM");
    expect(acompanhamento()).toBeNull();
    expect(configuracao()).toBeNull();
  });

  it("enquanto não se sabe quem está logado, nenhum item restrito aparece", () => {
    montar(null);
    expect(lab()).toBeNull();
    expect(screen.queryByRole("link", { name: "Colaboradores" })).toBeNull();
  });

  it("o COMUM só vê o Leadership Lab; o RH vê Colaboradores e Escalas", () => {
    montar("COMUM");
    expect(lab()).toBeTruthy();
    for (const nome of ["Colaboradores", "Escalas", "Treinamentos"])
      expect(screen.queryByRole("link", { name: nome })).toBeNull();
    cleanup();
    montar("RH");
    expect(screen.getByRole("link", { name: "Colaboradores" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Escalas" })).toBeTruthy();
  });

  it("a busca do menu encontra o Leadership Lab para o participante", async () => {
    montar("COMUM");
    await userEvent.setup().type(screen.getByLabelText("Buscar no menu"), "lead");
    expect(lab()).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Escalas" })).toBeNull();
  });
});
