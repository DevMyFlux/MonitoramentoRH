// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "../features/my-flux/client";
import { renderizar } from "../test/render";
import { UsersPage } from "./users-page";

vi.mock("../features/my-flux/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/my-flux/client")>();
  return { ...original, request: vi.fn() };
});

let perfilDoAtor = "ADMIN";
vi.mock("../features/auth/use-usuario-atual", () => ({
  useUsuarioAtual: () => ({ data: { id: "ator", name: "Ator", role: perfilDoAtor } })
}));

const pedir = vi.mocked(request);
const AREA_RH = "11111111-1111-4111-8111-111111111111";
const AREA_OPS = "22222222-2222-4222-8222-222222222222";

const completa = {
  id: "u1",
  name: "Ana Souza",
  email: "ana@empresa.com",
  isActive: true,
  cargo: "Supervisora de manutenção",
  nivelGovernanca: "supervisor",
  area: { id: AREA_OPS, nome: "Operações" },
  role: { name: "COMUM" },
  scopes: [{ isGlobal: false, operationId: "op" }],
  cadastroIncompleto: []
};
const antiga = {
  ...completa,
  id: "u2",
  name: "Bruno Lima",
  email: "bruno@empresa.com",
  cargo: null,
  nivelGovernanca: null,
  area: null,
  cadastroIncompleto: ["cargo", "nivelGovernanca", "areaId"]
};
const AREAS = [
  { id: AREA_RH, slug: "rh", nome: "Recursos Humanos", ativa: true, usuarios: 2 },
  { id: AREA_OPS, slug: "operacoes", nome: "Operações", ativa: true, usuarios: 5 }
];

function respostas(contas: unknown[] = [completa, antiga]) {
  pedir.mockImplementation(async (caminho: string, metodo?: string) => {
    if (metodo === "PATCH" || metodo === "POST") return { id: "ok", user: { id: "ok" } } as never;
    if (caminho.startsWith("/users")) {
      const soPendentes = caminho.includes("pendentes=1");
      return (
        soPendentes ? contas.filter((c) => (c as typeof antiga).cadastroIncompleto.length) : contas
      ) as never;
    }
    if (caminho === "/areas") return AREAS as never;
    if (caminho === "/operations") return [{ id: "op", name: "Hospital" }] as never;
    throw new Error(`rota não prevista: ${caminho}`);
  });
}

beforeEach(() => {
  pedir.mockReset();
  perfilDoAtor = "ADMIN";
});

