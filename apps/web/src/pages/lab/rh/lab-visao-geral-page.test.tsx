// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCadastroApi } from "../../../features/leadership-lab/cadastro-api";
import { labCuradoriaApi } from "../../../features/leadership-lab/curadoria-api";
import { ApiError } from "../../../features/my-flux/client";
import { itemDaRevisao, participanteResumido, pendencias } from "../../../test/dados-da-curadoria";
import { participante, turma } from "../../../test/dados-do-cadastro";
import { renderizar } from "../../../test/render";
import { LabVisaoGeralPage } from "./lab-visao-geral-page";

vi.mock("../../../features/leadership-lab/curadoria-api", () => ({
  labCuradoriaApi: { pendencias: vi.fn(), revisao: vi.fn() }
}));
vi.mock("../../../features/leadership-lab/cadastro-api", () => ({
  labCadastroApi: { participantes: vi.fn(), turmas: vi.fn(), turma: vi.fn() }
}));
// O gráfico (Recharts) é desenho; aqui interessa o que a tela entrega a ele.
vi.mock("../../../features/leadership-lab/componentes/graficos", () => ({
  DistribuicaoDeAderencia: ({ faixas }: { faixas: { faixa: string; resultados: number }[] }) => (
    <p data-testid="distribuicao">{faixas.map((f) => `${f.faixa}=${f.resultados}`).join(" ")}</p>
  ),
  TendenciaDosResultados: ({ pontos }: { pontos: { chave: string; resultados: number }[] }) => (
    <p data-testid="tendencia">{pontos.map((p) => `${p.chave}=${p.resultados}`).join(" ")}</p>
  )
}));

const curadoria = vi.mocked(labCuradoriaApi);
const cadastro = vi.mocked(labCadastroApi);
const abrir = () => renderizar(<LabVisaoGeralPage />, { rota: "/lab/rh/visao-geral" });
const cartao = (rotulo: string) => screen.getByText(rotulo).closest("a")!;

beforeEach(() => {
  vi.resetAllMocks();
  curadoria.pendencias.mockResolvedValue(
    pendencias({ resultadosAguardando: 3, alertasAbertos: 1 })
  );
  curadoria.revisao.mockResolvedValue([]);
  cadastro.participantes.mockResolvedValue([
    participante({ id: "p1" }),
    participante({ id: "p2", ativo: false })
  ]);
  cadastro.turmas.mockResolvedValue([turma({ id: "t1" })]);
});

