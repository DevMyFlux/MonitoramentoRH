// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderizar } from "../../../test/render";
import { LabShell } from "./lab-shell";

const usuarioAtual = vi.hoisted(() => ({
  data: undefined as
    undefined | { id: string; name: string; email: string; role: string; scopes: never[] }
}));

vi.mock("../../auth/use-usuario-atual", async () => ({
  useUsuarioAtual: () => usuarioAtual,
  chaveDoUsuarioAtual: ["auth", "me"]
}));

const ana = {
  id: "u1",
  name: "Ana Souza",
  email: "ana@exemplo.com",
  role: "COMUM",
  scopes: []
} as const;

function abrir(rota = "/lab", migalhas = ["MY FLUX", "Leadership Lab"]) {
  return renderizar(
    <LabShell breadcrumbs={migalhas}>
      <h1>Conteúdo da página</h1>
    </LabShell>,
    { rota, caminho: "/lab/*" }
  );
}

beforeEach(() => {
  usuarioAtual.data = { ...ana, scopes: [] };
  vi.stubEnv("VITE_MODO_TESTE_SEM_LOGIN", "false");
});

describe("LabShell", () => {
  it("mostra a página dentro do conteúdo principal, com o atalho para pular o menu", async () => {
    abrir();
    const principal = document.getElementById("main-content")!;
    expect(
      await within(principal).findByRole("heading", { name: "Conteúdo da página" })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para o conteúdo" }).getAttribute("href")).toBe(
      "#main-content"
    );
  });

  it("o menu mostra a parte do Lab do perfil e marca a página atual", () => {
    abrir("/lab/teste");
    const menu = within(document.getElementById("main-sidebar")!);
    expect(menu.getByRole("link", { name: "Leadership Lab" }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(menu.queryByRole("link", { name: "Configuração do Lab" })).toBeNull();
  });

  it("o caminho da página fica no topo, com a última migalha como a atual", () => {
    abrir("/lab/resultado/x", ["MY FLUX", "Leadership Lab", "Resultado"]);
    const caminho = screen.getByRole("navigation", { name: "Caminho da página" });
    expect(within(caminho).getByText("Resultado").getAttribute("aria-current")).toBe("page");
    expect(within(caminho).getByText("MyFlux")).toBeTruthy();
  });

  it("o menu da conta mostra quem está logado e oferece Parâmetros e Sair", async () => {
    abrir();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Menu da conta" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Ana Souza")).toBeTruthy();
    expect(within(menu).getByText("ana@exemplo.com")).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Parâmetros" }).getAttribute("href")).toBe(
      "/parametros"
    );
    expect(within(menu).getByRole("menuitem", { name: "Sair" })).toBeTruthy();
  });

  it("no celular, o botão abre o menu lateral e Esc o fecha", async () => {
    abrir();
    const usuario = userEvent.setup();
    const menu = document.getElementById("main-sidebar")!;
    expect(menu.className).toContain("invisible");
    await usuario.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(menu.className).not.toContain("invisible");
    await usuario.keyboard("{Escape}");
    expect(menu.className).toContain("invisible");
  });
});
