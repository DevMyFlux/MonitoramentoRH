// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "../services/api-client";
import { renderizar } from "../test/render";
import { DashboardPage } from "./dashboard-page";

vi.mock("../services/api-client", () => ({ apiGet: vi.fn() }));
const buscar = vi.mocked(apiGet);

const resumo = {
  data: {
    qlp: 40,
    occupied: 32,
    vacancies: 8,
    surplus: 0,
    coveragePercent: 80,
    criticalDocuments: 3,
    conflicts: 2,
    pending: 5
  }
};

beforeEach(() => vi.resetAllMocks());

describe("painel inicial", () => {
  it("mostra os indicadores, cada um levando à sua tela", async () => {
    buscar.mockResolvedValue(resumo as never);
    renderizar(<DashboardPage />, { rota: "/dashboard" });
    const indicadores = within(
      await screen.findByRole("region", { name: "Indicadores operacionais" })
    );
    // Posições, vagas e cobertura vêm do QLP (módulo oculto): não aparecem.
    expect(indicadores.queryByRole("link", { name: /Posições|Vagas/ })).toBeNull();
    expect(
      indicadores.getByRole("link", { name: /Documentos críticos/ }).getAttribute("href")
    ).toBe("/documentos");
    expect(screen.queryByRole("img", { name: /Cobertura/ })).toBeNull();
    expect(screen.getByText("Pendências operacionais").closest("a")!.textContent).toContain("5");
  });

  it("carregando, mostra o esqueleto; numa falha, o erro, e Atualizar tenta de novo", async () => {
    buscar.mockRejectedValueOnce(new Error("falhou"));
    renderizar(<DashboardPage />, { rota: "/dashboard" });
    expect(await screen.findByText("Não foi possível atualizar os indicadores")).toBeTruthy();
    buscar.mockResolvedValue(resumo as never);
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByRole("region", { name: "Indicadores operacionais" })).toBeTruthy();
  });
});
