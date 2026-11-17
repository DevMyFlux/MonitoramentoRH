// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { download, request } from "../features/my-flux/client";
import { renderizar } from "../test/render";
import { EmployeesPage } from "./employees-page";

vi.mock("../features/my-flux/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/my-flux/client")>();
  return { ...original, request: vi.fn(), download: vi.fn() };
});

const pedir = vi.mocked(request);
const baixar = vi.mocked(download);
const OP = "55555555-5555-4555-8555-555555555555";

const pessoa = (i: number, nome: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: `e${i}`,
  operationId: OP,
  name: nome,
  initials: nome.slice(0, 2).toUpperCase(),
  identifier: `M${1000 + i}`,
  status,
  shift: "DIURNO",
  parity: "ODD",
  parityReferenceMonth: "2026-11",
  function: { name: "Técnico operacional" },
  ...extra
});

const COLABORADORES = [
  pessoa(1, "Ana Souza", "ACTIVE"),
  pessoa(2, "Bruno Lima", "ACTIVE", { shift: "NOTURNO", parity: "EVEN" }),
  pessoa(3, "Carla Dias", "VACATION"),
  pessoa(4, "Davi Nunes", "SCHEDULED_ADMISSION"),
  pessoa(5, "Elisa Faria", "ACTIVE", { terminationDate: "2099-12-10" }),
  pessoa(6, "Fábio Reis", "TERMINATED")
];

function respostas(employees: unknown[] = COLABORADORES, extra: Record<string, unknown> = {}) {
  pedir.mockImplementation(async (caminho: string, metodo?: string) => {
    if (metodo === "PATCH") return { status: "TERMINATED" } as never;
    if (metodo === "POST" && caminho === "/employees") {
      return {
        id: "novo",
        operationId: OP,
        status: "ACTIVE",
        name: "Novo",
        identifier: "M9",
        function: null
      } as never;
    }
    if (caminho.startsWith("/documents")) return (extra["/documents"] ?? []) as never;
    const mapa: Record<string, unknown> = {
      "/operations": [{ id: OP, name: "Operação Demonstrativa" }],
      "/functions": [],
      "/event-types": [],
      "/parameters": [
        {
          id: "p1",
          operationId: OP,
          code: "DIURNO",
          name: "Diurno",
          kind: "SHIFT",
          status: "ACTIVE",
          configuration: { startHour: 7 }
        },
        {
          id: "p2",
          operationId: OP,
          code: "NOTURNO",
          name: "Noturno",
          kind: "SHIFT",
          status: "ACTIVE",
          configuration: { startHour: 19 }
        }
      ],
      "/employees": employees,
      "/calendar/events": [],
      ...extra
    };
    return (mapa[caminho] ?? []) as never;
  });
}

// jsdom não tem confirm de verdade.
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

const abrir = () => renderizar(<EmployeesPage />, { rota: "/colaboradores" });
const tabela = () => within(screen.getByRole("table"));

describe("colaboradores: lista", () => {
  it("mostra os quatro indicadores da unidade e esconde os desligados por padrão", async () => {
    respostas();
    abrir();
    await screen.findByRole("heading", { name: "Colaboradores" });
    const resumo = within(await screen.findByRole("region", { name: "Resumo da unidade" }));
    await waitFor(() => {
      const num = (rotulo: string) => resumo.getByText(rotulo).parentElement!.parentElement!;
      expect(within(num("Ativos")).getByText("3")).toBeTruthy();
      expect(within(num("Afastados e férias")).getByText("1")).toBeTruthy();
      expect(within(num("Admissões agendadas")).getByText("1")).toBeTruthy();
      expect(within(num("Desligamentos previstos")).getByText("1")).toBeTruthy();
    });
    expect(tabela().getByText("Ana Souza")).toBeTruthy();
    expect(tabela().queryByText("Fábio Reis")).toBeNull();
  });

  it("o interruptor 'Mostrar desligados' inclui quem foi desligado", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    const interruptor = screen.getByRole("switch", { name: "Mostrar desligados" });
    expect((interruptor as HTMLInputElement).checked).toBe(false);
    await userEvent.click(interruptor);
    expect(tabela().getByText("Fábio Reis")).toBeTruthy();
    expect(tabela().getByRole("button", { name: "Reativar" })).toBeTruthy();
  });

  it("mostra o turno com ícone, a matrícula e a situação de cada pessoa", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    const linha = within(tabela().getByText("Bruno Lima").closest("tr")!);
    expect(linha.getByText("Noturno")).toBeTruthy();
    expect(linha.getByText("M1002")).toBeTruthy();
    expect(linha.getByText("Ativo")).toBeTruthy();
  });

  it("a busca filtra; sem resultado, explica e deixa limpar a busca", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    await userEvent.type(screen.getByPlaceholderText(/Nome, iniciais/), "zzzz");
    expect(await screen.findByText("Ninguém encontrado com essa busca")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(within(await screen.findByRole("table")).getByText("Ana Souza")).toBeTruthy();
  });

  it("unidade sem ninguém: texto simpático e atalho para cadastrar", async () => {
    respostas([]);
    abrir();
    expect(await screen.findByText("Ainda não tem ninguém por aqui")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cadastrar primeiro colaborador" })).toBeTruthy();
  });

  it("numa falha, mostra o erro e a nova tentativa recarrega", async () => {
    pedir.mockRejectedValueOnce(new Error("Servidor indisponível"));
    respostas();
    pedir.mockRejectedValueOnce(new Error("Servidor indisponível"));
    abrir();
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Servidor indisponível");
    await userEvent.click(within(alerta).getByRole("button", { name: "Tentar novamente" }));
    expect(within(await screen.findByRole("table")).getByText("Ana Souza")).toBeTruthy();
  });
});

