// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiPost } from "../services/api-client";
import { renderizar } from "../test/render";
import { ForgotPasswordPage } from "./forgot-password-page";
import { SetPasswordPage } from "./set-password-page";

vi.mock("../services/api-client", () => ({ apiPost: vi.fn() }));
const postar = vi.mocked(apiPost);

beforeEach(() => vi.resetAllMocks());

describe("recuperar senha", () => {
  it("pede o e-mail, chama a API e confirma sem revelar se a conta existe", async () => {
    postar.mockResolvedValue({} as never);
    renderizar(<ForgotPasswordPage />, { rota: "/esqueci-a-senha" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await userEvent.type(screen.getByLabelText("E-mail"), "rh@myflux.local");
    await userEvent.click(screen.getByRole("button", { name: "Solicitar redefinição" }));
    expect(postar).toHaveBeenCalledWith("/auth/forgot-password", { email: "rh@myflux.local" });
    expect((await screen.findByRole("status")).textContent).toBe(
      "Se o e-mail existir, a solicitação foi registrada."
    );
    expect(screen.getByRole("link", { name: "Voltar para login" }).getAttribute("href")).toBe(
      "/login"
    );
  });
});

describe("definir senha", () => {
  it("sem token, o botão fica desativado; com token, envia e confirma", async () => {
    renderizar(<SetPasswordPage />, { rota: "/definir-senha" });
    expect(
      (screen.getByRole("button", { name: "Salvar senha" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("com token, chama o endpoint do convite e avisa o sucesso", async () => {
    postar.mockResolvedValue({} as never);
    renderizar(<SetPasswordPage />, {
      rota: "/definir-senha?token=abc",
      caminho: "/definir-senha"
    });
    await userEvent.type(screen.getByLabelText("Nova senha"), "SenhaForte!2026");
    await userEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    expect(postar).toHaveBeenCalledWith("/auth/accept-invitation", {
      token: "abc",
      password: "SenhaForte!2026"
    });
    expect((await screen.findByRole("status")).textContent).toBe("Senha definida com sucesso.");
  });
});
