// @vitest-environment jsdom
// O teste do Lab por cenários na tela: antes de começar (o público, o motivo), a trilha no Palco
// (abertura, 5 perguntas, desfecho do cenário, próximo, resultado) e o despacho pelo modo do servidor.
import {
  type LabCenarioEmAndamento,
  type LabTesteProxima,
  validarCenarioImportado,
  visaoDoParticipante
} from "@my-flux/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labApi, testeApi } from "../../features/leadership-lab/api";
import { painel } from "../../test/dados-do-lab";
import { renderizar } from "../../test/render";
import { LabTestePage } from "./lab-teste-page";
import { LabTrilhaPage } from "./lab-trilha-page";

vi.mock("../../features/treinamentos/palco/movimento", () => ({
  useMovimentoReduzido: () => true
}));
vi.mock("../../features/leadership-lab/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/leadership-lab/api")>()),
  labApi: { painel: vi.fn() },
  testeApi: { proxima: vi.fn(), iniciar: vi.fn(), responder: vi.fn(), concluir: vi.fn() }
}));
const teste = vi.mocked(testeApi);
const lab = vi.mocked(labApi);

// Um cenário real dos 40 do Lab (formato do pacote, adaptado e validado), sem o gabarito na visão.
const importado = validarCenarioImportado(
  JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        "../../docs/cenarios-lab/supervisor-manutencao-adm-sup-checklist-incompleto.json"
      ),
      "utf8"
    )
  )
);
if (!importado.ok) throw new Error("cenário de teste inválido");
const cenario = importado.cenario;

const visao = visaoDoParticipante(cenario);
const reacao = (q: number, a: number) => cenario.questions[q]!.alternatives[a]!.beat;

const emAndamento = (
  ordem: number,
  respostas: LabCenarioEmAndamento["tentativa"]["respostas"] = [],
  origem: "participante" | "interno" = "participante"
): LabCenarioEmAndamento => ({
  tipo: "cenario",
  trilha: {
    sessaoId: "s1",
    origem,
    publico: "supervisor-manutencao-adm",
    total: 3,
    atual: ordem,
    concluidos: ordem - 1,
    cenarios: [1, 2, 3].map((n) => ({
      ordem: n,
      status:
        n < ordem
          ? ("concluida" as const)
          : n === ordem
            ? ("em_andamento" as const)
            : ("pendente" as const)
    }))
  },
  cenario: visao,
  tentativa: { id: `t${ordem}`, iniciadaEm: "2026-11-24T12:00:00Z", respostas }
});

const semTeste = (
  extra: Partial<Extract<LabTesteProxima, { tipo: "sem-teste" }>> = {}
): LabTesteProxima => ({
  tipo: "sem-teste",
  podeIniciar: true,
  motivo: null,
  publico: "supervisor-manutencao-adm",
  total: 3,
  publicosEscolhiveis: [],
  ...extra
});

const abrir = (Pagina = LabTrilhaPage) =>
  renderizar(
    <Routes>
      <Route path="/lab/teste" element={<Pagina />} />
      <Route path="/lab/resultado/:id" element={<p>tela do resultado</p>} />
    </Routes>,
    { rota: "/lab/teste", caminho: "/*" }
  );

beforeEach(() => vi.resetAllMocks());