describe("colaboradores: ações (comportamento preservado)", () => {
  it("Desligar confirma, chama PATCH com o status e avisa", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    const linha = within(tabela().getByText("Ana Souza").closest("tr")!);
    await userEvent.click(linha.getByRole("button", { name: "Desligar" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(pedir).toHaveBeenCalledWith("/employees/e1", "PATCH", { status: "TERMINATED" });
    expect((await screen.findByRole("status")).textContent).toBe("Colaborador desligado.");
  });

  it("recusar a confirmação não chama a API", async () => {
    respostas();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    abrir();
    await screen.findByRole("table");
    await userEvent.click(
      within(tabela().getByText("Ana Souza").closest("tr")!).getByRole("button", {
        name: "Desligar"
      })
    );
    expect(pedir.mock.calls.some((c) => c[1] === "PATCH")).toBe(false);
  });

  it("Extrair XLSX continua chamando o download da unidade", async () => {
    respostas();
    baixar.mockResolvedValue(undefined as never);
    abrir();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Extrair XLSX" }));
    await waitFor(() => expect(baixar).toHaveBeenCalledTimes(1));
    expect(String(baixar.mock.calls[0]?.[0])).toContain(OP);
  });

  it("Novo colaborador abre o cadastro", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));
    expect(await screen.findByRole("heading", { name: "Novo colaborador", level: 2 })).toBeTruthy();
  });
});

describe("cadastro: novo colaborador em etapas", () => {
  it("avisa o que falta antes de avançar e só cadastra no último passo", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));

    const etapas = within(await screen.findByRole("list", { name: "Etapas do cadastro" }));
    expect(etapas.getByRole("button", { name: /Dados \(etapa atual\)/ })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/nome, iniciais e matrícula/);

    await userEvent.type(screen.getByLabelText(/^Nome/), "Gabriela Prado");
    await userEvent.type(screen.getByLabelText(/^Iniciais/, { selector: "input" }), "GP");
    await userEvent.type(screen.getByLabelText(/^Matrícula/), "M777");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    // Contrato: sem escala, não avança.
    await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/tipo de escala/);
    await userEvent.selectOptions(screen.getByLabelText(/^Tipo de escala/), "ROTATION");
    await userEvent.selectOptions(screen.getByLabelText(/^Turno/), "DIURNO");
    await userEvent.selectOptions(screen.getByLabelText(/^Rodízio/), "ODD");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    // Situação: o botão final cadastra.
    expect(pedir.mock.calls.some((c) => c[1] === "POST")).toBe(false);
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar colaborador" }));
    await waitFor(() => expect(pedir.mock.calls.some((c) => c[1] === "POST")).toBe(true));
    const envio = pedir.mock.calls.find((c) => c[1] === "POST")!;
    expect(envio[0]).toBe("/employees");
    expect(envio[2]).toMatchObject({
      name: "Gabriela Prado",
      initials: "GP",
      identifier: "M777",
      shift: "DIURNO",
      parity: "ODD",
      status: "ACTIVE"
    });
  });

  it("Voltar retorna ao passo anterior sem perder o que foi digitado", async () => {
    respostas();
    abrir();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));
    await userEvent.type(await screen.findByLabelText(/^Nome/), "Gabriela");
    await userEvent.type(screen.getByLabelText(/^Iniciais/, { selector: "input" }), "GP");
    await userEvent.type(screen.getByLabelText(/^Matrícula/), "M1");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Voltar" }));
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Gabriela");
  });
});