describe("Usuários · cadastro da conta", () => {
  it("mostra cargo, nível e área e o selo 'Cadastro incompleto' nas contas antigas", async () => {
    respostas();
    renderizar(<UsersPage />);
    expect(await screen.findByText("Supervisora de manutenção")).toBeTruthy();
    expect(screen.getByText(/Supervisor · Operações/)).toBeTruthy();
    expect(screen.getByText("Cadastro incompleto")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/1 conta está sem cargo/);
  });

  it("filtra só as pendentes pela API", async () => {
    respostas();
    renderizar(<UsersPage />);
    await screen.findByText("bruno@empresa.com");
    await userEvent.click(screen.getByRole("button", { name: /Ver só as pendentes/ }));
    await waitFor(() => expect(pedir).toHaveBeenCalledWith("/users?pendentes=1"));
    await waitFor(() => expect(screen.queryByText("ana@empresa.com")).toBeNull());
    expect(screen.getByText("bruno@empresa.com")).toBeTruthy();
  });

  it("completar o cadastro: erros por campo antes de enviar, depois PATCH com os três campos", async () => {
    respostas();
    renderizar(<UsersPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Completar.*Bruno Lima/ }));
    const janela = await screen.findByRole("dialog", { name: /Completar cadastro/ });

    await userEvent.click(within(janela).getByRole("button", { name: "Salvar cadastro" }));
    expect(
      within(janela)
        .getAllByRole("alert")
        .map((a) => a.textContent)
    ).toEqual([
      "Informe o cargo (pelo menos 2 letras).",
      "Escolha o nível de governança.",
      "Escolha a área."
    ]);
    expect(pedir).not.toHaveBeenCalledWith("/users/u2", "PATCH", expect.anything());

    await userEvent.type(within(janela).getByLabelText(/Cargo/), "Analista de RH");
    await userEvent.selectOptions(
      within(janela).getByLabelText(/Nível de governança/),
      "coordenador"
    );
    await userEvent.selectOptions(within(janela).getByLabelText(/Área/), AREA_RH);
    await userEvent.click(within(janela).getByRole("button", { name: "Salvar cadastro" }));

    await waitFor(() =>
      expect(pedir).toHaveBeenCalledWith("/users/u2", "PATCH", {
        cargo: "Analista de RH",
        nivelGovernanca: "coordenador",
        areaId: AREA_RH
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("mostra no campo o erro que a API devolver", async () => {
    respostas();
    pedir.mockImplementation(async (caminho: string, metodo?: string) => {
      if (metodo === "PATCH")
        throw new ApiError("areaId: Escolha uma área ativa.", 400, "VALIDATION_ERROR", {
          issues: [{ path: ["areaId"], message: "Escolha uma área ativa." }]
        });
      if (caminho === "/areas") return AREAS as never;
      return [completa] as never;
    });
    renderizar(<UsersPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Editar.*Ana Souza/ }));
    const janela = await screen.findByRole("dialog");
    await userEvent.click(within(janela).getByRole("button", { name: "Salvar cadastro" }));
    expect(await within(janela).findByText("Escolha uma área ativa.")).toBeTruthy();
  });

  it("criar usuário exige cargo, nível e área e envia o cadastro junto", async () => {
    respostas([completa]);
    renderizar(<UsersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo usuário" }));
    const janela = await screen.findByRole("dialog", { name: /Criar usuário/ });
    await userEvent.type(within(janela).getByLabelText(/^Nome/), "Carla Dias");
    await userEvent.type(within(janela).getByLabelText(/E-mail/), "carla@empresa.com");
    await userEvent.click(within(janela).getByRole("button", { name: /Criar e auditar/ }));
    expect(within(janela).getByText("Escolha o nível de governança.")).toBeTruthy();
    expect(within(janela).getByText("Escolha a área.")).toBeTruthy();

    await userEvent.type(within(janela).getByLabelText(/Cargo/), "Coordenadora");
    await userEvent.selectOptions(
      within(janela).getByLabelText(/Nível de governança/),
      "coordenador"
    );
    await userEvent.selectOptions(within(janela).getByLabelText(/Área/), AREA_RH);
    await userEvent.click(within(janela).getByRole("button", { name: /Criar e auditar/ }));
    await waitFor(() =>
      expect(pedir).toHaveBeenCalledWith(
        "/users",
        "POST",
        expect.objectContaining({
          name: "Carla Dias",
          cargo: "Coordenadora",
          nivelGovernanca: "coordenador",
          areaId: AREA_RH,
          role: "COMUM",
          scopes: [{ isGlobal: false, operationId: "op" }]
        })
      )
    );
  });

  it("Esc fecha a janela", async () => {
    respostas();
    renderizar(<UsersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo usuário" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Usuários · áreas", () => {
  it("ADMIN adiciona e renomeia áreas", async () => {
    respostas();
    renderizar(<UsersPage />);
    const painel = (await screen.findByText("Áreas")).closest("details")!;
    await userEvent.click(within(painel).getByText("Áreas"));
    await userEvent.type(within(painel).getByLabelText("Nova área"), "Jurídico");
    await userEvent.click(within(painel).getByRole("button", { name: "Adicionar área" }));
    await waitFor(() => expect(pedir).toHaveBeenCalledWith("/areas", "POST", { nome: "Jurídico" }));

    await userEvent.click(within(painel).getByRole("button", { name: /Renomear.*Operações/ }));
    const campo = within(painel).getByLabelText(/Novo nome da área Operações/);
    await userEvent.clear(campo);
    await userEvent.type(campo, "Operações e Logística");
    await userEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(pedir).toHaveBeenCalledWith(`/areas/${AREA_OPS}`, "PATCH", {
        nome: "Operações e Logística"
      })
    );
  });

  it("RH vê a lista de áreas, mas não edita", async () => {
    perfilDoAtor = "RH";
    respostas();
    renderizar(<UsersPage />);
    const painel = (await screen.findByText("Áreas")).closest("details")!;
    await userEvent.click(within(painel).getByText("Áreas"));
    expect(within(painel).getByText("Recursos Humanos")).toBeTruthy();
    expect(within(painel).getByText(/Só DEV e ADMIN editam a lista/)).toBeTruthy();
    expect(within(painel).queryByLabelText("Nova área")).toBeNull();
    expect(within(painel).queryByRole("button", { name: /Renomear/ })).toBeNull();
  });
});
