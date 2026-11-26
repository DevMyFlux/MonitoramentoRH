// @vitest-environment jsdom
// Configuração do teste do Lab: validação ao vivo, importação em lote (relatório por arquivo),
// aprovar em lote, enviar para revisão, regra de público, quantidades e o modo leitura do RH.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUsuarioAtual } from "../../features/auth/use-usuario-atual";
import { apiDosTreinamentos, type CenarioDaLista } from "../../features/treinamentos/api";
import { renderizar } from "../../test/render";
import { TreinamentosConfigPage } from "./config-page";

vi.mock("../../features/auth/use-usuario-atual", () => ({ useUsuarioAtual: vi.fn() }));
vi.mock("../../features/treinamentos/api", () => ({
  apiDosTreinamentos: {
    cenarios: vi.fn(),
    validarCenario: vi.fn(),
    criarCenario: vi.fn(),
    novaVersao: vi.fn(),
    lerVersao: vi.fn(),
    aprovar: vi.fn(),
    turmas: vi.fn(),
    atribuir: vi.fn(),
    importar: vi.fn(),
    enviarParaRevisao: vi.fn(),
    aprovarEmLote: vi.fn(),
    regras: vi.fn(),
    salvarRegras: vi.fn(),
    quantidades: vi.fn(),
    salvarQuantidades: vi.fn()
  }
}));
const api = vi.mocked(apiDosTreinamentos);
const como = (role: string) =>
  vi.mocked(useUsuarioAtual).mockReturnValue({ data: { role } } as never);

const AREA = "11111111-1111-4111-8111-111111111111";
const REGRAS = [
  { nivelGovernanca: null, areaId: AREA, publico: "rh" as const, ativa: true },
  {
    nivelGovernanca: "supervisor" as const,
    areaId: null,
    publico: "supervisor-manutencao-adm" as const,
    ativa: true
  }
];

const cenario = (n: number, extra: Partial<CenarioDaLista> = {}): CenarioDaLista => ({
  id: `c${n}`,
  slug: `cenario-${n}`,
  area: "gestao",
  publico: "rh",
  titulo: `Cenário ${n}`,
  status: "rascunho",
  alteradoEm: "2026-11-20T12:00:00Z",
  versoes: [
    {
      id: `v${n}`,
      numero: 1,
      scenePack: "escritorio-gestao",
      criadoEm: "2026-11-20T12:00:00Z",
      aprovadoEm: null,
      atribuicoes: 0
    }
  ],
  ...extra
});

const arquivoDoPacote = readFileSync(
  resolve(process.cwd(), "../../docs/cenarios-lab/rh-rh-desligamento.json"),
  "utf8"
);

beforeEach(() => {
  vi.resetAllMocks();
  como("ADMIN");
  api.cenarios.mockResolvedValue([
    cenario(1),
    cenario(2, {
      status: "aprovado",
      versoes: [{ ...cenario(2).versoes[0]!, aprovadoEm: "2026-11-21T12:00:00Z" }]
    })
  ]);
  api.regras.mockResolvedValue({ regras: REGRAS, areas: [{ id: AREA, nome: "RH", ativa: true }] });
  api.quantidades.mockResolvedValue({
    padrao: 3,
    itens: [{ publico: "rh", turmaId: null, turma: null, quantidade: 2 }]
  });
  api.turmas.mockResolvedValue([{ id: "t1", nome: "Turma A", curador: "Maria", participantes: 4 }]);
});

describe("lista de cenários", () => {
  it("mostra público, área, status e a última alteração de cada cenário", async () => {
    renderizar(<TreinamentosConfigPage />);
    const c1 = (await screen.findByRole("heading", { name: "Cenário 1" })).closest("article")!;
    expect(within(c1).getByText(/RH · alterado em/)).toBeTruthy();
    expect(within(c1).getAllByText("Rascunho").length).toBeGreaterThan(0);
    const c2 = screen.getByRole("heading", { name: "Cenário 2" }).closest("article")!;
    expect(within(c2).getByText("Aprovado")).toBeTruthy();
  });

  it("enviar para revisão: só o rascunho tem o botão", async () => {
    api.enviarParaRevisao.mockResolvedValue({ id: "c1", status: "em_revisao" });
    renderizar(<TreinamentosConfigPage />);
    const c1 = (await screen.findByRole("heading", { name: "Cenário 1" })).closest("article")!;
    await userEvent.click(within(c1).getByRole("button", { name: "Enviar para revisão" }));
    expect(api.enviarParaRevisao).toHaveBeenCalledWith("c1");
    const c2 = screen.getByRole("heading", { name: "Cenário 2" }).closest("article")!;
    expect(within(c2).queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  });
});

describe("editor com validação ao vivo", () => {
  it("aponta o caminho do problema enquanto digita, sem chamar a API", async () => {
    renderizar(<TreinamentosConfigPage />);
    const campo = await screen.findByLabelText("Conteúdo do cenário (JSON)");
    await userEvent.click(campo);
    await userEvent.paste(JSON.stringify({ slug: "x", title: "T" }));
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getAllByText("summary").length).toBeGreaterThan(0); // um campo obrigatório que falta
    expect(api.validarCenario).not.toHaveBeenCalled();
  });

  it("JSON quebrado: avisa na hora", async () => {
    renderizar(<TreinamentosConfigPage />);
    const campo = await screen.findByLabelText("Conteúdo do cenário (JSON)");
    await userEvent.click(campo);
    await userEvent.paste("{ não é json");
    expect(await screen.findByText("(JSON)", {}, { timeout: 3000 })).toBeTruthy();
  });

  it("cenário no formato do pacote do Lab é aceito ao vivo", async () => {
    renderizar(<TreinamentosConfigPage />);
    const campo = await screen.findByLabelText("Conteúdo do cenário (JSON)");
    await userEvent.click(campo);
    await userEvent.paste(arquivoDoPacote);
    expect(
      await screen.findByText(/O conteúdo segue o formato/, {}, { timeout: 3000 })
    ).toBeTruthy();
  });
});

