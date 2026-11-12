// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labApi } from "../../features/leadership-lab/api";
import { ApiError } from "../../features/my-flux/client";
import { resultado } from "../../test/dados-do-lab";
import { renderizar } from "../../test/render";
import { LabResultadoPage } from "./lab-resultado-page";

// O React Flow precisa de layout de verdade; o mapa tem testes próprios nos dados que monta.
vi.mock("../../features/leadership-lab/componentes/mapa-de-decisoes", () => ({
  MapaDeDecisoes: ({ situacoes }: { situacoes: unknown[] }) => (
    <div data-testid="mapa">{situacoes.length} situações</div>
  )
}));

vi.mock("../../features/leadership-lab/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../features/leadership-lab/api")>();
  return {
    ...original,
    labApi: {
      painel: vi.fn(),
      aceitarTermo: vi.fn(),
      iniciarTeste: vi.fn(),
      testeEmAndamento: vi.fn(),
      responder: vi.fn(),
      tempoEsgotado: vi.fn(),
      resultado: vi.fn()
    }
  };
});

// A contestação tem a sua própria bateria de testes (contestar-resultado.test.tsx); aqui ela só
// precisa existir, sem contestações anteriores.
vi.mock("../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { minhasContestacoes: vi.fn().mockResolvedValue([]), contestar: vi.fn() }
}));

const api = vi.mocked(labApi);

/** O item da situação na lista de escolhas (o seletor da contestação também diz "Situação N"). */
const itemDaSituacao = async (numero: number) =>
  (await screen.findAllByText(`Situação ${numero}`)).map((e) => e.closest("li")).find((li) => li)!;
