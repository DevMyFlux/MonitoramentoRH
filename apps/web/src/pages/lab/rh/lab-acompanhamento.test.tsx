// @vitest-environment jsdom
// O acompanhamento unificado: visão geral, pessoas, cenários, filtros, exportação e a página de uma pessoa.
import type {
  LabAcompanhamentoCenarios,
  LabAcompanhamentoPessoaDetalhe,
  LabAcompanhamentoPessoas,
  LabAcompanhamentoResumo
} from "@my-flux/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labAcompanhamentoApi } from "../../../features/leadership-lab/acompanhamento-api";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import { pendencias } from "../../../test/dados-da-curadoria";
import { renderizar } from "../../../test/render";
import { LabAcompanhamentoPage } from "./lab-acompanhamento-page";
import { LabAcompanhamentoPessoaPage } from "./lab-acompanhamento-pessoa-page";

vi.mock("../../../features/leadership-lab/acompanhamento-api", async (importar) => ({
  ...(await importar<typeof import("../../../features/leadership-lab/acompanhamento-api")>()),
  labAcompanhamentoApi: {
    resumo: vi.fn(),
    pessoas: vi.fn(),
    pessoa: vi.fn(),
    cenarios: vi.fn(),
    exportar: vi.fn()
  }
}));
vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { pendencias: vi.fn() }
}));

const api = vi.mocked(labAcompanhamentoApi);
const curadoria = vi.mocked(labCuradoriaApi);

const resumo = (extra: Partial<LabAcompanhamentoResumo> = {}): LabAcompanhamentoResumo => ({
  totais: {
    participantes: 12,
    iniciaram: 9,
    emAndamento: 2,
    concluidas: 7,
    aderenciaMedia: 72.5,
    agilidadeMedia: 80,
    contestacoesAbertas: 1
  },
  funil: { cadastrados: 12, iniciaram: 9, concluiram: 7 },
  porTurma: [
    {
      turmaId: "t1",
      nome: "Turma Alfa",
      participantes: 12,
      iniciaram: 9,
      concluiram: 7,
      aderenciaMedia: 72.5
    }
  ],
  porPublico: [{ publico: "rh", sessoes: 9, concluidas: 7, aderenciaMedia: 72.5 }],
  internos: { sessoes: 2, concluidas: 2 },
  opcoes: {
    turmas: [{ id: "t1", nome: "Turma Alfa" }],
    areas: [{ id: "a1", nome: "Manutenção" }]
  },
  ...extra
});

const pessoas = (): LabAcompanhamentoPessoas => ({
  truncado: false,
  pessoas: [
    {
      participanteId: "p1",
      nome: "Ana Souza",
      identificador: "MAT-1",
      cargo: "Supervisora",
      nivel: "supervisor",
      area: "Manutenção",
      turmas: ["Turma Alfa"],
      sessoes: 1,
      concluidas: 1,
      contestacoesAbertas: 1,
      ultima: {
        sessaoId: "s1",
        status: "concluida",
        publico: "rh",
        iniciadaEm: "2026-03-02T10:00:00.000Z",
        concluidaEm: "2026-03-02T10:20:00.000Z",
        aderenciaGeral: 80,
        agilidade: 90,
        experimental: false,
        contestadoDeferido: false
      }
    },
    {
      participanteId: "p2",
      nome: "Bia Lima",
      identificador: "MAT-2",
      cargo: null,
      nivel: null,
      area: null,
      turmas: [],
      sessoes: 0,
      concluidas: 0,
      contestacoesAbertas: 0,
      ultima: null
    }
  ]
});

const cenarios = (): LabAcompanhamentoCenarios => ({
  cenarios: [
    {
      cenarioId: "c1",
      versao: 2,
      slug: "feedback",
      titulo: "Feedback difícil",
      area: "Pessoas",
      publico: "rh",
      vezes: 4,
      pessoas: 3,
      aderenciaMedia: 55,
      decisoes: [
        {
          id: "d1",
          label: "Registrar a conversa",
          vezes: 4,
          descumpridas: 3,
          taxaDeDescumprimento: 75
        },
        {
          id: "d2",
          label: "Ouvir antes de decidir",
          vezes: 4,
          descumpridas: 0,
          taxaDeDescumprimento: 0
        }
      ],
      perguntas: [
        {
          id: "q1",
          prompt: "O que você faz primeiro?",
          alternativas: [
            { indice: 1, texto: "Chamo a pessoa para conversar", escolhas: 3, pct: 75 },
            { indice: 0, texto: "Espero passar", escolhas: 1, pct: 25 }
          ]
        }
      ]
    }
  ]
});

