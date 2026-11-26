// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../features/my-flux/client";
import { renderizar } from "../test/render";
import { MonthlySchedulePage } from "./monthly-schedule-page";

vi.mock("../features/my-flux/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/my-flux/client")>();
  return { ...original, request: vi.fn(), download: vi.fn() };
});

const pedir = vi.mocked(request);
const OP = "55555555-5555-4555-8555-555555555555";

const dias = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? "F" : "D"));

function escala(extra: Record<string, unknown> = {}) {
  return {
    id: "s1",
    operationId: OP,
    month: "2026-10-01T00:00:00.000Z",
    version: 1,
    status: "DRAFT",
    createdAt: "2026-10-05T12:00:00.000Z",
    generatedResult: {
      grid: {
        year: 2026,
        month: 10,
        sections: [
          {
            label: "Diurno Par",
            rows: [
              {
                employeeId: "e1",
                employeeName: "Ana Souza",
                initials: "AS",
                functionName: "Técnico",
                scheduleLabel: "12x36",
                hours: "07:00-19:00",
                days: dias(31),
                observation: null
              }
            ]
          },
          {
            label: "Noturno Ímpar",
            rows: [
              {
                employeeId: "e2",
                employeeName: "Bruno Lima",
                initials: "BL",
                functionName: "Técnico",
                scheduleLabel: "12x36",
                hours: "19:00-07:00",
                days: dias(31),
                observation: null
              },
              {
                employeeId: "e3",
                employeeName: "Carla Dias",
                initials: "CD",
                functionName: "Técnico",
                scheduleLabel: "12x36",
                hours: "19:00-07:00",
                days: dias(31),
                observation: null
              }
            ]
          }
        ],
        holidays: []
      },
      metrics: { required: 60, covered: 54, coverage: 90 },
      pendencies: [
        {
          employeeId: "e1",
          employeeName: "Ana Souza",
          date: "2026-10-04",
          reasonCodes: ["SHIFT_NOT_CONFIGURED"]
        }
      ]
    },
    ...extra
  };
}

