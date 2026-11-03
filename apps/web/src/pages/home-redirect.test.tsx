// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUsuarioAtual } from "../features/auth/use-usuario-atual";
import { session } from "../features/my-flux/client";
import { renderizar } from "../test/render";
import { HomeRedirect } from "./home-redirect";

vi.mock("../features/auth/use-usuario-atual", () => ({ useUsuarioAtual: vi.fn() }));
vi.mock("../features/my-flux/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/my-flux/client")>()),
  session: vi.fn()
}));

const usuario = vi.mocked(useUsuarioAtual);
const comSessao = () => vi.mocked(session).mockReturnValue("token");
const estado = (parcial: object) =>
  usuario.mockReturnValue(parcial as ReturnType<typeof useUsuarioAtual>);
const abrir = () => renderizar(<HomeRedirect />, { rota: "/" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("página inicial", () => {
  it("o participante do Leadership Lab (COMUM) cai no painel dele", () => {
    comSessao();
    estado({ isPending: false, data: { role: "COMUM" } });
    abrir();
    expect(screen.getByTestId("local").textContent).toBe("/lab");
  });

  it.each(["DEV", "ADMIN", "RH"])("%s continua indo para Colaboradores", (role) => {
    comSessao();
    estado({ isPending: false, data: { role } });
    abrir();
    expect(screen.getByTestId("local").textContent).toBe("/colaboradores");
  });

  it("enquanto descobre quem é, espera em vez de escolher um destino", () => {
    comSessao();
    estado({ isPending: true, data: undefined });
    abrir();
    expect(screen.getByText("Carregando...")).toBeTruthy();
    expect(screen.queryByTestId("local")).toBeNull();
  });

  it("sem sessão, vai para Colaboradores (a página de lá manda para o login)", () => {
    vi.mocked(session).mockReturnValue(null);
    estado({ isPending: false, data: undefined });
    abrir();
    expect(screen.getByTestId("local").textContent).toBe("/colaboradores");
  });

  it("se não conseguiu saber o perfil, vai para onde sempre foi", () => {
    comSessao();
    estado({ isPending: false, isError: true, data: undefined });
    abrir();
    expect(screen.getByTestId("local").textContent).toBe("/colaboradores");
  });
});
