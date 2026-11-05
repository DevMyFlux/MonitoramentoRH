// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderizar } from "../../../test/render";
import { labApi } from "../api";
import { EscolhaDoProblema } from "./escolha-do-problema";
import { AvatarFacilitador } from "./avatar-facilitador";
import { render } from "@testing-library/react";

vi.mock("../api", async (orig) => ({
  ...(await orig<typeof import("../api")>()),
  labApi: { temasSimulados: vi.fn(), classificarProblema: vi.fn() }
}));
const api = vi.mocked(labApi);

const tema = (id: string, nome: string) => ({
  id,
  nome,
  descricao: `Sobre ${nome}.`,
  exemplos: []
});
const clima = tema("climatizacao-ventilacao", "Climatização e ventilação");
const gases = tema("gases-medicinais-alarmes", "Gases medicinais e alarmes");

function abrir() {
  const aoIniciar = vi.fn();
  renderizar(
    <EscolhaDoProblema
      molde="Supervisor"
      iniciando={false}
      erroAoIniciar={null}
      aoIniciar={aoIniciar}
    />
  );
  return { aoIniciar, u: userEvent.setup() };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.temasSimulados.mockResolvedValue({ temas: [clima, gases] });
});

describe("EscolhaDoProblema", () => {
  it("tema encontrado: propõe e inicia com o id do tema", async () => {
    api.classificarProblema.mockResolvedValue({ resultado: "encontrado", tema: clima });
    const { aoIniciar, u } = abrir();
    await u.type(screen.getByLabelText("Descreva o problema"), "problema no ar-condicionado");
    await u.click(screen.getByRole("button", { name: "Buscar simulação" }));
    await u.click(await screen.findByRole("button", { name: /Iniciar: Climatização/ }));
    expect(aoIniciar).toHaveBeenCalledWith("climatizacao-ventilacao");
    expect(api.classificarProblema).toHaveBeenCalledWith({
      descricao: "problema no ar-condicionado"
    });
  });

  it("ambíguo: mostra só as sugestões", async () => {
    api.classificarProblema.mockResolvedValue({ resultado: "ambiguo", sugestoes: [clima, gases] });
    const { u } = abrir();
    await u.type(screen.getByLabelText("Descreva o problema"), "ar e gás");
    await u.click(screen.getByRole("button", { name: "Buscar simulação" }));
    expect(await screen.findAllByRole("button", { pressed: false })).toHaveLength(2);
  });

  it("sem correspondência: avisa e oferece a escolha manual", async () => {
    api.classificarProblema.mockResolvedValue({
      resultado: "sem-correspondencia",
      sugestoes: [clima, gases]
    });
    const { aoIniciar, u } = abrir();
    await u.type(screen.getByLabelText("Descreva o problema"), "café acabou");
    await u.click(screen.getByRole("button", { name: "Buscar simulação" }));
    await screen.findByText(/Não reconhecemos um tema/);
    await u.click(screen.getByRole("button", { name: /Gases medicinais/ }));
    await u.click(screen.getByRole("button", { name: /Iniciar: Gases/ }));
    expect(aoIniciar).toHaveBeenCalledWith("gases-medicinais-alarmes");
  });

  it("não busca texto curto e não inicia sem tema; a demonstração geral não leva tema", async () => {
    const { aoIniciar, u } = abrir();
    await u.type(screen.getByLabelText("Descreva o problema"), "ar");
    expect(
      (screen.getByRole("button", { name: "Buscar simulação" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Iniciar simulação" }) as HTMLButtonElement).disabled
    ).toBe(true);
    await u.click(screen.getByRole("button", { name: "Fazer a demonstração geral" }));
    expect(aoIniciar).toHaveBeenCalledWith();
  });

  it("escolher da lista, sem digitar nada", async () => {
    const { aoIniciar, u } = abrir();
    await u.click(await screen.findByRole("button", { name: "Escolher um tema da lista" }));
    await u.click(screen.getByRole("button", { name: /Climatização/ }));
    await u.click(screen.getByRole("button", { name: /Iniciar: Climatização/ }));
    expect(aoIniciar).toHaveBeenCalledWith("climatizacao-ventilacao");
  });
});

describe("AvatarFacilitador", () => {
  it.each(["falando", "ouvindo", "refletindo", "feedback"] as const)(
    "estado %s em texto",
    (estado) => {
      render(<AvatarFacilitador estado={estado} />);
      expect(screen.getByRole("img").getAttribute("data-estado")).toBe(estado);
      expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/^Facilitador, /);
    }
  );
});
