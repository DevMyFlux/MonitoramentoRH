// @vitest-environment jsdom
// O resultado do teste por cenários e o botão do painel nesse modo.
import type { LabResultadoDosCenarios } from "@my-flux/shared";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { painel } from "../../../test/dados-do-lab";
import { renderizar } from "../../../test/render";
import { AcaoDoPainel } from "./acao-do-painel";
import { ResultadoDosCenarios } from "./resultado-dos-cenarios";

vi.mock("../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks")>()),
  useMinhasContestacoes: () => ({ data: [], isPending: false, isError: false }),
  useContestar: () => ({ mutate: vi.fn(), isPending: false, isError: false })
}));

const reacao = {
  tone: "good" as const,
  title: "Coordenação ciente",
  text: "Você chega com uma proposta.",
  scene: {}
};

const resultado = (extra: Partial<LabResultadoDosCenarios> = {}): LabResultadoDosCenarios => ({
  modo: "cenarios",
  sessaoId: "s1",
  resultadoId: "r1",
  origem: "participante",
  publico: "supervisor-manutencao-adm",
  concluidaEm: "2026-11-24T15:00:00Z",
  statusValidacao: "aguardando_validacao",
  experimental: true,
  aderenciaGeral: 80,
  agilidade: 70,
  resumo: "Você concluiu 1 cenário e cumpriu 4 de 5 decisões (80%).",
  pontoForte: "A coordenação foi avisada a tempo.",
  pontoDesenvolvimento: "Faltou registrar o que foi feito.",
  sugestoes: ["Reveja a decisão: Corrigir o registro."],
  cenarios: [
    {
      ordem: 1,
      titulo: "Checklist de OS incompleto",
      area: "gestao",
      exemplo: true,
      scenePack: "escritorio-gestao",
      versao: 1,
      decisoes: [
        {
          id: "d1",
          label: "Informar a coordenação",
          procedure: "Informar a coordenação.",
          cumpriu: true
        },
        {
          id: "d2",
          label: "Corrigir o registro",
          procedure: "Regularizar o registro.",
          cumpriu: false
        }
      ],
      respostas: [
        {
          perguntaId: "q1",
          prompt: "Qual é a sua primeira ação?",
          alternativa: 1,
          texto: "Levo o relatório à coordenação.",
          reacao,
          tempoMs: 4000
        }
      ],
      desfecho: {
        events: [],
        outcomes: [
          { id: "o1", label: "Registro das OS", nivel: "bad", texto: "As OS seguem incompletas." },
          {
            id: "o2",
            label: "Relação com a equipe",
            nivel: "ok",
            texto: "A equipe se manteve aberta."
          }
        ]
      }
    }
  ],
  ...extra
});

describe("resultado do teste por cenários", () => {
  it("mostra a aderência, a agilidade, o resumo e, por cenário, as saídas e as decisões", () => {
    renderizar(<ResultadoDosCenarios resultado={resultado()} />);
    const numeros = within(screen.getByRole("region", { name: "Números do teste" }));
    expect(numeros.getByText("Aderência geral")).toBeTruthy();
    expect(numeros.getByText("2 de 2 decisões cumpridas".replace("2 de 2", "1 de 2"))).toBeTruthy();
    expect(screen.getByText(/cumpriu 4 de 5 decisões/)).toBeTruthy();
    expect(screen.getByText("A coordenação foi avisada a tempo.")).toBeTruthy();
    const saidas = within(screen.getByRole("list", { name: "Resultados do cenário 1" }));
    // O nível vai em palavras, nunca só em cor.
    expect(saidas.getByText("Crítico")).toBeTruthy();
    expect(saidas.getByText("Adequado")).toBeTruthy();
    expect(screen.getByLabelText("Cumprida")).toBeTruthy();
    expect(screen.getByLabelText("Não cumprida")).toBeTruthy();
    expect(screen.getByText(/Texto de exemplo, ainda em validação/)).toBeTruthy();
  });

  it("avisa que ainda será validado, que é experimental, e deixa contestar por cenário", () => {
    renderizar(<ResultadoDosCenarios resultado={resultado()} />);
    expect(screen.getByText(/ainda será validado pelo RH/)).toBeTruthy();
    expect(screen.getByText("Resultado experimental.")).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Cenário 1: Checklist de OS incompleto" })
    ).toBeTruthy();
  });

  it("resultado interno: avisa que não entra nos números e não oferece contestação", () => {
    renderizar(<ResultadoDosCenarios resultado={resultado({ origem: "interno" })} />);
    expect(screen.getByText("Teste interno.")).toBeTruthy();
    expect(screen.queryByText(/ainda será validado pelo RH/)).toBeNull();
    expect(screen.queryByRole("option", { name: /Cenário 1:/ })).toBeNull();
  });
});

describe("botão do painel no modo por cenários", () => {
  const props = {
    iniciando: false,
    erroAoIniciar: null,
    aoIniciar: vi.fn(),
    modoDoTeste: "cenarios" as const
  };

  it("iniciar: leva à tela do teste (que tem o próprio botão), sem chamar a API do teste da IA", () => {
    const acao = painel().acao;
    renderizar(<AcaoDoPainel acao={acao} {...props} />);
    const link = screen.getByRole("link", { name: /Iniciar teste/ });
    expect(link.getAttribute("href")).toBe("/lab/teste");
    expect(props.aoIniciar).not.toHaveBeenCalled();
    expect(screen.getByText(/sequência de cenários/)).toBeTruthy();
  });

  it("continuar: diz o cenário (não a situação) e o total da trilha", () => {
    const molde = { id: "m1", nivel: "supervisor" as const, nome: "Supervisor" };
    renderizar(
      <AcaoDoPainel
        acao={{
          tipo: "continuar",
          sessaoId: "s1",
          situacaoAtual: 2,
          totalSituacoes: 3,
          molde
        }}
        {...props}
      />
    );
    expect(screen.getByText(/Você está no cenário 2 de 3/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continuar teste/ }).getAttribute("href")).toBe(
      "/lab/teste"
    );
  });

  it("cadastro incompleto: explica o motivo e não oferece o botão", () => {
    renderizar(
      <AcaoDoPainel
        acao={{
          tipo: "indisponivel",
          motivo: "cadastro-incompleto",
          molde: null,
          limiteDiario: null
        }}
        {...props}
      />
    );
    expect(screen.getByText("Seu cadastro está incompleto")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Iniciar teste/ })).toBeNull();
  });
});
