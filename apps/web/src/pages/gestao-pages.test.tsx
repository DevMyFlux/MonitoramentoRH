// @vitest-environment jsdom
// Telas de Gestão da fase 3: auditoria em linha do tempo e importação em três etapas.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../features/my-flux/client";
import { renderizar } from "../test/render";
import { AuditPage } from "./audit-page";
import { ImportsPage } from "./imports-page";

vi.mock("../features/my-flux/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/my-flux/client")>();
  return { ...original, request: vi.fn() };
});
const pedir = vi.mocked(request);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("auditoria em linha do tempo", () => {
  const registro = {
    id: "a1",
    action: "UPDATE",
    entity: "Employee",
    entityId: "1234567890",
    before: { status: "ACTIVE", nome: "Ana" },
    after: { status: "VACATION", nome: "Ana" },
    origin: "api",
    createdAt: "2026-11-24T13:00:00Z",
    user: { email: "rh@x.y", name: "Pessoa RH" }
  };

  it("mostra o evento por dia e abre o antes e depois só do que mudou", async () => {
    pedir.mockResolvedValue([registro] as never);
    renderizar(<AuditPage />);
    const evento = await screen.findByRole("button", { name: /Alteração/ });
    expect(evento.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(/24 de novembro de 2026/)).toBeTruthy();
    await userEvent.click(evento);
    expect(evento.getAttribute("aria-expanded")).toBe("true");
    const tabela = within(screen.getByRole("table"));
    expect(tabela.getByText("status")).toBeTruthy();
    expect(tabela.getByText("ACTIVE")).toBeTruthy();
    expect(tabela.getByText("VACATION")).toBeTruthy();
    expect(tabela.queryByText("nome")).toBeNull();
  });

  it("filtra pela ação escolhida ao enviar o formulário", async () => {
    pedir.mockResolvedValue([] as never);
    renderizar(<AuditPage />);
    await screen.findByText("Ainda não há registros de auditoria");
    await userEvent.selectOptions(screen.getByLabelText("Ação"), "APPROVE");
    await userEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() =>
      expect(pedir.mock.calls.some((c) => String(c[0]).includes("action=APPROVE"))).toBe(true)
    );
  });

  it("explica a recusa de permissão em linguagem simples", async () => {
    pedir.mockRejectedValue(new Error("Usuario sem permissao para consultar auditoria."));
    renderizar(<AuditPage />);
    expect(await screen.findByText(/restrita a Dev e Admin/)).toBeTruthy();
  });
});

describe("importação em três etapas", () => {
  const lote = {
    id: "lote-1",
    type: "EMPLOYEES",
    status: "VALIDATED",
    fileName: "pessoas.csv",
    acceptedCount: 2,
    rejectedCount: 1,
    createdAt: "2026-11-24T13:00:00Z"
  };

  it("envia, mostra os problemas por linha e bloqueia confirmar quando há erro", async () => {
    pedir.mockImplementation(async (caminho: string, metodo?: string) => {
      if (caminho === "/imports" && metodo === "POST")
        return {
          ...lote,
          issues: [
            {
              rowNumber: 3,
              field: "identifier",
              value: "",
              code: "REQUIRED",
              severity: "ERROR",
              message: "Matrícula obrigatória."
            }
          ]
        } as never;
      return [] as never;
    });
    renderizar(<ImportsPage />);
    await screen.findByText("Nenhuma importação por aqui");
    const arquivo = new File(["nome;matricula\nAna;1"], "pessoas.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText(/Arquivo/), arquivo);
    await userEvent.click(screen.getByRole("button", { name: "Enviar para conferência" }));

    expect(await screen.findByText("Linha 3")).toBeTruthy();
    expect(screen.getByText("Matrícula obrigatória.")).toBeTruthy();
    expect(screen.getByText(/Corrija o erro/)).toBeTruthy();
    const seguir = screen.getByRole("button", { name: "Seguir para confirmar" });
    expect((seguir as HTMLButtonElement).disabled).toBe(true);
    const envio = pedir.mock.calls.find((c) => c[1] === "POST")!;
    expect(envio[2]).toMatchObject({ type: "EMPLOYEES", fileName: "pessoas.csv" });
    expect(String((envio[2] as { contentBase64: string }).contentBase64)).not.toContain("base64,");
  });

  it("sem erros, confirma e avisa quantos registros foram criados", async () => {
    pedir.mockImplementation(async (caminho: string, metodo?: string) => {
      if (caminho === "/imports" && metodo === "POST")
        return { ...lote, rejectedCount: 0, issues: [] } as never;
      if (caminho === "/imports/lote-1/commit") return { ok: true, committedRows: 2 } as never;
      return [] as never;
    });
    renderizar(<ImportsPage />);
    await screen.findByText("Nenhuma importação por aqui");
    await userEvent.upload(
      screen.getByLabelText(/Arquivo/),
      new File(["x"], "pessoas.csv", { type: "text/csv" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar para conferência" }));
    await userEvent.click(await screen.findByRole("button", { name: "Seguir para confirmar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    expect(await screen.findByText(/2 registros criados/)).toBeTruthy();
    const etapas = within(screen.getByRole("list", { name: "Etapas da importação" }));
    expect(etapas.getByText("Confirmar").textContent).toContain("concluída");
  });
});