describe("antes de começar", () => {
  it("o COMUM vê quantos cenários terá e o público da conta; não escolhe nada; o clique inicia a trilha", async () => {
    teste.proxima.mockResolvedValue(semTeste());
    teste.iniciar.mockResolvedValue(emAndamento(1));
    abrir();
    expect(await screen.findByText("3 cenários")).toBeTruthy();
    expect(screen.getByText(/Supervisores de manutenção e administrativo/)).toBeTruthy();
    expect(screen.queryByLabelText("Público do teste")).toBeNull();
    expect(teste.iniciar).not.toHaveBeenCalled(); // abrir só lê
    await userEvent.click(screen.getByRole("button", { name: "Começar o teste" }));
    expect(teste.iniciar).toHaveBeenCalledWith({});
    // A trilha abre pela apresentação do primeiro cenário, com a ordem na barra.
    expect(await screen.findByRole("heading", { name: cenario.title, level: 2 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar" })).toBeTruthy();
    expect(screen.getByText("Teste do Leadership Lab · cenário 1 de 3")).toBeTruthy();
  });

  it("DEV, ADMIN e RH escolhem o público (e o teste é marcado como interno)", async () => {
    teste.proxima.mockResolvedValue(
      semTeste({
        publico: null,
        total: 0,
        publicosEscolhiveis: [
          "supervisor-manutencao-adm",
          "coordenador-administrativo",
          "rh",
          "administrativo-geral"
        ]
      })
    );
    teste.iniciar.mockResolvedValue(emAndamento(1, [], "interno"));
    abrir();
    const botao = await screen.findByRole("button", { name: "Começar o teste" });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/não entra nos números dos participantes/)).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Público do teste"), "rh");
    expect((botao as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(botao);
    expect(teste.iniciar).toHaveBeenCalledWith({ publico: "rh" });
    expect(await screen.findByText(/Teste interno: não entra nos números/)).toBeTruthy();
  });

  it.each([
    ["termo-pendente", /Aceite o termo/],
    ["cadastro-incompleto", /cadastro está incompleto/],
    ["sem-cenarios", /Ainda não há cenários/],
    ["limite-diario", /Limite de testes de hoje/]
  ] as const)(
    "sem poder iniciar (%s): explica o motivo e não oferece o botão",
    async (motivo, texto) => {
      teste.proxima.mockResolvedValue(semTeste({ podeIniciar: false, motivo, total: 0 }));
      abrir();
      expect(await screen.findByRole("heading", { name: texto })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Começar o teste" })).toBeNull();
      expect(screen.getByRole("link", { name: "Voltar ao painel" })).toBeTruthy();
    }
  );

  it("falha ao iniciar: mostra o erro e deixa tentar de novo", async () => {
    teste.proxima.mockResolvedValue(semTeste());
    teste.iniciar.mockRejectedValue(new Error("falhou"));
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Começar o teste" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Começar o teste" }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
});

describe("a trilha no Palco", () => {
  it("recarregar retoma na primeira pergunta sem resposta, sem a cena de abertura", async () => {
    teste.proxima.mockResolvedValue(
      emAndamento(2, [{ perguntaId: "q1", alternativa: 1, reacao: reacao(0, 1) }])
    );
    abrir();
    expect(await screen.findByText("Pergunta 2 de 5")).toBeTruthy();
    expect(screen.getByLabelText("Cenário 2 de 3")).toBeTruthy();
    expect(screen.getByText("Cenário 1 ✓")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar" })).toBeNull();
  });

  it("um cenário sem resposta abre pela apresentação; o clique não chama a API (a trilha já existe)", async () => {
    teste.proxima.mockResolvedValue(emAndamento(1));
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar" }));
    expect(teste.iniciar).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Começar as perguntas/ })).toBeTruthy();
  });

  it("5 respostas, desfecho do cenário, próximo cenário e, no último, o resultado", async () => {
    // Cenário 1 de 3, com 4 respostas dadas: falta a quinta.
    const quatro = cenario.questions
      .slice(0, 4)
      .map((q, i) => ({ perguntaId: q.id, alternativa: 1, reacao: reacao(i, 1) }));
    teste.proxima.mockResolvedValue(emAndamento(1, quatro));
    teste.responder.mockResolvedValue({
      perguntaId: "q5",
      alternativa: 0,
      reacao: reacao(4, 0),
      respondidas: 5
    });
    teste.concluir.mockResolvedValueOnce({
      ordem: 1,
      desfecho: {
        events: [],
        outcomes: [
          {
            id: "o1",
            label: "Resultado do cenário",
            nivel: "warn",
            texto: "Texto do nível atenção."
          }
        ]
      },
      proximo: emAndamento(2),
      resultadoDaSessao: null
    });
    abrir();
    await screen.findByText("Pergunta 5 de 5");
    await userEvent.tab();
    await userEvent.keyboard("1{Enter}");
    await waitFor(() => expect(teste.responder).toHaveBeenCalledWith("t1", "q5", 0));
    await userEvent.click(await screen.findByRole("button", { name: "Seguir para o desfecho" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver o desfecho" }));
    expect(teste.concluir).toHaveBeenCalledWith("t1");

    // Entre os cenários: o que as decisões provocaram, em palavras (nunca só a cor).
    expect(await screen.findByRole("heading", { name: "Cenário 1 de 3 concluído" })).toBeTruthy();
    expect(screen.getByText("Atenção")).toBeTruthy();
    expect(screen.getByText("Texto do nível atenção.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Próximo cenário/ }));
    expect(await screen.findByRole("button", { name: "Iniciar" })).toBeTruthy();
    expect(screen.getByText("Teste do Leadership Lab · cenário 2 de 3")).toBeTruthy();
  });

  it("concluir o último cenário leva ao resultado da sessão", async () => {
    const quatro = cenario.questions
      .slice(0, 4)
      .map((q, i) => ({ perguntaId: q.id, alternativa: 1, reacao: reacao(i, 1) }));
    teste.proxima.mockResolvedValue(emAndamento(3, quatro));
    teste.responder.mockResolvedValue({
      perguntaId: "q5",
      alternativa: 0,
      reacao: reacao(4, 0),
      respondidas: 5
    });
    teste.concluir.mockResolvedValue({
      ordem: 3,
      desfecho: { events: [], outcomes: [] },
      proximo: null,
      resultadoDaSessao: "s1"
    });
    abrir();
    await screen.findByText("Pergunta 5 de 5");
    await userEvent.tab();
    await userEvent.keyboard("1{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Seguir para o desfecho" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver o desfecho" }));
    expect(await screen.findByText("tela do resultado")).toBeTruthy();
  });

  it("falha ao concluir: o erro aparece e dá para tentar de novo", async () => {
    const quatro = cenario.questions
      .slice(0, 4)
      .map((q, i) => ({ perguntaId: q.id, alternativa: 1, reacao: reacao(i, 1) }));
    teste.proxima.mockResolvedValue(emAndamento(1, quatro));
    teste.responder.mockResolvedValue({
      perguntaId: "q5",
      alternativa: 0,
      reacao: reacao(4, 0),
      respondidas: 5
    });
    teste.concluir.mockRejectedValue(new Error("sem conexão"));
    abrir();
    await screen.findByText("Pergunta 5 de 5");
    await userEvent.tab();
    await userEvent.keyboard("1{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Seguir para o desfecho" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver o desfecho" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Ver o desfecho" }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
});

describe("o modo do servidor decide a tela do teste", () => {
  it("por cenários: a trilha; legado: as situações da IA (que nem chamam a trilha)", async () => {
    lab.painel.mockResolvedValue(painel({ modoDoTeste: "cenarios" }));
    teste.proxima.mockResolvedValue(semTeste());
    abrir(LabTestePage);
    expect(await screen.findByRole("button", { name: "Começar o teste" })).toBeTruthy();
    expect(teste.proxima).toHaveBeenCalled();
  });

  it("no legado, não consulta a trilha", async () => {
    lab.painel.mockResolvedValue(painel({ modoDoTeste: "legado" }));
    abrir(LabTestePage);
    await waitFor(() => expect(lab.painel).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(teste.proxima).not.toHaveBeenCalled();
  });
});
