// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiPost, storeSession } from "../services/api-client";
import { chaveDoUsuarioAtual } from "../features/auth/use-usuario-atual";
import { novoCliente, renderizar } from "../test/render";
import { LoginPage } from "./login-page";

vi.mock("../services/api-client", () => ({ apiPost: vi.fn(), storeSession: vi.fn() }));
const postar = vi.mocked(apiPost);
const guardar = vi.mocked(storeSession);

beforeEach(() => vi.resetAllMocks());

const abrir = () => renderizar(<LoginPage />, { rota: "/login" });

describe("login", () => {
  it("tem um único título de página e os campos com rótulo", () => {
    abrir();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bem-vindo de volta");
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
  });

  it("valida os campos antes de enviar", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Entrar no MyFlux/ }));
    expect(await screen.findByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.getByText("Informe sua senha.")).toBeTruthy();
    expect(postar).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("E-mail"), "invalido");
    await userEvent.click(screen.getByRole("button", { name: /Entrar no MyFlux/ }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeTruthy();
  });

  it("entra: chama a API, guarda a sessão e vai para a página inicial", async () => {
    postar.mockResolvedValue({ data: { accessToken: "a", refreshToken: "r" } } as never);
    abrir();
    await userEvent.type(screen.getByLabelText("E-mail"), "rh@myflux.local");
    await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: /Entrar no MyFlux/ }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith("a", "r"));
    expect(postar).toHaveBeenCalledWith("/auth/login", {
      email: "rh@myflux.local",
      password: "segredo123"
    });
    expect((await screen.findByTestId("local")).textContent).toBe("/");
  });

  it("numa falha, avisa sem expor o motivo técnico", async () => {
    postar.mockRejectedValue(new Error("401 senha incorreta para rh@..."));
    abrir();
    await userEvent.type(screen.getByLabelText("E-mail"), "rh@myflux.local");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(screen.getByRole("button", { name: /Entrar no MyFlux/ }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/Não foi possível entrar/);
    expect(alerta.textContent).not.toMatch(/401|senha incorreta/);
  });

  it("o botão do olho mostra e oculta a senha, com o estado anunciado", async () => {
    abrir();
    const campo = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(campo.type).toBe("password");
    const olho = screen.getByRole("button", { name: "Mostrar senha" });
    await userEvent.click(olho);
    expect(campo.type).toBe("text");
    expect(screen.getByRole("button", { name: "Ocultar senha" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it.each([
    ["/escalas", "/escalas"],
    ["https://exemplo.com/roubo", "/"],
    ["//exemplo.com", "/"]
  ])("volta à rota pretendida só se ela for interna (%s)", async (from, destino) => {
    postar.mockResolvedValue({ data: { accessToken: "a", refreshToken: "r" } } as never);
    renderizar(<LoginPage />, { rota: { pathname: "/login", state: { from } } });
    await userEvent.type(screen.getByLabelText("E-mail"), "rh@myflux.local");
    await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: /Entrar no MyFlux/ }));
    expect((await screen.findByTestId("local")).textContent).toBe(destino);
  });

  const perfilEmCache = () => {
    const cliente = novoCliente();
    cliente.setQueryData(chaveDoUsuarioAtual, { id: "u", role: "RH" });
    return cliente;
  };

  it("quem já tem sessão válida não vê o login", () => {
    sessionStorage.setItem("flux.access", "token");
    renderizar(<LoginPage />, { rota: "/login", cliente: perfilEmCache() });
    expect(screen.getByTestId("local").textContent).toBe("/");
    sessionStorage.clear();
  });

  it("depois de sair (perfil ainda em cache, sem sessão), mostra o login em vez de entrar em laço", () => {
    renderizar(<LoginPage />, { rota: "/login", cliente: perfilEmCache() });
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});