const detalhe = (): LabAcompanhamentoPessoaDetalhe => ({
  pessoa: pessoas().pessoas[0]!,
  comparacao: {
    publico: "rh",
    pessoas: 5,
    aderenciaDaPessoa: 80,
    aderenciaDoGrupo: 60,
    agilidadeDaPessoa: 90,
    agilidadeDoGrupo: 70
  },
  contestacoes: [
    {
      id: "k1",
      resultadoId: "r1",
      ponto: "Cenário 2",
      motivo: "O cliente já tinha sido avisado.",
      status: "em_analise",
      criadoEm: "2026-03-03T10:00:00.000Z",
      decididoEm: null,
      nota: null
    }
  ],
  sessoes: [
    {
      sessaoId: "s1",
      origem: "participante",
      publico: "rh",
      status: "concluida",
      iniciadaEm: "2026-03-02T10:00:00.000Z",
      concluidaEm: "2026-03-02T10:20:00.000Z",
      resultadoId: "r1",
      aderenciaGeral: 80,
      agilidade: 90,
      experimental: false,
      statusValidacao: "aguardando_validacao",
      contestadoDeferido: true,
      cenarios: [
        {
          ordem: 1,
          titulo: "Feedback difícil",
          area: "Pessoas",
          versao: 2,
          exemplo: false,
          status: "concluida",
          iniciadoEm: "2026-03-02T10:00:00.000Z",
          concluidoEm: "2026-03-02T10:10:00.000Z",
          tempoTotalMs: 125000,
          decisoes: [
            { id: "d1", label: "Registrar a conversa", cumpriu: false },
            { id: "d2", label: "Ouvir antes de decidir", cumpriu: true }
          ],
          respostas: [
            {
              perguntaId: "q1",
              prompt: "O que você faz primeiro?",
              alternativa: 1,
              texto: "Chamo a pessoa para conversar",
              tempoMs: 8000
            }
          ],
          desfechos: [{ nivel: "warn", texto: "A conversa ficou sem registro." }]
        }
      ]
    }
  ]
});

beforeEach(() => {
  vi.resetAllMocks();
  curadoria.pendencias.mockResolvedValue(pendencias());
  api.resumo.mockResolvedValue(resumo());
  api.pessoas.mockResolvedValue(pessoas());
  api.cenarios.mockResolvedValue(cenarios());
  api.pessoa.mockResolvedValue(detalhe());
});

const abrir = (rota = "/lab/rh/acompanhamento") =>
  renderizar(<LabAcompanhamentoPage />, { rota, caminho: "/lab/rh/acompanhamento" });

describe("acompanhamento: visão geral", () => {
  it("mostra totais, funil, turmas e públicos, e avisa do que ficou de fora das médias", async () => {
    abrir();
    await screen.findByRole("table", { name: "Resultados por turma" });
    const totais = within(screen.getByRole("region", { name: "Totais" }));
    expect(totais.getByText("Aderência média")).toBeTruthy();
    expect(totais.getByText("72,5%")).toBeTruthy();
    expect(totais.getByText("9 já iniciaram o teste")).toBeTruthy();
    expect(totais.getByText("7")).toBeTruthy();
    const funil = screen.getByText("Funil").closest("section")!;
    expect(within(funil).getByText("Cadastrados")).toBeTruthy();
    expect(within(funil).getByText("58,3% dos cadastrados")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Resultados por turma" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Resultados por público" })).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/Testes internos.*2.*fora das médias/);
  });

  it("os filtros chegam à API (e vão para a URL); limpar volta ao começo", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("table", { name: "Resultados por turma" });
    expect(api.resumo).toHaveBeenLastCalledWith(
      expect.objectContaining({ turmaId: "", publico: "", status: "" })
    );
    await usuario.selectOptions(screen.getByLabelText("Turma"), "t1");
    await waitFor(() =>
      expect(api.resumo).toHaveBeenLastCalledWith(expect.objectContaining({ turmaId: "t1" }))
    );
    await usuario.selectOptions(screen.getByLabelText("Situação"), "concluida");
    await waitFor(() =>
      expect(api.resumo).toHaveBeenLastCalledWith(
        expect.objectContaining({ turmaId: "t1", status: "concluida" })
      )
    );
    await usuario.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() =>
      expect(api.resumo).toHaveBeenLastCalledWith(
        expect.objectContaining({ turmaId: "", status: "" })
      )
    );
  });

  it("o RH sem acesso vê o motivo, não um erro genérico", async () => {
    api.resumo.mockRejectedValue(new ApiError("Sem acesso.", 403, "LAB_FORBIDDEN"));
    abrir();
    await screen.findByText("Esta área não é para o seu perfil");
  });
});