const abrir = () =>
  renderizar(<LabResultadoPage />, {
    rota: "/lab/resultado/sessao-1",
    caminho: "/lab/resultado/:sessaoId"
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("tela de resultado", () => {
  it("pede o resultado da sessão que está no endereço", async () => {
    api.resultado.mockResolvedValue(resultado());
    abrir();
    await screen.findByRole("heading", { name: "Resultado do teste" });
    expect(api.resultado).toHaveBeenCalledWith("sessao-1");
  });

  it("aguardando validação: selo e aviso de que só depois o resultado vira histórico oficial", async () => {
    api.resultado.mockResolvedValue(resultado({ statusValidacao: "aguardando_validacao" }));
    abrir();
    await screen.findByRole("note");
    expect(screen.getByRole("note").textContent).toContain("ainda será validado pelo RH");
    expect(screen.getAllByText("Aguardando validação").length).toBeGreaterThan(0);
  });

  it("resultado experimental: avisa que não vale como avaliação oficial", async () => {
    api.resultado.mockResolvedValue(resultado({ experimental: true }));
    abrir();
    expect(
      (await screen.findByText("Resultado experimental.")).closest("[role=note]")
    ).toBeTruthy();
  });

  it("resultado com base validada: sem o aviso de experimental", async () => {
    api.resultado.mockResolvedValue(resultado({ experimental: false }));
    abrir();
    await screen.findByText("Aderência geral");
    expect(screen.queryByText("Resultado experimental.")).toBeNull();
  });

  it("validado pelo RH: selo de validado e sem o aviso", async () => {
    api.resultado.mockResolvedValue(resultado({ statusValidacao: "validado" }));
    abrir();
    await screen.findByText("Validado");
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText("Aguardando validação")).toBeNull();
  });

  it("validado com ajuste do RH", async () => {
    api.resultado.mockResolvedValue(resultado({ statusValidacao: "ajustado" }));
    abrir();
    await screen.findByText("Validado com ajuste");
  });

  it("mostra aderência geral, agilidade e quantidade de situações, em português", async () => {
    api.resultado.mockResolvedValue(resultado({ aderenciaGeral: 76, agilidade: 88.33 }));
    abrir();
    const numeros = await screen.findByRole("region", { name: "Números do teste" });
    expect(within(numeros).getByText("76%")).toBeTruthy();
    expect(within(numeros).getByText("88,3%")).toBeTruthy();
    expect(within(numeros).getByText("5")).toBeTruthy();
  });

  it("mostra o resumo, o ponto forte e o ponto de desenvolvimento", async () => {
    api.resultado.mockResolvedValue(resultado());
    abrir();
    await screen.findByText("Você conduziu o turno com atenção.");
    expect(screen.getByText("Comunicação.")).toBeTruthy();
    expect(screen.getByText("Registrar as decisões.")).toBeTruthy();
  });

  it("sem ponto forte ou de desenvolvimento, esses blocos não aparecem", async () => {
    api.resultado.mockResolvedValue(resultado({ pontoForte: null, pontoDesenvolvimento: null }));
    abrir();
    await screen.findByText("Resumo");
    expect(screen.queryByText("Ponto forte")).toBeNull();
    expect(screen.queryByText("Ponto de desenvolvimento")).toBeNull();
  });

  it("nível por skill: nome, tipo, nível e em quantas escolhas se baseia", async () => {
    api.resultado.mockResolvedValue(resultado());
    abrir();
    const linha = (await screen.findByText("Gestão de OS e prioridades")).closest("li")!;
    expect(within(linha).getByText("Hard skill · 2 escolhas")).toBeTruthy();
    expect(within(linha).getByText("Nível 4 de 5")).toBeTruthy();
  });

  it("cada situação: o texto, a opção escolhida, a aderência, a justificativa e a consequência", async () => {
    api.resultado.mockResolvedValue(resultado());
    abrir();
    const situacao1 = await itemDaSituacao(1);
    expect(within(situacao1).getByText("Aderência 100%")).toBeTruthy();
    expect(within(situacao1).getByText("Opção A da situação 1.")).toBeTruthy();
    expect(within(situacao1).getByText("Justificativa 1.")).toBeTruthy();
    expect(within(situacao1).getByText("Consequência 1.")).toBeTruthy();
    expect(within(situacao1).getByText("respondeu em 8 s")).toBeTruthy();
    // O marco é a situação 3.
    expect(within(await itemDaSituacao(3)).getByText("Marco")).toBeTruthy();
    expect(within(situacao1).queryByText("Marco")).toBeNull();
  });

  it("situação sem resposta (tempo esgotado): diz isso, sem inventar escolha nem tempo", async () => {
    const base = resultado();
    api.resultado.mockResolvedValue(
      resultado({
        situacoes: base.situacoes.map((s) =>
          s.numero === 2
            ? { ...s, escolha: null, tempoEsgotado: true, aderencia: 0, tempoRespostaMs: null }
            : s
        )
      })
    );
    abrir();
    const situacao2 = await itemDaSituacao(2);
    expect(within(situacao2).getByText("Sem resposta: o tempo acabou.")).toBeTruthy();
    expect(within(situacao2).getByText("Aderência 0%")).toBeTruthy();
    expect(within(situacao2).queryByText(/respondeu em/)).toBeNull();
  });

  it("sugestões aparecem só se houver", async () => {
    api.resultado.mockResolvedValue(resultado({ sugestoes: [] }));
    abrir();
    await screen.findByText("Resumo");
    expect(screen.queryByText("Sugestões para você")).toBeNull();
  });

  it("o resultado de um teste que ainda não terminou não é mostrado", async () => {
    api.resultado.mockRejectedValue(new ApiError("x", 409, "LAB_TESTE_EM_ANDAMENTO"));
    abrir();
    await screen.findByText("O resultado ainda não está disponível");
  });

  it("teste que não existe ou é de outra pessoa: mesma resposta, com a volta ao painel", async () => {
    api.resultado.mockRejectedValue(new ApiError("x", 404, "LAB_NOT_FOUND"));
    abrir();
    await screen.findByText("Não encontramos este teste");
    expect(screen.getByRole("link", { name: /Voltar ao painel/ }).getAttribute("href")).toBe(
      "/lab"
    );
  });

  it("falha passageira: oferece tentar de novo", async () => {
    api.resultado.mockRejectedValue(new TypeError("Failed to fetch"));
    abrir();
    await screen.findByText("Sem conexão com o servidor");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });
  describe("o nível validado pelo RH", () => {
    const comNivel = (nivel: number, nivelValidado: number | null) =>
      resultado({
        statusValidacao: nivelValidado === null ? "aguardando_validacao" : "ajustado",
        niveisPorSkill: [
          {
            skillId: "gestao-os",
            nome: "Gestão de OS e prioridades",
            tipo: "hard",
            nivel,
            media: 85,
            nEvidencias: 2,
            nivelValidado
          }
        ]
      });

    it("antes da validação, vale o nível calculado, sem nota de ajuste", async () => {
      api.resultado.mockResolvedValue(comNivel(4, null));
      abrir();
      await screen.findByText("Gestão de OS e prioridades");
      expect(screen.getByText("Nível 4 de 5")).toBeTruthy();
      expect(screen.getByText("4/5")).toBeTruthy();
      expect(screen.queryByText(/ajustado pelo RH/)).toBeNull();
    });

    it("validado sem mudar o nível: o mesmo nível, sem nota de ajuste", async () => {
      api.resultado.mockResolvedValue(comNivel(4, 4));
      abrir();
      await screen.findByText("Gestão de OS e prioridades");
      expect(screen.getByText("Nível 4 de 5")).toBeTruthy();
      expect(screen.queryByText(/ajustado pelo RH/)).toBeNull();
    });

    it("ajustado: vale o nível do RH, e diz qual era o calculado", async () => {
      api.resultado.mockResolvedValue(comNivel(4, 3));
      abrir();
      await screen.findByText("Gestão de OS e prioridades");
      expect(screen.getByText("Nível 3 de 5")).toBeTruthy();
      expect(screen.getByText("3/5")).toBeTruthy();
      expect(screen.getByText("Calculado: 4/5 · ajustado pelo RH na validação")).toBeTruthy();
    });
  });
});
