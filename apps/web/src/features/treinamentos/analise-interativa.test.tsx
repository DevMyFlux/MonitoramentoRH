// @vitest-environment jsdom
// A análise interativa: "e se?" pelo servidor, voltar à escolha, cadeia de causas, lista e curador.
import { evaluate, treinoCenarioSchema } from "@my-flux/shared";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnaliseInterativa } from "./analise-interativa";
import { apiDosTreinamentos, type ResultadoDaTentativa } from "./api";

vi.mock("./api", () => ({ apiDosTreinamentos: { simular: vi.fn() } }));
const simular = vi.mocked(apiDosTreinamentos.simular);

const cenario = treinoCenarioSchema.parse(
  JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        "../../packages/shared/src/treinamentos/exemplos/manutencao-quadro-uti.json"
      ),
      "utf8"
    )
  )
);
// A tentativa: tudo certo, menos medir (arco contido pelo EPI).
const decisoes = Object.fromEntries(cenario.decisions.map((d) => [d.id, d.id !== "medir"]));

function resultado(acesso: "dono" | "curador"): ResultadoDaTentativa {
  return {
    tentativaId: "t1",
    atribuicaoId: "a1",
    acesso,
    turma: "Turma A",
    iniciadaEm: "2026-11-24T12:00:00Z",
    concluidaEm: "2026-11-24T12:10:00Z",
    cenario: {
      titulo: cenario.title,
      area: cenario.area,
      exemplo: true,
      scenePack: cenario.scenePack,
      versao: 1
    },
    decisoes: cenario.decisions.map((d) => ({
      id: d.id,
      label: d.label,
      procedure: d.procedure,
      cumpriu: decisoes[d.id]!
    })),
    respostas: [],
    desfecho: evaluate(cenario, decisoes),
    regras: {
      events: cenario.events.map((e) => ({
        id: e.id,
        label: e.label,
        tone: e.tone,
        when: e.when,
        scene: e.scene
      })),
      outcomes: cenario.outcomes.map((o) => ({
        id: o.id,
        label: o.label,
        levels: o.levels,
        when: o.when
      }))
    },
    validacao: { validada: false, validadaEm: null, nota: null }
  };
}

const abrir = (acesso: "dono" | "curador" = "dono") =>
  render(
    <MemoryRouter>
      <AnaliseInterativa resultado={resultado(acesso)} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  // O "servidor" responde com o mesmo motor puro (a API usa exatamente esta função).
  simular.mockImplementation(async (_id, d) => evaluate(cenario, d));
});
afterEach(() => cleanup());

const tecnico = () => screen.getByRole("button", { name: /Integridade do técnico/ });

describe("análise interativa", () => {
  it("mostra o desfecho da tentativa: técnico em atenção, com o arco aconteceu", () => {
    abrir();
    expect(within(tecnico()).getByText(/Atenção/)).toBeTruthy();
    expect(within(tecnico()).getByText("Incidente contido")).toBeTruthy();
    expect(
      within(screen.getByRole("button", { name: /Arco elétrico/ })).getByText("Aconteceu")
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Voltar à minha escolha" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("e se?: trocar uma decisão pede o desfecho ao servidor e marca o que mudou", async () => {
    abrir();
    await userEvent.click(
      screen.getByRole("button", { name: /Medir a ausência de tensão: não cumprida/ })
    );
    expect(simular).toHaveBeenCalledWith("t1", { ...decisoes, medir: true });
    await waitFor(() => expect(within(tecnico()).getByText("Sem lesão")).toBeTruthy());
    expect(within(tecnico()).getByText("mudou")).toBeTruthy();
    expect(screen.getByText(/nada disso foi gravado/)).toBeTruthy();
    expect(screen.getByText(/Simulação: Integridade do técnico: Bom, Sem lesão/)).toBeTruthy();

    // Voltar à escolha: o retrato gravado volta, sem nova chamada.
    await userEvent.click(screen.getByRole("button", { name: "Voltar à minha escolha" }));
    expect(simular).toHaveBeenCalledTimes(1);
    expect(within(tecnico()).getByText("Incidente contido")).toBeTruthy();
  });

  it("clicar num resultado mostra por que ele aconteceu", async () => {
    abrir();
    await userEvent.click(tecnico());
    expect(tecnico().getAttribute("aria-pressed")).toBe("true");
    const porque = screen.getByText("Por que “Integridade do técnico”?").parentElement!;
    // Atenção: o arco impediu o "ok"; a lesão não ter acontecido evitou o "ruim".
    expect(within(porque).getByText("“Arco elétrico no quadro” aconteceu")).toBeTruthy();
    expect(within(porque).getByText("“Lesão por arco” não aconteceu")).toBeTruthy();
  });

  it("a mesma análise em lista, com o 'e se?' em botões", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: "Ver como lista" }));
    expect(
      screen.getAllByText("“Medir a ausência de tensão” não foi cumprida").length
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "E se eu tivesse cumprido?" }));
    expect(simular).toHaveBeenCalledWith("t1", { ...decisoes, medir: true });
  });

  it("o curador lê a análise, mas não simula", async () => {
    abrir("curador");
    expect(screen.queryByRole("button", { name: "Voltar à minha escolha" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Refazer/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Medir a ausência de tensão/ }));
    expect(simular).not.toHaveBeenCalled();
  });
});
