// @vitest-environment jsdom
// Módulos ocultos na web (QLP e Recrutamento): fora do roteador, do menu, do dock, do assistente e
// das telas ativas; a URL direta cai na página 404; religar o módulo no registro traz tudo de volta.
import { menuDoPerfil } from "@my-flux/shared";
import { MODULOS, type ModuloDef } from "@my-flux/shared";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contextoDaPagina, sugestoesDaPagina } from "../features/suporte/contexto-da-pagina";
import { itensDoDock, navigationGroups } from "../features/navigation/nav-items";
import { request } from "../features/my-flux/client";
import { DashboardPage } from "../pages/dashboard-page";
import { ImportsPage } from "../pages/imports-page";
import { LoginPage } from "../pages/login-page";
import { apiGet } from "../services/api-client";
import { renderizar } from "../test/render";
import { contextosOcultos } from "./contexto-do-assistente";
import { itensDeMenuOcultos } from "./navegacao";
import { rotasOcultas } from "./rotas";

vi.mock("../services/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  storeSession: vi.fn()
}));
vi.mock("../features/my-flux/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/my-flux/client")>();
  return { ...original, request: vi.fn() };
});

const religado = (...ids: string[]): Record<string, ModuloDef> =>
  Object.fromEntries(
    Object.entries(MODULOS).map(([id, m]) => [
      id,
      ids.includes(id) ? { ...m, status: "active" as const } : m
    ])
  );

beforeEach(() => {
  vi.mocked(apiGet).mockReset();
  vi.mocked(request).mockReset();
});

/** O que não pode aparecer em nenhuma tela ativa enquanto o QLP estiver oculto. */
const PROIBIDOS =
  /QLP|Recrutamento|Cobertura da operação|de cobertura|Posições previstas|Posições ocupadas|Vagas em aberto|Excedentes no quadro|Necessário|Coberto\b/;

describe("módulos ocultos: roteador, menu e assistente", () => {
  it("oculto: nenhuma rota, nenhum item de menu, nenhum contexto do assistente", () => {
    expect(rotasOcultas()).toEqual([]);
    expect(itensDeMenuOcultos()).toEqual([]);
    expect(contextosOcultos()).toEqual([]);
  });

  it("o menu e o dock não têm QLP nem Recrutamento para nenhum dos 4 perfis", () => {
    const rotulos = navigationGroups.flatMap((g) => g.items.map((i) => i.label));
    expect(rotulos).not.toContain("QLP");
    expect(rotulos).not.toContain("Recrutamento");
    for (const perfil of ["DEV", "ADMIN", "RH", "COMUM"] as const) {
      const hrefs = itensDoDock(menuDoPerfil(perfil)).map((i) => i.href);
      expect(hrefs, perfil).not.toContain("/qlp");
      expect(hrefs, perfil).not.toContain("/recrutamento");
    }
  });

  it("a URL direta de um módulo oculto cai na página 404 (para qualquer perfil)", () => {
    const roteador = createMemoryRouter(
      [...rotasOcultas(), { path: "*", element: <p>Página não encontrada</p> }],
      { initialEntries: ["/qlp"] }
    );
    render(<RouterProvider router={roteador} />);
    expect(screen.getByText("Página não encontrada")).toBeTruthy();
    void roteador.navigate("/recrutamento");
    expect(roteador.state.matches.at(-1)?.route.path).toBe("*");
  });

  it("o assistente não conhece as telas ocultas (cai no contexto padrão)", () => {
    expect(contextoDaPagina("/qlp").titulo).toBe("MY FLUX");
    expect(contextoDaPagina("/recrutamento").titulo).toBe("MY FLUX");
    expect(sugestoesDaPagina("/qlp", "RH").join(" ")).not.toMatch(/QLP/);
  });

  it("o roteador principal não importa as páginas ocultas direto (só pelo registro)", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    expect(main).not.toMatch(/qlp-page|recruitment-page/);
    expect(main).toContain("rotasOcultas()");
  });
});

describe("módulos ocultos: religar", () => {
  it("religar o QLP traz a rota, o item de menu e o contexto do assistente dele (e só dele)", () => {
    const registro = religado("qlp");
    expect(rotasOcultas(registro).map((r) => r.path)).toEqual(["/qlp"]);
    expect(itensDeMenuOcultos(registro).map((i) => i.href)).toEqual(["/qlp"]);
    expect(contextosOcultos(registro).map((c) => c.prefixo)).toEqual(["/qlp"]);
  });

  it("religar os dois traz as duas rotas", () => {
    const registro = religado("qlp", "recrutamento");
    expect(rotasOcultas(registro).map((r) => r.path)).toEqual(["/qlp", "/recrutamento"]);
    expect(itensDeMenuOcultos(registro).map((i) => i.label)).toEqual(["QLP", "Recrutamento"]);
  });
});

describe("módulos ocultos: nenhum texto nas telas ativas", () => {
  it("painel inicial", async () => {
    vi.mocked(apiGet).mockResolvedValue({
      data: {
        qlp: 40,
        occupied: 32,
        vacancies: 8,
        surplus: 3,
        coveragePercent: 80,
        criticalDocuments: 3,
        conflicts: 2,
        pending: 5
      }
    } as never);
    renderizar(<DashboardPage />, { rota: "/dashboard" });
    await screen.findByRole("region", { name: "Indicadores operacionais" });
    expect(document.body.textContent).not.toMatch(PROIBIDOS);
    expect(document.querySelector('a[href="/qlp"], a[href="/recrutamento"]')).toBeNull();
  });

  it("entrada do sistema", () => {
    renderizar(<LoginPage />, { rota: "/login" });
    expect(document.body.textContent).not.toMatch(PROIBIDOS);
  });

  it("importações: sem a opção QLP", async () => {
    vi.mocked(request).mockResolvedValue([] as never);
    renderizar(<ImportsPage />, { rota: "/importacoes" });
    await screen.findByText(/Colaboradores/);
    expect(document.body.textContent).not.toMatch(/QLP/);
  });
});
