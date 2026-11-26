// @vitest-environment jsdom
// Fase 8: configuração (validar, problemas por caminho, salvar), curadoria do RH (validar, 409) e
// o pacote de cena do cenário de RH.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { ApiError } from "../../features/my-flux/client";
import { apiDosTreinamentos } from "../../features/treinamentos/api";
import { renderizar } from "../../test/render";
import { TreinamentosConfigPage } from "./config-page";
import { TreinamentosRhPage } from "./rh-page";

vi.mock("../../features/auth/use-usuario-atual", () => ({ useUsuarioAtual: vi.fn() }));
vi.mock("../../features/treinamentos/api", () => ({
  apiDosTreinamentos: {
    regras: vi.fn(),
    quantidades: vi.fn(),
    importar: vi.fn(),
    enviarParaRevisao: vi.fn(),
    aprovarEmLote: vi.fn(),
    salvarRegras: vi.fn(),
    salvarQuantidades: vi.fn(),
    cenarios: vi.fn(),
    validarCenario: vi.fn(),
    criarCenario: vi.fn(),
    novaVersao: vi.fn(),
    lerVersao: vi.fn(),
    aprovar: vi.fn(),
    turmas: vi.fn(),
    atribuir: vi.fn(),
    tentativasDoRh: vi.fn(),
    validarTentativa: vi.fn()
  }
}));
const api = vi.mocked(apiDosTreinamentos);
const plantao = readFileSync(
  resolve(
    process.cwd(),
    "../../packages/shared/src/treinamentos/exemplos/rh-falta-plantao-noturno.json"
  ),
  "utf8"
);

beforeEach(() => {
  vi.resetAllMocks();
  // A configuração é de ADMIN e DEV (o RH só lê): estes testes usam o ADMIN.
  vi.mocked(useUsuarioAtual).mockReturnValue({ data: { role: "ADMIN" } } as never);
  api.regras.mockResolvedValue({ regras: [], areas: [] });
  api.quantidades.mockResolvedValue({ padrao: 3, itens: [] });
  api.turmas.mockResolvedValue([]);
});

/** userEvent.type interpreta { e [ como teclas especiais; para JSON, cola o texto. */
async function colar(campo: HTMLElement, texto: string) {
  await userEvent.click(campo);
  await userEvent.paste(texto);
}

describe("configuração de treinamentos", () => {
  it("JSON quebrado é avisado na tela, sem chamar a API", async () => {
    api.cenarios.mockResolvedValue([]);
    renderizar(<TreinamentosConfigPage />);
    await colar(screen.getByLabelText("Conteúdo do cenário (JSON)"), "{ isto não é json");
    await userEvent.click(screen.getByRole("button", { name: "Validar" }));
    expect(screen.getByText(/JSON inválido/)).toBeTruthy();
    expect(api.validarCenario).not.toHaveBeenCalled();
  });

  it("mostra os problemas de autoria no caminho exato", async () => {
    api.cenarios.mockResolvedValue([]);
    api.validarCenario.mockResolvedValue({
      valido: false,
      problemas: [
        {
          caminho: "questions.0.alternatives.1.beat.tone",
          mensagem: "Alternativa que cumpre a decisão não pode ter tom 'bad'."
        }
      ]
    });
    renderizar(<TreinamentosConfigPage />);
    await colar(screen.getByLabelText("Conteúdo do cenário (JSON)"), plantao);
    await userEvent.click(screen.getByRole("button", { name: "Validar" }));
    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("questions.0.alternatives.1.beat.tone")).toBeTruthy();
    expect(within(alerta).getByText(/não pode ter tom 'bad'/)).toBeTruthy();
  });

  it("cenário válido: resumo, pré-visualização no Palco do pacote de RH e salvar como novo", async () => {
    api.cenarios.mockResolvedValue([]);
    api.validarCenario.mockResolvedValue({
      valido: true,
      problemas: [],
      resumo: {
        slug: "rh-falta-plantao-noturno",
        titulo: "Falta no plantão noturno",
        area: "rh",
        scenePack: "hospital-escala",
        exemplo: true,
        decisoes: 5,
        acontecimentos: 5,
        resultados: 3
      }
    });
    api.criarCenario.mockResolvedValue({
      id: "c1",
      slug: "rh-falta-plantao-noturno",
      versaoId: "v1",
      numero: 1
    });
    renderizar(<TreinamentosConfigPage />);
    await colar(screen.getByLabelText("Conteúdo do cenário (JSON)"), plantao);
    await userEvent.click(screen.getByRole("button", { name: "Validar" }));
    expect(await screen.findByText(/Cenário válido: Falta no plantão noturno/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Pré-visualizar" }));
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Sala de gestão da escala/);
    await userEvent.click(screen.getByRole("tab", { name: "Pergunta 4" }));
    await userEvent.click(
      screen.getByRole("button", { name: /Registro a troca no sistema, com o motivo/ })
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
      /mostra o substituto no posto/
    );
    expect(screen.getByText(/Troca registrada\./)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.criarCenario).toHaveBeenCalledTimes(1));
    expect(api.criarCenario.mock.calls[0]![0]).toMatchObject({ slug: "rh-falta-plantao-noturno" });
  });
});

describe("acompanhamento do RH", () => {
  const tentativa = {
    tentativaId: "t1",
    atribuicaoId: "a1",
    participante: "Ana Souza",
    turma: "Turma A",
    titulo: "Quadro elétrico da UTI",
    area: "manutencao",
    concluidaEm: "2026-11-24T13:00:00Z",
    resultados: [{ id: "tecnico", label: "Integridade do técnico", nivel: "warn" as const }],
    validada: false
  };

  it("lista com o resultado em palavra e ícone, e valida com nota", async () => {
    api.tentativasDoRh.mockResolvedValue([tentativa]);
    api.validarTentativa.mockResolvedValue({
      tentativaId: "t1",
      validadaEm: "x",
      nota: "Bom trabalho"
    });
    renderizar(<TreinamentosRhPage />);
    expect(await screen.findByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("Integridade do técnico: Atenção")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver resultado/ }).getAttribute("href")).toBe(
      "/treinamentos/resultado/t1"
    );
    await userEvent.click(screen.getByRole("button", { name: /^Validar/ }));
    await userEvent.type(screen.getByLabelText(/Nota para a pessoa/), "Bom trabalho");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar validação" }));
    await waitFor(() => expect(api.validarTentativa).toHaveBeenCalledWith("t1", "Bom trabalho"));
    expect(api.tentativasDoRh).toHaveBeenCalledWith("pendentes");
  });

  it("se outro curador validou antes, avisa e atualiza a lista", async () => {
    api.tentativasDoRh.mockResolvedValue([tentativa]);
    api.validarTentativa.mockRejectedValue(
      new ApiError("Esta tentativa já foi validada.", 409, "TREINO_JA_VALIDADA", {})
    );
    renderizar(<TreinamentosRhPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Validar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar validação" }));
    expect(await screen.findByText(/Outro curador já validou/)).toBeTruthy();
    await waitFor(() => expect(api.tentativasDoRh.mock.calls.length).toBeGreaterThan(1));
  });

  it("sem nada a validar, explica de onde vêm as tentativas", async () => {
    api.tentativasDoRh.mockResolvedValue([]);
    renderizar(<TreinamentosRhPage />);
    expect(await screen.findByText("Nada a validar agora")).toBeTruthy();
  });
});