describe("ficha: editar um colaborador", () => {
  const ontem = new Date(Date.now() - 86_400_000).toISOString();
  const emUmMes = new Date(Date.now() + 40 * 86_400_000).toISOString();
  const evento = (id: string, titulo: string, de: number, ate: number) => ({
    id,
    employeeId: "e1",
    title: titulo,
    startsAt: new Date(Date.now() + de * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + ate * 86_400_000).toISOString()
  });

  async function abrirFicha(extra: Record<string, unknown> = {}) {
    respostas(COLABORADORES, extra);
    abrir();
    await screen.findByRole("table");
    await userEvent.click(
      within(tabela().getByText("Ana Souza").closest("tr")!).getByRole("button", { name: "Editar" })
    );
    return within(await screen.findByRole("complementary", { name: "Editar colaborador" }));
  }

  it("abre com o cartão de perfil e as abas (sem etapas)", async () => {
    const gaveta = await abrirFicha();
    expect(gaveta.getByText("M1001")).toBeTruthy();
    expect(gaveta.getByRole("tab", { name: "Documentos" })).toBeTruthy();
    expect(gaveta.queryByRole("list", { name: "Etapas do cadastro" })).toBeNull();
    expect(gaveta.getByRole("button", { name: "Salvar alterações" })).toBeTruthy();
  });

  it("mostra os afastamentos numa linha do tempo, com a fase de cada um", async () => {
    const gaveta = await abrirFicha({
      "/calendar/events": [
        evento("a1", "Férias", -3, 5),
        evento("a2", "Atestado", 10, 12),
        evento("a3", "Licença", -40, -30)
      ]
    });
    await userEvent.click(gaveta.getByRole("tab", { name: "Afastamentos" }));
    expect(gaveta.getByText("Em curso")).toBeTruthy();
    expect(gaveta.getByText("Programado")).toBeTruthy();
    expect(gaveta.getByText("Encerrado")).toBeTruthy();
    expect(gaveta.getByRole("button", { name: "Remover afastamento: Férias" })).toBeTruthy();
  });

  it("sem afastamentos, o vazio é simpático", async () => {
    const gaveta = await abrirFicha();
    await userEvent.click(gaveta.getByRole("tab", { name: "Afastamentos" }));
    expect(gaveta.getByText("Nenhum afastamento registrado")).toBeTruthy();
  });

  it("a pasta de documentos lê só os da pessoa e destaca ASO/NR vencidos", async () => {
    const gaveta = await abrirFicha({
      "/documents": [
        {
          id: "d1",
          expiresAt: ontem,
          requirement: { name: "Atestado de Saúde Ocupacional", code: "ASO", warningDays: 30 }
        },
        {
          id: "d2",
          expiresAt: emUmMes,
          requirement: { name: "Crachá", code: "CRA", warningDays: 30 }
        },
        {
          id: "d3",
          expiresAt: null,
          requirement: { name: "Diploma", code: "DIP", warningDays: 30 }
        }
      ]
    });
    await userEvent.click(gaveta.getByRole("tab", { name: "Documentos" }));
    expect(await gaveta.findByText("Atestado de Saúde Ocupacional")).toBeTruthy();
    expect(pedir).toHaveBeenCalledWith("/documents?employeeId=e1");
    const vencido = gaveta.getByText("Atestado de Saúde Ocupacional").closest("li")!;
    expect(vencido.className).toContain("borda-eletrica");
    expect(within(vencido).getByText("Vencido")).toBeTruthy();
    expect(gaveta.getByText("Em dia")).toBeTruthy();
    expect(gaveta.getByText("Sem validade")).toBeTruthy();
    expect(gaveta.getByText("1 vencido")).toBeTruthy();
    expect(gaveta.getByText("Crachá").closest("li")!.className).not.toContain("borda-eletrica");
  });

  it("falha ao ler os documentos: mostra o aviso, sem quebrar a ficha", async () => {
    const gaveta = await abrirFicha();
    pedir.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/documents")) throw new Error("Sem acesso aos documentos");
      return [] as never;
    });
    await userEvent.click(gaveta.getByRole("tab", { name: "Documentos" }));
    expect((await gaveta.findByRole("alert")).textContent).toContain("Sem acesso aos documentos");
  });
});
