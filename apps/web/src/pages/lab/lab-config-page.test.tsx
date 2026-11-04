// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCadastroApi } from "../../features/leadership-lab/cadastro-api";
import { ApiError } from "../../features/my-flux/client";
import { configDosMoldes, molde } from "../../test/dados-do-cadastro";
import { renderizar } from "../../test/render";
import { LabConfigPage } from "./lab-config-page";

vi.mock("../../features/leadership-lab/cadastro-api", () => ({
  labCadastroApi: { configDosMoldes: vi.fn(), atualizarMolde: vi.fn() }
}));

const api = vi.mocked(labCadastroApi);
const abrir = () => renderizar(<LabConfigPage />, { rota: "/lab/config" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

/** O cartão de um molde, pelo nome. */
const cartao = (nome: string) => within(screen.getByRole("form", { name: `Molde ${nome}` }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("configuração dos moldes", () => {
  describe("a tela", () => {
    it("mostra um cartão por molde, com situação, temas e número de situações", async () => {
      api.configDosMoldes.mockResolvedValue(
        configDosMoldes({
          moldes: [
            molde({ id: "m1", nivel: "encarregado", nome: "Encarregado" }),
            molde({ tempoLimiteS: 45, ativo: true, cargoIds: ["cargo-1"] }),
            molde({ id: "m3", nivel: "coordenador", nome: "Coordenador" })
          ]
        })
      );
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      expect(screen.getAllByRole("form")).toHaveLength(3);

      const supervisor = cartao("Supervisor");
      expect(supervisor.getByText("Liberado")).toBeTruthy();
      expect(supervisor.getByText("5 situações por teste")).toBeTruthy();
      expect(supervisor.getByText("Comunicação")).toBeTruthy();
      expect((supervisor.getByLabelText(/Tempo por situação/) as HTMLInputElement).value).toBe(
        "45"
      );
      expect(
        (supervisor.getByRole("checkbox", { name: /Teste liberado/ }) as HTMLInputElement).checked
      ).toBe(true);
      expect(
        (supervisor.getByRole("checkbox", { name: /Supervisor de campo/ }) as HTMLInputElement)
          .checked
      ).toBe(true);
      expect(supervisor.getByText("1 cargo selecionado")).toBeTruthy();

      const encarregado = cartao("Encarregado");
      expect(encarregado.getByText("Não liberado")).toBeTruthy();
      expect((encarregado.getByLabelText(/Tempo por situação/) as HTMLInputElement).value).toBe("");
    });

    it("não sugere nenhum tempo: o campo nasce vazio e diz que a decisão é do negócio", async () => {
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      for (const nome of ["Encarregado", "Supervisor", "Coordenador"]) {
        const campo = cartao(nome).getByLabelText(/Tempo por situação/) as HTMLInputElement;
        expect(campo.value).toBe("");
        expect(campo.placeholder).toBe("");
      }
      expect(screen.getAllByText(/Decisão do negócio: o sistema não sugere um valor/)).toHaveLength(
        3
      );
    });

    it("sem acesso, falha e módulo desligado aparecem como tais", async () => {
      api.configDosMoldes.mockRejectedValue(erroDaApi(403, "LAB_FORBIDDEN"));
      abrir();
      await screen.findByText("Esta área não é para o seu perfil");
      expect(screen.getByText(/Ela é da administração do sistema/)).toBeTruthy();
    });

    it("enquanto carrega, mostra o estado de carregamento", () => {
      api.configDosMoldes.mockReturnValue(new Promise(() => undefined));
      abrir();
      expect(screen.getByLabelText("Carregando")).toBeTruthy();
    });
  });

  describe("salvar", () => {
    it("o botão só liga quando há o que salvar", async () => {
      const usuario = userEvent.setup();
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const salvar = cartao("Supervisor").getByRole("button", {
        name: "Salvar Supervisor"
      }) as HTMLButtonElement;
      expect(salvar.disabled).toBe(true);
      await usuario.type(cartao("Supervisor").getByLabelText(/Tempo por situação/), "30");
      expect(salvar.disabled).toBe(false);
      await usuario.clear(cartao("Supervisor").getByLabelText(/Tempo por situação/));
      expect(salvar.disabled).toBe(true);
    });

    it("envia o estado inteiro do molde: tempo, liberação e a lista COMPLETA de cargos", async () => {
      const usuario = userEvent.setup();
      const cargos = [
        { id: "cargo-1", nome: "Supervisor de campo", moldeNivel: null },
        { id: "cargo-2", nome: "Coordenador de planta", moldeNivel: "coordenador" as const },
        { id: "cargo-3", nome: "Supervisor de turno", moldeNivel: null }
      ];
      api.configDosMoldes.mockResolvedValue(configDosMoldes({ cargos }));
      api.atualizarMolde.mockResolvedValue(
        configDosMoldes({
          moldes: [
            molde({ id: "m1", nivel: "encarregado", nome: "Encarregado" }),
            molde({ tempoLimiteS: 45, ativo: true, cargoIds: ["cargo-1", "cargo-3"] }),
            molde({ id: "m3", nivel: "coordenador", nome: "Coordenador" })
          ],
          cargos: cargos.map((c) =>
            c.id === "cargo-2" ? c : { ...c, moldeNivel: "supervisor" as const }
          )
        })
      );
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");

      await usuario.type(supervisor.getByLabelText(/Tempo por situação/), "45");
      await usuario.click(supervisor.getByRole("checkbox", { name: /Teste liberado/ }));
      await usuario.click(supervisor.getByRole("checkbox", { name: /Supervisor de campo/ }));
      await usuario.click(supervisor.getByRole("checkbox", { name: /Supervisor de turno/ }));
      expect(supervisor.getByText("2 cargos selecionados")).toBeTruthy();
      await usuario.click(supervisor.getByRole("button", { name: "Salvar Supervisor" }));

      await waitFor(() =>
        expect(api.atualizarMolde).toHaveBeenCalledWith("supervisor", {
          tempoLimiteS: 45,
          ativo: true,
          cargoIds: ["cargo-1", "cargo-3"]
        })
      );
      expect((await supervisor.findByRole("status")).textContent).toBe("Alterações salvas.");
      // O que o servidor devolveu vira o estado da tela: nada mais a salvar.
      expect(
        (supervisor.getByRole("button", { name: "Salvar Supervisor" }) as HTMLButtonElement)
          .disabled
      ).toBe(true);
      expect(supervisor.getByText("Liberado")).toBeTruthy();
    });

    it("tirar um cargo o remove da lista enviada", async () => {
      const usuario = userEvent.setup();
      api.configDosMoldes.mockResolvedValue(
        configDosMoldes({
          moldes: [
            molde({ id: "m1", nivel: "encarregado", nome: "Encarregado" }),
            molde({ tempoLimiteS: 45, ativo: true, cargoIds: ["cargo-1"] }),
            molde({ id: "m3", nivel: "coordenador", nome: "Coordenador" })
          ]
        })
      );
      api.atualizarMolde.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      await usuario.click(supervisor.getByRole("checkbox", { name: /Supervisor de campo/ }));
      await usuario.click(supervisor.getByRole("button", { name: "Salvar Supervisor" }));
      await waitFor(() =>
        expect(api.atualizarMolde).toHaveBeenCalledWith("supervisor", {
          tempoLimiteS: 45,
          ativo: true,
          cargoIds: []
        })
      );
    });

    it("liberar sem tempo é recusado na tela, sem chamar o servidor", async () => {
      const usuario = userEvent.setup();
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      await usuario.click(supervisor.getByRole("checkbox", { name: /Teste liberado/ }));
      await usuario.click(supervisor.getByRole("button", { name: "Salvar Supervisor" }));
      expect((await supervisor.findByRole("alert")).textContent).toBe(
        "Defina o tempo por situação para liberar o teste."
      );
      expect(api.atualizarMolde).not.toHaveBeenCalled();
    });

    it.each([
      ["zero", "0"],
      ["fracionado", "1.5"],
      ["acima da faixa", "3601"]
    ])("tempo %s é recusado na tela", async (_nome, digitado) => {
      const usuario = userEvent.setup();
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      await usuario.type(supervisor.getByLabelText(/Tempo por situação/), digitado);
      await usuario.click(supervisor.getByRole("button", { name: "Salvar Supervisor" }));
      expect((await supervisor.findByRole("alert")).textContent).toMatch(
        /número inteiro de segundos, de 1 a 3600/
      );
      expect(api.atualizarMolde).not.toHaveBeenCalled();
    });

    it("se o servidor recusar, mostra o motivo no cartão certo", async () => {
      const usuario = userEvent.setup();
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      api.atualizarMolde.mockRejectedValue(
        erroDaApi(
          409,
          "LAB_CARGO_EM_OUTRO_MOLDE",
          "O cargo já pertence a outro molde: Coordenador de planta."
        )
      );
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      await usuario.type(supervisor.getByLabelText(/Tempo por situação/), "30");
      await usuario.click(supervisor.getByRole("button", { name: "Salvar Supervisor" }));
      expect((await supervisor.findByRole("alert")).textContent).toBe(
        "O cargo já pertence a outro molde: Coordenador de planta."
      );
      expect(
        within(screen.getByRole("form", { name: "Molde Encarregado" })).queryByRole("alert")
      ).toBeNull();
      expect(supervisor.queryByRole("status")).toBeNull();
    });
  });

  describe("proteções", () => {
    it("com teste em andamento, o tempo fica travado e a tela diz por quê", async () => {
      api.configDosMoldes.mockResolvedValue(
        configDosMoldes({
          moldes: [
            molde({ id: "m1", nivel: "encarregado", nome: "Encarregado" }),
            molde({ tempoLimiteS: 45, ativo: true, testesEmAndamento: 2 }),
            molde({ id: "m3", nivel: "coordenador", nome: "Coordenador" })
          ]
        })
      );
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      expect((supervisor.getByLabelText(/Tempo por situação/) as HTMLInputElement).disabled).toBe(
        true
      );
      expect(supervisor.getByText(/Há 2 testes em andamento/)).toBeTruthy();
      // Os outros moldes seguem editáveis.
      expect(
        (cartao("Coordenador").getByLabelText(/Tempo por situação/) as HTMLInputElement).disabled
      ).toBe(false);
    });

    it("cargo que já usa outro teste não pode ser marcado aqui, e diz onde está", async () => {
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      const emOutro = supervisor.getByRole("checkbox", {
        name: /Coordenador de planta/
      }) as HTMLInputElement;
      expect(emOutro.disabled).toBe(true);
      expect(supervisor.getByText(/Já usa outro teste/)).toBeTruthy();
      // No molde que o tem, o mesmo cargo está liberado para edição.
      const doCoordenador = cartao("Coordenador").getByRole("checkbox", {
        name: /Coordenador de planta/
      }) as HTMLInputElement;
      expect(doCoordenador.disabled).toBe(false);
    });

    it("o filtro de cargos esconde os que não combinam, sem desmarcar nada", async () => {
      const usuario = userEvent.setup();
      api.configDosMoldes.mockResolvedValue(configDosMoldes());
      abrir();
      await screen.findByRole("form", { name: "Molde Supervisor" });
      const supervisor = cartao("Supervisor");
      await usuario.click(supervisor.getByRole("checkbox", { name: /Supervisor de campo/ }));
      await usuario.type(supervisor.getByLabelText(/Filtrar cargos/), "planta");
      expect(supervisor.queryByRole("checkbox", { name: /Supervisor de campo/ })).toBeNull();
      await usuario.clear(supervisor.getByLabelText(/Filtrar cargos/));
      expect(
        (supervisor.getByRole("checkbox", { name: /Supervisor de campo/ }) as HTMLInputElement)
          .checked
      ).toBe(true);
      await usuario.type(supervisor.getByLabelText(/Filtrar cargos/), "zzz");
      expect(supervisor.getByText("Nenhum cargo encontrado.")).toBeTruthy();
    });
  });
});