describe("acompanhamento: pessoas", () => {
  it("lista as pessoas com a situação do último teste e leva à página da pessoa", async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(await screen.findByRole("tab", { name: "Pessoas" }));
    const link = await screen.findByRole("link", { name: "Ana Souza" });
    expect(link.getAttribute("href")).toBe("/lab/rh/acompanhamento/pessoas/p1");
    const linha = link.closest("tr")!;
    expect(within(linha).getByText("Concluída")).toBeTruthy();
    expect(within(linha).getByText("80%")).toBeTruthy();
    expect(within(linha).getByText("Supervisor · Manutenção")).toBeTruthy();
    expect(
      within(screen.getByRole("link", { name: "Bia Lima" }).closest("tr")!).getByText("Não iniciou")
    ).toBeTruthy();
  });

  it("avisa quando a lista foi cortada pelo teto", async () => {
    const usuario = userEvent.setup();
    api.pessoas.mockResolvedValue({ ...pessoas(), truncado: true });
    abrir();
    await usuario.click(await screen.findByRole("tab", { name: "Pessoas" }));
    await screen.findByText(/Há mais pessoas do que a lista mostra/);
  });

  it("exportar baixa o CSV com os mesmos filtros da tela", async () => {
    const usuario = userEvent.setup();
    api.exportar.mockResolvedValue(undefined);
    abrir("/lab/rh/acompanhamento?aba=pessoas&turmaId=t1");
    await usuario.click(await screen.findByRole("button", { name: "Exportar sessões (CSV)" }));
    await waitFor(() =>
      expect(api.exportar).toHaveBeenCalledWith(
        expect.objectContaining({ turmaId: "t1" }),
        "sessoes"
      )
    );
  });

  it("se a exportação falhar, mostra o motivo", async () => {
    const usuario = userEvent.setup();
    api.exportar.mockRejectedValue(new Error("Não foi possível exportar. Verifique seu acesso."));
    abrir("/lab/rh/acompanhamento?aba=pessoas");
    await usuario.click(await screen.findByRole("button", { name: "Exportar sessões (CSV)" }));
    await screen.findByText("Não foi possível exportar. Verifique seu acesso.");
  });
});

describe("acompanhamento: cenários", () => {
  it("mostra as decisões mais descumpridas e as alternativas mais escolhidas, por versão", async () => {
    abrir("/lab/rh/acompanhamento?aba=cenarios");
    await screen.findByText("Feedback difícil (versão 2)");
    expect(screen.getByText("Registrar a conversa")).toBeTruthy();
    expect(screen.getByText("75% (3/4)")).toBeTruthy();
    expect(screen.getByText("Chamo a pessoa para conversar")).toBeTruthy();
    expect(screen.getByText("3 (75%)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar cenários (CSV)" })).toBeTruthy();
  });

  it("sem testes no recorte, diz o que aparece aqui", async () => {
    api.cenarios.mockResolvedValue({ cenarios: [] });
    abrir("/lab/rh/acompanhamento?aba=cenarios");
    await screen.findByText("Nenhum cenário feito no recorte");
  });
});

describe("acompanhamento: uma pessoa", () => {
  const abrirPessoa = () =>
    renderizar(<LabAcompanhamentoPessoaPage />, {
      rota: "/lab/rh/acompanhamento/pessoas/p1",
      caminho: "/lab/rh/acompanhamento/pessoas/:participanteId"
    });

  it("mostra a linha do tempo, as decisões, os desfechos, as alternativas e o tempo", async () => {
    const usuario = userEvent.setup();
    abrirPessoa();
    await screen.findByText("Linha do tempo");
    expect(api.pessoa).toHaveBeenCalledWith("p1");
    // O teste anulado fica marcado.
    expect(screen.getByText("Anulado: contestação deferida")).toBeTruthy();
    await usuario.click(screen.getByText(/1\. Feedback difícil/));
    expect(screen.getByText("Não cumpriu")).toBeTruthy();
    expect(screen.getByText("Cumpriu")).toBeTruthy();
    expect(screen.getByText("A conversa ficou sem registro.")).toBeTruthy();
    expect(screen.getByText(/Chamo a pessoa para conversar · 0:08/)).toBeTruthy();
    expect(screen.getByText(/1\/2 decisões/)).toBeTruthy();
  });

  it("compara com o grupo e lista as contestações com o novo nome do estado", async () => {
    abrirPessoa();
    await screen.findByText(/Comparação com o grupo: 5 pessoas/);
    expect(screen.getByText(/Só\s+participantes entram/)).toBeTruthy();
    expect(screen.getByText(/grupo 60%/)).toBeTruthy();
    expect(screen.getByText("Em análise")).toBeTruthy();
    expect(screen.getByText("O cliente já tinha sido avisado.")).toBeTruthy();
  });

  it("sem comparação, explica quando ela aparece", async () => {
    api.pessoa.mockResolvedValue({ ...detalhe(), comparacao: null });
    abrirPessoa();
    await screen.findByText(/Sem comparação com o grupo/);
  });

  it("quem está fora do alcance recebe o aviso de que o registro não existe", async () => {
    api.pessoa.mockRejectedValue(new ApiError("Registro não encontrado.", 404, "LAB_NOT_FOUND"));
    abrirPessoa();
    await screen.findByText("Registro não encontrado");
  });
});
