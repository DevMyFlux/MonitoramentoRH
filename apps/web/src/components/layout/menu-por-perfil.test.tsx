// @vitest-environment jsdom
// Os três menus (lateral, do Lab e dock) mostram só o que a API permite, sempre na mesma ordem; a
// página atual só muda o destaque.
import { menuDoPerfil, type PerfilDeAcesso, perfisDeAcesso } from "@my-flux/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { chaveDoUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { LabSidebar } from "../../features/leadership-lab/layout/lab-sidebar";
import { novoCliente } from "../../test/render";
import { Dock } from "./dock";
import { Sidebar } from "./sidebar";

const ESPERADO: Record<PerfilDeAcesso, string[]> = {
  DEV: [
    "/colaboradores",
    "/escalas",
    "/lab",
    "/lab/rh",
    "/lab/config",
    "/treinamentos",
    "/treinamentos/config",
    "/usuarios"
  ],
  ADMIN: [
    "/colaboradores",
    "/escalas",
    "/lab/rh",
    "/lab/config",
    "/treinamentos/config",
    "/usuarios"
  ],
  RH: ["/colaboradores", "/escalas", "/lab/rh", "/treinamentos/config", "/usuarios"],
  COMUM: ["/lab"]
};
const ROTAS = [
  "/colaboradores",
  "/escalas",
  "/lab",
  "/lab/teste",
  "/lab/rh/acompanhamento",
  "/lab/config",
  "/treinamentos",
  "/treinamentos/config",
  "/usuarios"
];

const menus = {
  lateral: { elemento: <Sidebar />, nome: "Módulos" },
  doLab: { elemento: <LabSidebar aberta={false} aoFechar={() => undefined} />, nome: "Módulos" },
  dock: { elemento: <Dock />, nome: "Navegação principal" }
};

function montar(qual: keyof typeof menus, perfil: PerfilDeAcesso, rota = "/lab", menu?: string[]) {
  const cliente = novoCliente();
  sessionStorage.setItem("flux.access", "token");
  cliente.setQueryData(chaveDoUsuarioAtual, {
    id: "u1",
    email: "a@b.c",
    name: "Pessoa",
    role: perfil,
    scopes: [],
    menu: menu ?? menuDoPerfil(perfil)
  });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[rota]}>{menus[qual].elemento}</MemoryRouter>
    </QueryClientProvider>
  );
  const nav = screen.getByRole("navigation", { name: menus[qual].nome, hidden: true });
  const links = () => within(nav).queryAllByRole("link", { hidden: true });
  return {
    hrefs: () => links().map((l) => l.getAttribute("href")),
    ativos: () =>
      links()
        .filter((l) => l.getAttribute("aria-current") === "page")
        .map((l) => l.getAttribute("href"))
  };
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe.each(["lateral", "doLab"] as const)("menu %s", (qual) => {
  it.each(perfisDeAcesso)("%s: só o permitido, na ordem fixa, em qualquer página", (perfil) => {
    for (const rota of ROTAS) {
      expect(montar(qual, perfil, rota).hrefs(), rota).toEqual(ESPERADO[perfil]);
      cleanup();
    }
  });

  it("a lista vem das permissões da API, não do perfil; a ordem não segue a da resposta", () => {
    const menu = montar(qual, "DEV", "/escalas", ["/usuarios", "/escalas"]);
    expect(menu.hrefs()).toEqual(["/escalas", "/usuarios"]);
  });

  it.each([
    ["/lab", "/lab"],
    ["/lab/teste", "/lab"],
    ["/lab/rh/acompanhamento", "/lab/rh"],
    ["/lab/config", "/lab/config"],
    ["/treinamentos", "/treinamentos"],
    ["/treinamentos/config", "/treinamentos/config"],
    ["/escalas", "/escalas"]
  ])("em %s, só %s fica destacado", (rota, ativo) => {
    expect(montar(qual, "DEV", rota).ativos()).toEqual([ativo]);
  });
});

describe("dock", () => {
  it.each(perfisDeAcesso)("%s: a mesma ordem do menu, sem repetir destaque", (perfil) => {
    const menu = montar("dock", perfil, "/lab/rh/revisao");
    const esperado = ESPERADO[perfil].filter(
      (r) => r !== "/usuarios" && r !== "/treinamentos/config"
    );
    expect(menu.hrefs()).toEqual(esperado);
    // A rota filha destaca o item mais específico que o perfil tem.
    const destaque = ["/lab/rh", "/lab"].find((r) => esperado.includes(r));
    expect(menu.ativos()).toEqual(destaque ? [destaque] : []);
  });
});

describe("atalho de escalas no rodapé do menu", () => {
  it("não existe para quem não abre Escalas", () => {
    montar("lateral", "COMUM");
    expect(screen.queryByRole("link", { name: /Ver escalas geradas/ })).toBeNull();
  });
});