function respostas(schedules: unknown[] = [escala()]) {
  pedir.mockImplementation(async (caminho: string, metodo?: string) => {
    if (metodo === "POST" && caminho === "/employee-schedules/generate") {
      return escala({ id: "s2", version: 2, status: "DRAFT" }) as never;
    }
    if (metodo === "PATCH") return { status: "IN_REVIEW" } as never;
    if (metodo === "POST" && caminho === "/schedule-day-overrides") return {} as never;
    if (caminho === "/schedules") return schedules as never;
    if (caminho === "/operations")
      return [{ id: OP, name: "Operação Demonstrativa", code: "OP-01" }] as never;
    return [] as never;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

const abrir = () => renderizar(<MonthlySchedulePage />, { rota: "/escalas" });

describe("escalas: a última escala", () => {
  it("mostra o andamento do fluxo, os indicadores e as equipes por turno", async () => {
    respostas();
    abrir();
    const fluxo = within(await screen.findByRole("list", { name: "Andamento da escala" }));
    expect(fluxo.getByText("Rascunho").closest("li")!.getAttribute("aria-current")).toBe("step");
    expect(fluxo.getByText("Publicado").closest("li")!.getAttribute("aria-current")).toBeNull();

    // "Necessário", "Coberto" e "Cobertura" vêm do dimensionamento do QLP (módulo oculto): mesmo
    // com as métricas no resultado da escala, a tela não os mostra.
    const equipes = within(await screen.findByRole("list", { name: "Equipes por turno" }));
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/Necessário|Coberto|Cobertura( de)? ?\d|% de cobertura/);
    expect(screen.queryByRole("img", { name: /Cobertura de/ })).toBeNull();
    expect(equipes.getByText("Diurno Par").parentElement!.textContent).toContain("1");
    expect(equipes.getByText("Noturno Ímpar").parentElement!.textContent).toContain("2");
  });

  it("lista as pendências em uma lista própria", async () => {
    respostas();
    abrir();
    const pendencias = within(await screen.findByRole("region", { name: "Pendências da escala" }));
    expect(pendencias.getByText("Pendências (1)")).toBeTruthy();
    expect(pendencias.getByText("SHIFT_NOT_CONFIGURED")).toBeTruthy();
  });

  it("o fluxo acompanha o status: aprovada marca a terceira etapa", async () => {
    respostas([escala({ status: "APPROVED" })]);
    abrir();
    const fluxo = within(await screen.findByRole("list", { name: "Andamento da escala" }));
    expect(fluxo.getByText("Aprovado").closest("li")!.getAttribute("aria-current")).toBe("step");
    expect(await screen.findByRole("button", { name: "Publicar" })).toBeTruthy();
  });
});

describe("escalas: ações (comportamento preservado)", () => {
  it("Gerar escala chama a API da unidade e do mês e avisa", async () => {
    respostas();
    abrir();
    await screen.findByRole("list", { name: "Andamento da escala" });
    await userEvent.click(screen.getByRole("button", { name: "Gerar escala" }));
    await waitFor(() =>
      expect(pedir).toHaveBeenCalledWith("/employee-schedules/generate", "POST", {
        operationId: OP,
        month: "2026-10"
      })
    );
    expect((await screen.findByRole("status")).textContent).toMatch(/Escala gerada/);
  });

  it("Enviar muda o status por PATCH e confirma", async () => {
    respostas();
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));
    expect(pedir).toHaveBeenCalledWith("/schedules/s1/status", "PATCH", {
      status: "IN_REVIEW",
      reason: "Fluxo manual: IN_REVIEW"
    });
    expect((await screen.findByRole("status")).textContent).toMatch(/Escala/);
  });

  it("clicar numa célula abre o ajuste do dia e salva por POST", async () => {
    respostas();
    abrir();
    await screen.findByRole("list", { name: "Andamento da escala" });
    const celulas = await screen.findAllByRole("button", { name: /Ana Souza, dia 1: D/ });
    await userEvent.click(celulas[0]!);
    const dialogo = within(await screen.findByRole("dialog", { name: "Ajustar dia" }));
    await userEvent.selectOptions(dialogo.getByLabelText(/^Código/), "F");
    await userEvent.click(dialogo.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(pedir).toHaveBeenCalledWith(
        "/schedule-day-overrides",
        "POST",
        expect.objectContaining({ employeeId: "e1", code: "F", operationId: OP })
      )
    );
  });

  it("a célula também abre pelo teclado (Enter) e tem nome acessível com pessoa e dia", async () => {
    respostas();
    abrir();
    await screen.findByRole("list", { name: "Andamento da escala" });
    const celula = (await screen.findAllByRole("button", { name: /Ana Souza, dia 2: F/ }))[0]!;
    celula.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Ajustar dia" })).toBeTruthy();
  });

  it("o interruptor de histórico mostra as versões da unidade", async () => {
    respostas([escala(), escala({ id: "s0", version: 0, createdAt: "2026-09-01T12:00:00.000Z" })]);
    abrir();
    await screen.findByRole("list", { name: "Andamento da escala" });
    expect(screen.queryByText("Histórico de escalas · Operação Demonstrativa")).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: /Histórico/ }));
    expect(await screen.findByText("Histórico de escalas · Operação Demonstrativa")).toBeTruthy();
  });
});

describe("escalas: estados", () => {
  it("sem escalas, explica como começar", async () => {
    respostas([]);
    abrir();
    expect(await screen.findByText("Nenhuma escala por aqui ainda")).toBeTruthy();
    expect(screen.getByText(/Gerar escala/, { selector: "p" })).toBeTruthy();
  });

  it("numa falha, mostra o erro e a nova tentativa recarrega", async () => {
    pedir.mockRejectedValue(new Error("Servidor indisponível"));
    abrir();
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Servidor indisponível");
    respostas();
    await userEvent.click(within(alerta).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("list", { name: "Andamento da escala" })).toBeTruthy();
  });
});
