// @vitest-environment jsdom
// A guarda de rota: sem sessão vai ao login guardando de onde veio; o perfil só abre o que é dele.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiError, request, session } from "./features/my-flux/client";

vi.mock("./features/my-flux/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./features/my-flux/client")>()),
  session: vi.fn(),
  request: vi.fn()
}));
vi.mock("./features/suporte/assistente-de-suporte", () => ({ AssistenteDeSuporte: () => null }));

const Casca = ({ children }: { breadcrumbs: string[]; children: ReactNode }) => <>{children}</>;
function Onde() {
  const { pathname, state } = useLocation();
  return (
    <p data-testid="local">
      {pathname}|{(state as { from?: string } | null)?.from ?? ""}
    </p>
  );
}
const abrir = (rota: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/login" element={<Onde />} />
          <Route
            path="*"
            element={
              <App layout={Casca}>
                <p>conteúdo protegido</p>
                <Onde />
              </App>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
const local = async () => (await screen.findByTestId("local")).textContent;
const como = (role: string) => {
  vi.mocked(session).mockReturnValue("token");
  vi.mocked(request).mockResolvedValue({ user: { id: "u", role } } as never);
};

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("guarda de rota", () => {
  it("sem sessão vai ao login, guardando a rota pretendida e sem entrar sozinho", async () => {
    vi.mocked(session).mockReturnValue(null);
    abrir("/escalas?mes=2");
    expect(await local()).toBe("/login|/escalas?mes=2");
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("sessão expirada (401) vai ao login, guardando a rota", async () => {
    vi.mocked(session).mockReturnValue("velho");
    vi.mocked(request).mockRejectedValue(new ApiError("expirou", 401));
    abrir("/escalas");
    expect(await local()).toBe("/login|/escalas");
  });

  it("falha que não é 401 não derruba a sessão", async () => {
    vi.mocked(session).mockReturnValue("token");
    vi.mocked(request).mockRejectedValue(new TypeError("sem rede"));
    abrir("/escalas");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByTestId("local")).toBeNull();
  });

  it("o COMUM que abre uma rota da equipe vai para a inicial dele", async () => {
    como("COMUM");
    abrir("/colaboradores");
    expect(await screen.findByText("/lab|")).toBeTruthy();
  });

  it("o RH que abre a configuração do Lab vai para a inicial dele", async () => {
    como("RH");
    abrir("/lab/config");
    expect(await screen.findByText("/colaboradores|")).toBeTruthy();
  });

  it.each([
    ["DEV", "/lab/config"],
    ["ADMIN", "/usuarios"],
    ["RH", "/escalas"],
    ["COMUM", "/lab/teste"]
  ])("%s abre %s", async (role, rota) => {
    como(role);
    abrir(rota);
    expect(await screen.findByText("conteúdo protegido")).toBeTruthy();
    expect(await local()).toBe(`${rota}|`);
  });
});