describe("importar, exportar e aprovar em lote", () => {
  it("importa vários arquivos e mostra o relatório por arquivo, com o caminho dos problemas", async () => {
    api.importar
      .mockResolvedValueOnce({
        criados: 1,
        jaExistem: 0,
        invalidos: 0,
        itens: [{ indice: 0, estado: "criado", slug: "rh-desligamento" }]
      })
      .mockResolvedValueOnce({
        criados: 0,
        jaExistem: 1,
        invalidos: 1,
        itens: [
          { indice: 0, estado: "ja_existe", slug: "ja-tinha" },
          {
            indice: 1,
            estado: "invalido",
            slug: "quebrado",
            problemas: [
              { caminho: "questions.2.alternatives.1.beat.title", mensagem: "Obrigatório" }
            ]
          }
        ]
      });
    renderizar(<TreinamentosConfigPage />);
    const entrada = (await screen.findByLabelText("Arquivos .json")) as HTMLInputElement;
    const bom = new File([arquivoDoPacote], "bom.json", { type: "application/json" });
    const lista = new File(
      [JSON.stringify([{ id: "ja-tinha" }, { id: "quebrado" }])],
      "lista.json",
      { type: "application/json" }
    );
    const ruim = new File(["{ quebrado"], "ruim.json", { type: "application/json" });
    await userEvent.upload(entrada, [bom, lista, ruim]);
    const relatorio = await screen.findByLabelText("Relatório da importação");
    expect(api.importar).toHaveBeenCalledTimes(2); // o arquivo ilegível nem chega à API
    expect(
      within(relatorio).getByText(
        /1 importado\(s\), 1 já existia\(m\), 1 com problema, 1 arquivo\(s\) ilegível\(is\)/
      )
    ).toBeTruthy();
    expect(within(relatorio).getByText("questions.2.alternatives.1.beat.title")).toBeTruthy();
    expect(within(relatorio).getByText(/ruim\.json: /)).toBeTruthy();
    expect(within(relatorio).getByText(/Já existe/)).toBeTruthy();
  });

  it("aprova em lote só as versões ainda sem aprovação dos selecionados, com confirmação", async () => {
    api.aprovarEmLote.mockResolvedValue({ aprovadas: 1, recusadas: 0 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderizar(<TreinamentosConfigPage />);
    await screen.findByRole("heading", { name: "Cenário 1" });
    const lote = screen.getByRole("region", { name: /Importar, exportar e aprovar em lote/ });
    await userEvent.click(within(lote).getByLabelText(/Cenário 1/));
    await userEvent.click(within(lote).getByLabelText(/Cenário 2/)); // já aprovado: não entra
    await userEvent.click(within(lote).getByRole("button", { name: "Aprovar em lote (1)" }));
    expect(api.aprovarEmLote).toHaveBeenCalledWith([{ cenarioId: "c1", versaoId: "v1" }]);
  });

  it("sem confirmação, nada é aprovado", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderizar(<TreinamentosConfigPage />);
    await screen.findByRole("heading", { name: "Cenário 1" });
    const lote = screen.getByRole("region", { name: /Importar, exportar e aprovar em lote/ });
    await userEvent.click(within(lote).getByRole("button", { name: "Marcar os sem aprovação" }));
    await userEvent.click(within(lote).getByRole("button", { name: /Aprovar em lote/ }));
    expect(api.aprovarEmLote).not.toHaveBeenCalled();
  });
});

describe("regra de público e quantidades", () => {
  it("ADMIN edita as regras, acrescenta uma e salva a tabela inteira", async () => {
    api.salvarRegras.mockResolvedValue({ salvas: 3 });
    renderizar(<TreinamentosConfigPage />);
    const regras = await screen.findByRole("region", { name: "Regra de público" });
    await within(regras).findByLabelText("Público da regra 1");
    await userEvent.selectOptions(
      within(regras).getByLabelText("Público da regra 1"),
      "administrativo-geral"
    );
    await userEvent.click(within(regras).getByRole("button", { name: "Adicionar regra" }));
    await userEvent.click(within(regras).getByRole("button", { name: "Salvar regras" }));
    await waitFor(() => expect(api.salvarRegras).toHaveBeenCalledTimes(1));
    const enviadas = api.salvarRegras.mock.calls[0]![0];
    expect(enviadas).toHaveLength(3);
    expect(enviadas[0]).toMatchObject({ areaId: AREA, publico: "administrativo-geral" });
    expect(enviadas[2]).toMatchObject({
      nivelGovernanca: "supervisor",
      areaId: null,
      publico: "rh"
    });
  });

  it("uma regra sem nível nem área é barrada na tela", async () => {
    renderizar(<TreinamentosConfigPage />);
    const regras = await screen.findByRole("region", { name: "Regra de público" });
    await within(regras).findByLabelText("Nível da regra 2");
    await userEvent.selectOptions(within(regras).getByLabelText("Nível da regra 2"), "");
    await userEvent.click(within(regras).getByRole("button", { name: "Salvar regras" }));
    expect(await within(regras).findByRole("alert")).toBeTruthy();
    expect(api.salvarRegras).not.toHaveBeenCalled();
  });

  it("remover e reordenar regras", async () => {
    api.salvarRegras.mockResolvedValue({ salvas: 1 });
    renderizar(<TreinamentosConfigPage />);
    const regras = await screen.findByRole("region", { name: "Regra de público" });
    await within(regras).findByRole("button", { name: "Descer a regra 1" });
    await userEvent.click(within(regras).getByRole("button", { name: "Descer a regra 1" }));
    expect((within(regras).getByLabelText("Público da regra 1") as HTMLSelectElement).value).toBe(
      "supervisor-manutencao-adm"
    );
    await userEvent.click(within(regras).getByRole("button", { name: "Remover a regra 2" }));
    await userEvent.click(within(regras).getByRole("button", { name: "Salvar regras" }));
    await waitFor(() => expect(api.salvarRegras).toHaveBeenCalled());
    expect(api.salvarRegras.mock.calls[0]![0]).toEqual([REGRAS[1]]);
  });

  it("quantidades: acrescenta uma por turma e salva", async () => {
    api.salvarQuantidades.mockResolvedValue({ salvas: 2 });
    renderizar(<TreinamentosConfigPage />);
    const q = await screen.findByRole("region", { name: "Quantos cenários compõem o teste" });
    await within(q).findByRole("button", { name: "Adicionar quantidade" });
    await userEvent.click(within(q).getByRole("button", { name: "Adicionar quantidade" }));
    await userEvent.selectOptions(within(q).getByLabelText("Turma da quantidade 2"), "t1");
    const campo = within(q).getByLabelText("Quantidade 2");
    await userEvent.clear(campo);
    await userEvent.type(campo, "1");
    await userEvent.click(within(q).getByRole("button", { name: "Salvar quantidades" }));
    await waitFor(() => expect(api.salvarQuantidades).toHaveBeenCalled());
    expect(api.salvarQuantidades.mock.calls[0]![0]).toEqual([
      { publico: "rh", turmaId: null, quantidade: 2 },
      { publico: "rh", turmaId: "t1", quantidade: 1 }
    ]);
  });
});

describe("o RH só lê", () => {
  beforeEach(() => como("RH"));

  it("vê a lista, as regras e as quantidades; não vê editor, importação, aprovação nem botões de salvar", async () => {
    renderizar(<TreinamentosConfigPage />);
    expect(await screen.findByRole("heading", { name: "Cenário 1" })).toBeTruthy();
    expect(screen.queryByLabelText("Conteúdo do cenário (JSON)")).toBeNull();
    expect(
      screen.queryByRole("region", { name: /Importar, exportar e aprovar em lote/ })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
    const regras = screen.getByRole("region", { name: "Regra de público" });
    expect(within(regras).getByText(/Só ADMIN e DEV editam/)).toBeTruthy();
    expect(within(regras).queryByRole("button", { name: "Salvar regras" })).toBeNull();
    expect(within(regras).queryByLabelText("Público da regra 1")).toBeNull();
    const q = screen.getByRole("region", { name: "Quantos cenários compõem o teste" });
    expect(within(q).queryByRole("button", { name: "Salvar quantidades" })).toBeNull();
    // Pode pré-visualizar.
    expect(screen.getAllByRole("button", { name: "Pré-visualizar" }).length).toBeGreaterThan(0);
  });
});
