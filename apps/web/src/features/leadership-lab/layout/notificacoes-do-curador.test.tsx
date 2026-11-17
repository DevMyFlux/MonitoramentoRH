// @vitest-environment jsdom
import type { LabNotificacoes } from "@my-flux/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderizar } from "../../../test/render";
import { labCuradoriaApi } from "../curadoria-api";
import { NotificacoesDoCurador } from "./notificacoes-do-curador";
import { tempoRelativo } from "./tempo-relativo";

vi.mock("../curadoria-api", () => ({
  labCuradoriaApi: { notificacoes: vi.fn(), marcarLeitura: vi.fn() }
}));

const api = vi.mocked(labCuradoriaApi);
const ID = "11111111-1111-4111-8111-111111111111";
const agora = new Date().toISOString();

const lista = (lidas: string[] = []): LabNotificacoes => {
  const itens = [
    {
      chave: `alerta:${ID}`,
      tipo: "alerta" as const,
      prioridade: "urgente" as const,
      titulo: "Alerta pedagógico vermelho",
      descricao: "Pede uma conversa de desenvolvimento com o participante.",
      origem: { participante: "Ana Souza", operacao: "Operação A" },
      criadoEm: agora,
      destino: "/lab/rh/alertas"
    },
    {
      chave: `resultado:${ID.replace("1111", "2222")}`,
      tipo: "resultado" as const,
      prioridade: "normal" as const,
      titulo: "Resultado aguardando validação",
      descricao: "Teste Supervisor concluído.",
      origem: { participante: "Bia Lima", operacao: "Operação A" },
      criadoEm: agora,
      destino: "/lab/rh/revisao/abc"
    }
  ].map((i) => ({ ...i, lida: lidas.includes(i.chave) }));
  return {
    itens,
    naoLidas: itens.filter((i) => !i.lida).length,
    totalPendente: itens.length
  };
};

const abrir = () =>
  renderizar(<NotificacoesDoCurador />, { rota: "/lab/rh/visao-geral", caminho: "/lab/*" });

beforeEach(() => vi.resetAllMocks());

describe("tempoRelativo", () => {
  const base = new Date("2026-03-10T12:00:00Z");
  it("descreve o tempo de forma curta", () => {
    expect(tempoRelativo("2026-03-10T11:59:40Z", base)).toBe("agora");
    expect(tempoRelativo("2026-03-10T11:55:00Z", base)).toBe("há 5 min");
    expect(tempoRelativo("2026-03-10T09:00:00Z", base)).toBe("há 3 h");
    expect(tempoRelativo("2026-03-08T12:00:00Z", base)).toBe("há 2 d");
  });
});

describe("sino de notificações", () => {
  it("mostra quantas não lidas há, no rótulo e no selo", async () => {
    api.notificacoes.mockResolvedValue(lista());
    abrir();
    expect(await screen.findByRole("button", { name: "Notificações (2 não lidas)" })).toBeTruthy();
  });

  it("lista cada item com a origem e leva à tela onde ele é tratado", async () => {
    api.notificacoes.mockResolvedValue(lista());
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: /Notificações/ }));
    const dialogo = within(screen.getByRole("dialog", { name: "Notificações" }));
    expect(dialogo.getByText("2 itens esperam você")).toBeTruthy();
    const alerta = dialogo.getByRole("link", { name: /Alerta pedagógico vermelho/ });
    expect(alerta.getAttribute("href")).toBe("/lab/rh/alertas");
    expect(alerta.textContent).toContain("Ana Souza · Operação A");
    expect(
      dialogo.getByRole("link", { name: /Resultado aguardando validação/ }).getAttribute("href")
    ).toBe("/lab/rh/revisao/abc");
  });

  it("abrir um item o marca como lido, só ele, e navega", async () => {
    api.notificacoes.mockResolvedValue(lista());
    api.marcarLeitura.mockResolvedValue(lista([`alerta:${ID}`]));
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: /Notificações/ }));
    await userEvent.click(screen.getByRole("link", { name: /Alerta pedagógico vermelho/ }));
    await waitFor(() => expect(api.marcarLeitura).toHaveBeenCalledTimes(1));
    expect(api.marcarLeitura.mock.calls[0]?.[0]).toEqual({ chaves: [`alerta:${ID}`] });
    expect(await screen.findByRole("button", { name: "Notificações (1 não lida)" })).toBeTruthy();
  });

  it("item já lido não é marcado de novo", async () => {
    api.notificacoes.mockResolvedValue(lista([`alerta:${ID}`]));
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: /Notificações/ }));
    await userEvent.click(screen.getByRole("link", { name: /Alerta pedagógico vermelho/ }));
    expect(api.marcarLeitura).not.toHaveBeenCalled();
  });

  it("'Marcar todas' limpa as não lidas", async () => {
    api.notificacoes.mockResolvedValue(lista());
    api.marcarLeitura.mockResolvedValue(
      lista([`alerta:${ID}`, `resultado:${ID.replace("1111", "2222")}`])
    );
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: /Notificações/ }));
    await userEvent.click(screen.getByRole("button", { name: "Marcar todas" }));
    expect(api.marcarLeitura.mock.calls[0]?.[0]).toEqual({ todas: true });
    expect(await screen.findByRole("button", { name: "Notificações" })).toBeTruthy();
  });

  it("sem pendências, explica que está tudo em dia", async () => {
    api.notificacoes.mockResolvedValue({ itens: [], naoLidas: 0, totalPendente: 0 });
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Notificações" }));
    expect(screen.getByText("Tudo em dia")).toBeTruthy();
  });

  it("numa falha, avisa e deixa tentar de novo", async () => {
    api.notificacoes.mockRejectedValue(new Error("falhou"));
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Notificações" }));
    expect(await screen.findByText("Não foi possível carregar as notificações.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("Esc fecha e devolve o foco ao sino", async () => {
    api.notificacoes.mockResolvedValue(lista());
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: /Notificações/ }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Notificações/);
  });
});
