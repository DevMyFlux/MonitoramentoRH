// @vitest-environment jsdom
// O Palco de uma sessão: recarregar retoma; abrir só lê; o desfecho vem do servidor.
import { treinoCenarioSchema, visaoDoParticipante } from "@my-flux/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiDosTreinamentos, type EstadoDaAtribuicao } from "../../features/treinamentos/api";
import { renderizar } from "../../test/render";
import { JogarPage } from "./jogar-page";

vi.mock("../../features/treinamentos/palco/movimento", () => ({
  useMovimentoReduzido: () => true
}));
vi.mock("../../features/treinamentos/api", () => ({
  apiDosTreinamentos: {
    lerAtribuicao: vi.fn(),
    iniciar: vi.fn(),
    responder: vi.fn(),
    concluir: vi.fn()
  }
}));
const api = vi.mocked(apiDosTreinamentos);

const cenario = treinoCenarioSchema.parse(
  JSON.parse(
    // jsdom: import.meta.url não é file://; o teste roda na pasta do pacote (apps/web).
    readFileSync(
      resolve(
        process.cwd(),
        "../../packages/shared/src/treinamentos/exemplos/manutencao-quadro-uti.json"
      ),
      "utf8"
    )
  )
);
const visao = visaoDoParticipante(cenario);
const reacao = (q: number, a: number) => cenario.questions[q]!.alternatives[a]!.beat;
const estado = (tentativa: EstadoDaAtribuicao["tentativa"]): EstadoDaAtribuicao => ({
  atribuicao: { id: "atr1", turma: "Turma A", prazo: null },
  cenario: visao,
  tentativa
});

function abrir() {
  return renderizar(
    <Routes>
      <Route path="/treinamentos/:atribuicaoId/jogar" element={<JogarPage />} />
      <Route path="/treinamentos/resultado/:tentativaId" element={<p>tela do resultado</p>} />
    </Routes>,
    { rota: "/treinamentos/atr1/jogar", caminho: "/*" }
  );
}

beforeEach(() => vi.resetAllMocks());

describe("Palco: sessão", () => {
  it("abrir só lê: mostra a abertura e não inicia nada até o clique", async () => {
    api.lerAtribuicao.mockResolvedValue(estado(null));
    abrir();
    expect(await screen.findByRole("button", { name: "Iniciar" })).toBeTruthy();
    expect(screen.getByText(/EXEMPLO: conteúdo ainda em validação/)).toBeTruthy();
    expect(api.iniciar).not.toHaveBeenCalled();
  });

  it("recarregar no meio retoma na primeira pergunta sem resposta, sem a cena de abertura", async () => {
    api.lerAtribuicao.mockResolvedValue(
      estado({
        id: "t1",
        iniciadaEm: "2026-11-24T12:00:00Z",
        respostas: [{ perguntaId: "q1", alternativa: 1, reacao: reacao(0, 1) }]
      })
    );
    abrir();
    expect(await screen.findByText("Pergunta 2 de 5")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pular cena/ })).toBeNull();
    // A cena foi reconstruída com a reação já vista (UTI avisada).
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/UTI está avisada/);
    expect(api.iniciar).not.toHaveBeenCalled();
  });

  it("responde pelo teclado, vê a reação e, depois das 5, conclui e vai ao resultado", async () => {
    const respostas = cenario.questions.slice(0, 4).map((q, i) => ({
      perguntaId: q.id,
      alternativa: 1,
      reacao: reacao(i, 1)
    }));
    api.lerAtribuicao.mockResolvedValue(estado({ id: "t1", iniciadaEm: "x", respostas }));
    api.responder.mockResolvedValue({
      perguntaId: "q5",
      alternativa: 0,
      reacao: reacao(4, 0),
      respondidas: 5
    });
    api.concluir.mockResolvedValue({} as never);
    abrir();
    await screen.findByText("Pergunta 5 de 5");
    await userEvent.tab();
    await userEvent.keyboard("1{Enter}");
    await waitFor(() => expect(api.responder).toHaveBeenCalledWith("t1", "q5", 0));
    expect(
      await screen.findByRole("heading", { name: "Ausência de tensão confirmada" })
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Seguir para o desfecho" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver o desfecho" }));
    expect(await screen.findByText("tela do resultado")).toBeTruthy();
    expect(api.concluir).toHaveBeenCalledWith("t1");
  });
});