describe("visão geral do acompanhamento (RH)", () => {
  it("mostra as pendências reais, cada uma levando à aba que a trata", async () => {
    abrir();
    await within(cartao("Resultados a validar")).findByText("3");
    expect(cartao("Resultados a validar").getAttribute("href")).toBe("/lab/rh/revisao");
    expect(within(cartao("Alertas abertos")).getByText("1")).toBeTruthy();
    expect(cartao("Alertas abertos").getAttribute("href")).toBe("/lab/rh/alertas");
    expect(within(cartao("Contestações pendentes")).getByText("0")).toBeTruthy();
    expect(
      within(cartao("Contestações pendentes")).getByText("Nenhuma contestação pendente")
    ).toBeTruthy();
    expect(cartao("Contribuições pendentes").getAttribute("href")).toBe("/lab/rh/contribuicoes");
  });

  it("se as pendências não chegam, mostra traço e diz que não carregou (nunca zero)", async () => {
    curadoria.pendencias.mockRejectedValue(new ApiError("falhou", 500));
    abrir();
    await within(cartao("Resultados a validar")).findByText("Não foi possível carregar agora");
    expect(within(cartao("Resultados a validar")).getByText("—")).toBeTruthy();
  });

  const doisResultados = () =>
    curadoria.revisao.mockResolvedValue([
      itemDaRevisao({
        resultadoId: "r1",
        aderenciaGeral: 80,
        agilidade: 90,
        statusValidacao: "validado"
      }),
      itemDaRevisao({
        resultadoId: "r2",
        aderenciaGeral: 60,
        agilidade: 70,
        moldeNome: "Coordenador",
        participante: participanteResumido({ id: "p2", nome: "Bruno Lima" })
      })
    ]);
  const indicador = (rotulo: string) => screen.getByText(rotulo).parentElement!;

  it("pede todos os resultados do escopo do curador e resume o que veio", async () => {
    doisResultados();
    abrir();
    await screen.findByRole("heading", { name: "Indicadores" });
    expect(curadoria.revisao).toHaveBeenCalledWith("todos");
    expect(within(indicador("Testes concluídos")).getByText("2")).toBeTruthy();
    expect(within(indicador("Aderência média")).getByText("70%")).toBeTruthy();
    expect(within(indicador("Agilidade média")).getByText("80%")).toBeTruthy();
    expect(within(indicador("Já validados")).getByText("50%")).toBeTruthy();
    expect((await screen.findByTestId("distribuicao", {}, { timeout: 8000 })).textContent).toBe(
      "0–19%=0 20–39%=0 40–59%=0 60–79%=1 80–100%=1"
    );
    expect(screen.getByRole("link", { name: "Bruno Lima" }).getAttribute("href")).toBe(
      "/lab/rh/revisao/r2"
    );
    const porTeste = screen.getByRole("heading", { name: "Por teste" }).closest("section")!;
    expect(within(porTeste).getByText("Coordenador")).toBeTruthy();
  }, 20_000);

  it("os filtros recortam os resultados, atualizam os números e podem ser limpos", async () => {
    doisResultados();
    abrir();
    await screen.findByRole("heading", { name: "Indicadores" });
    await userEvent.selectOptions(screen.getByLabelText("Teste"), "Coordenador");
    expect(screen.getByRole("status").textContent).toBe("1 de 2 resultados nos filtros atuais.");
    expect(within(indicador("Aderência média")).getByText("60%")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ana Souza" })).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Situação da validação"), "validado");
    expect(await screen.findByText("Nenhum resultado com esses filtros")).toBeTruthy();

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]!);
    expect(await screen.findByRole("heading", { name: "Indicadores" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("2 de 2 resultados nos filtros atuais.");
  });

  it("clicar numa faixa detalha só os resultados dela; clicar de novo desfaz", async () => {
    doisResultados();
    abrir();
    await screen.findByRole("heading", { name: "Indicadores" });
    const faixas = within(screen.getByRole("list", { name: "Faixas" }));
    await userEvent.click(faixas.getByRole("button", { name: "80–100% · 1" }));
    expect(screen.getByRole("heading", { name: "Resultados: aderência 80–100%" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Bruno Lima" })).toBeNull();
    await userEvent.click(faixas.getByRole("button", { name: "80–100% · 1" }));
    expect(screen.getByRole("link", { name: "Bruno Lima" })).toBeTruthy();
  });

  it("uma turma que a API não devolveu, posta na URL, não filtra nada", async () => {
    doisResultados();
    renderizar(<LabVisaoGeralPage />, {
      rota: "/lab/rh/visao-geral?turma=turma-de-outro",
      caminho: "/lab/rh/visao-geral"
    });
    await screen.findByRole("heading", { name: "Indicadores" });
    expect(cadastro.turma).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("2 de 2 resultados nos filtros atuais.");
  });

  it("filtra pela turma escolhida usando só os participantes dela", async () => {
    doisResultados();
    cadastro.turma.mockResolvedValue({
      ...turma({ id: "t1", nParticipantes: 1 }),
      participantes: [participante({ id: "p2" })]
    });
    abrir();
    await screen.findByRole("heading", { name: "Indicadores" });
    await userEvent.selectOptions(screen.getByLabelText("Turma"), "t1");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("1 de 2 resultados nos filtros atuais.")
    );
    expect(screen.getByRole("link", { name: "Bruno Lima" })).toBeTruthy();
  });

  it("sem resultados, explica e aponta as turmas (sem indicadores zerados)", async () => {
    abrir();
    await screen.findByText("Ainda não há resultados para acompanhar");
    expect(screen.queryByText("Aderência média")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver as turmas" }).getAttribute("href")).toBe(
      "/lab/rh/turmas"
    );
  });

  it("se os resultados falham, mostra o erro com a nova tentativa e mantém o resto", async () => {
    curadoria.revisao.mockRejectedValue(new ApiError("falhou", 500));
    abrir();
    await screen.findByRole("button", { name: "Tentar novamente" });
    expect(cartao("Resultados a validar")).toBeTruthy();
  });

  it("conta os participantes e as turmas ativos do cadastro", async () => {
    abrir();
    await within(cartao("Participantes ativos")).findByText("1");
    expect(within(cartao("Participantes ativos")).getByText("2 cadastrados no total")).toBeTruthy();
    expect(within(cartao("Turmas ativas")).getByText("1")).toBeTruthy();
    expect(cartao("Turmas ativas").getAttribute("href")).toBe("/lab/rh/turmas");
  });
});
