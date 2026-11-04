// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labCadastroApi } from "../../../features/leadership-lab/cadastro-api";
import { ApiError } from "../../../features/my-flux/client";
import { colaborador, participante, usuario } from "../../../test/dados-do-cadastro";
import { renderizar } from "../../../test/render";
import { LabParticipantesPage } from "./lab-participantes-page";

vi.mock("../../../features/leadership-lab/cadastro-api", () => ({
  labCadastroApi: {
    participantes: vi.fn(),
    colaboradoresElegiveis: vi.fn(),
    usuariosElegiveis: vi.fn(),
    cadastrarParticipante: vi.fn(),
    atualizarParticipante: vi.fn(),
    turmas: vi.fn(),
    turma: vi.fn(),
    criarTurma: vi.fn(),
    atualizarTurma: vi.fn(),
    incluirNaTurma: vi.fn(),
    removerDaTurma: vi.fn(),
    configDosMoldes: vi.fn(),
    atualizarMolde: vi.fn()
  }
}));

const api = vi.mocked(labCadastroApi);
const abrir = () => renderizar(<LabParticipantesPage />, { rota: "/lab/rh/participantes" });
const erroDaApi = (status: number, code?: string, message = "Mensagem da API.") =>
  new ApiError(message, status, code);

const ana = participante();
const bruno = participante({
  id: "participante-2",
  ativo: false,
  colaborador: colaborador({
    id: "colaborador-2",
    nome: "Bruno Lima",
    identificador: "MAT-002",
    cargo: null,
    molde: null
  }),
  usuario: usuario({ id: "usuario-2", nome: "Conta do Bruno", email: "bruno@exemplo.com" })
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("participantes do Leadership Lab (RH)", () => {
  describe("a lista", () => {
    it("enquanto carrega, mostra o estado de carregamento", () => {
      api.participantes.mockReturnValue(new Promise(() => undefined));
      abrir();
      expect(screen.getByLabelText("Carregando")).toBeTruthy();
    });

    it("mostra quem é, o cargo, a operação, o teste do cargo e a situação", async () => {
      api.participantes.mockResolvedValue([
        ana,
        participante({
          id: "participante-3",
          colaborador: colaborador({
            id: "colaborador-3",
            nome: "Carla Dias",
            molde: { nivel: "coordenador", nome: "Coordenador", liberado: false }
          }),
          usuario: usuario({ id: "usuario-3", nome: "Carla", email: "carla@exemplo.com" })
        }),
        bruno
      ]);
      abrir();

      const linhaAna = (await screen.findByText("Ana Souza")).closest("tr")!;
      expect(within(linhaAna).getByText("Matrícula MAT-001")).toBeTruthy();
      expect(within(linhaAna).getByText("Supervisor de campo")).toBeTruthy();
      expect(within(linhaAna).getByText("Operação Norte")).toBeTruthy();
      expect(within(linhaAna).getByText("Liberado")).toBeTruthy();
      expect(within(linhaAna).getByText("ana@exemplo.com")).toBeTruthy();
      expect(within(linhaAna).getByText("Ativo")).toBeTruthy();

      const linhaCarla = screen.getByText("Carla Dias").closest("tr")!;
      expect(within(linhaCarla).getByText("Não liberado")).toBeTruthy();

      const linhaBruno = screen.getByText("Bruno Lima").closest("tr")!;
      expect(within(linhaBruno).getByText("Sem teste para o cargo")).toBeTruthy();
      expect(within(linhaBruno).getByText("Desativado")).toBeTruthy();
      expect(within(linhaBruno).getByText("—")).toBeTruthy();
    });

    it("sem participantes, explica o primeiro passo", async () => {
      api.participantes.mockResolvedValue([]);
      abrir();
      await screen.findByText("Nenhum participante ainda");
      expect(screen.getByRole("button", { name: "Cadastrar participante" })).toBeTruthy();
    });

    it("tem as abas Participantes e Turmas, com a atual marcada", async () => {
      api.participantes.mockResolvedValue([]);
      abrir();
      await screen.findByText("Nenhum participante ainda");
      const abas = within(screen.getByRole("navigation", { name: "Áreas do acompanhamento" }));
      expect(abas.getByRole("link", { name: "Participantes" }).getAttribute("href")).toBe(
        "/lab/rh/participantes"
      );
      expect(abas.getByRole("link", { name: "Turmas" }).getAttribute("href")).toBe(
        "/lab/rh/turmas"
      );
    });
  });

  describe("quando não dá para mostrar a lista", () => {
    it("perfil sem acesso: diz que a área não é para ele, sem tentar de novo", async () => {
      api.participantes.mockRejectedValue(erroDaApi(403, "LAB_FORBIDDEN"));
      abrir();
      await screen.findByText("Esta área não é para o seu perfil");
      expect(screen.getByText(/do RH, que acompanha os participantes/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    });

    it("módulo desligado no ambiente (404): avisa", async () => {
      api.participantes.mockRejectedValue(erroDaApi(404));
      abrir();
      await screen.findByText("O Leadership Lab ainda não está ativo");
    });

    it("falha do servidor: oferece tentar de novo, e funciona", async () => {
      api.participantes.mockRejectedValueOnce(erroDaApi(500)).mockRejectedValueOnce(erroDaApi(500));
      api.participantes.mockResolvedValue([ana]);
      abrir();
      await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
      await screen.findByText("Ana Souza");
    });
  });

  describe("desativar e reativar", () => {
    it("pede confirmação, que explica o efeito, e só então desativa", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.participantes.mockResolvedValueOnce([ana]).mockResolvedValue([{ ...ana, ativo: false }]);
      api.atualizarParticipante.mockResolvedValue({ ...ana, ativo: false });
      abrir();

      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Desativar Ana Souza" })
      );
      const dialogo = screen.getByRole("dialog");
      expect(within(dialogo).getByText("Desativar Ana Souza?")).toBeTruthy();
      expect(within(dialogo).getByText(/perde o acesso ao Leadership Lab/)).toBeTruthy();
      expect(api.atualizarParticipante).not.toHaveBeenCalled();

      await usuarioDeTeste.click(
        within(dialogo).getByRole("button", { name: "Desativar participante" })
      );
      await waitFor(() =>
        expect(api.atualizarParticipante).toHaveBeenCalledWith("participante-1", { ativo: false })
      );
      await screen.findByText("Desativado");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("button", { name: "Reativar Ana Souza" })).toBeTruthy();
    });

    it("cancelar não muda nada", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.participantes.mockResolvedValue([ana]);
      abrir();
      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Desativar Ana Souza" })
      );
      await usuarioDeTeste.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(api.atualizarParticipante).not.toHaveBeenCalled();
    });

    it("se o servidor recusar, a confirmação fica aberta e mostra o motivo", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.participantes.mockResolvedValue([ana]);
      api.atualizarParticipante.mockRejectedValue(erroDaApi(404, "LAB_NOT_FOUND"));
      abrir();
      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Desativar Ana Souza" })
      );
      await usuarioDeTeste.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar participante" })
      );
      const alerta = await within(screen.getByRole("dialog")).findByRole("alert");
      expect(alerta.textContent).toMatch(/fora do que o seu acesso alcança/);
    });

    it("reativa direto, sem confirmação, porque devolve acesso", async () => {
      const usuarioDeTeste = userEvent.setup();
      api.participantes
        .mockResolvedValueOnce([bruno])
        .mockResolvedValue([{ ...bruno, ativo: true }]);
      api.atualizarParticipante.mockResolvedValue({ ...bruno, ativo: true });
      abrir();
      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Reativar Bruno Lima" })
      );
      await waitFor(() =>
        expect(api.atualizarParticipante).toHaveBeenCalledWith("participante-2", { ativo: true })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      await screen.findByText("Ativo");
    });
  });

  describe("cadastrar um participante", () => {
    const abrirFormulario = async () => {
      const usuarioDeTeste = userEvent.setup();
      api.participantes.mockResolvedValueOnce([]).mockResolvedValue([ana]);
      abrir();
      await usuarioDeTeste.click(
        await screen.findByRole("button", { name: "Cadastrar participante" })
      );
      return { usuarioDeTeste, dialogo: within(screen.getByRole("dialog")) };
    };

    it("só busca com ao menos 2 letras, e espera parar de digitar", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      api.colaboradoresElegiveis.mockResolvedValue([colaborador()]);

      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "a");
      await new Promise((r) => setTimeout(r, 450));
      expect(api.colaboradoresElegiveis).not.toHaveBeenCalled();

      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "na");
      await dialogo.findByText("Ana Souza");
      // Uma busca só, com o texto completo (não uma por tecla).
      expect(api.colaboradoresElegiveis).toHaveBeenCalledTimes(1);
      expect(api.colaboradoresElegiveis).toHaveBeenCalledWith("ana");
    });

    it("liga o colaborador ao usuário escolhidos e fecha, atualizando a lista", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      api.colaboradoresElegiveis.mockResolvedValue([
        colaborador(),
        colaborador({ id: "colaborador-9", nome: "Ana Paula", identificador: "MAT-009" })
      ]);
      api.usuariosElegiveis.mockResolvedValue([usuario()]);
      api.cadastrarParticipante.mockResolvedValue(ana);

      const cadastrar = dialogo.getByRole("button", { name: "Cadastrar participante" });
      expect((cadastrar as HTMLButtonElement).disabled).toBe(true);

      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "ana");
      await usuarioDeTeste.click(await dialogo.findByRole("radio", { name: /Ana Souza/ }));
      expect((cadastrar as HTMLButtonElement).disabled).toBe(true); // falta o usuário

      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar usuário/), "ana@");
      await usuarioDeTeste.click(await dialogo.findByRole("radio", { name: /ana@exemplo.com/ }));
      expect((cadastrar as HTMLButtonElement).disabled).toBe(false);

      await usuarioDeTeste.click(cadastrar);
      await waitFor(() =>
        expect(api.cadastrarParticipante).toHaveBeenCalledWith({
          employeeId: "colaborador-1",
          userId: "usuario-1"
        })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await screen.findByText("Matrícula MAT-001");
    });

    it("mostra o teste do cargo de cada colaborador, para o RH saber se ele vai poder fazer", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      api.colaboradoresElegiveis.mockResolvedValue([
        colaborador(),
        colaborador({ id: "colaborador-2", nome: "Ana Sem Cargo", cargo: null, molde: null })
      ]);
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "ana");
      await dialogo.findByText("Ana Sem Cargo");
      expect(dialogo.getByText("Liberado")).toBeTruthy();
      expect(dialogo.getByText("Sem teste para o cargo")).toBeTruthy();
      expect(dialogo.getByText(/Sem cargo/)).toBeTruthy();
    });

    it("sem resultado, explica quem aparece nas buscas", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      api.colaboradoresElegiveis.mockResolvedValue([]);
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "zz");
      await dialogo.findByText(/Só aparecem colaboradores ativos, das operações do seu escopo/);
    });

    it("mudar a busca depois de escolher desfaz a escolha", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      api.colaboradoresElegiveis.mockResolvedValue([colaborador()]);
      api.usuariosElegiveis.mockResolvedValue([usuario()]);
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "ana");
      await usuarioDeTeste.click(await dialogo.findByRole("radio", { name: /Ana Souza/ }));
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar usuário/), "ana");
      await usuarioDeTeste.click(await dialogo.findByRole("radio", { name: /ana@exemplo.com/ }));
      const cadastrar = dialogo.getByRole("button", {
        name: "Cadastrar participante"
      }) as HTMLButtonElement;
      expect(cadastrar.disabled).toBe(false);

      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "s");
      expect(cadastrar.disabled).toBe(true);
    });

    it("se o servidor recusar, mostra o motivo e mantém o formulário aberto", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      api.colaboradoresElegiveis.mockResolvedValue([colaborador()]);
      api.usuariosElegiveis.mockResolvedValue([usuario()]);
      api.cadastrarParticipante.mockRejectedValue(
        erroDaApi(
          409,
          "LAB_PARTICIPANTE_JA_CADASTRADO",
          "Este usuário ou este colaborador já está cadastrado como participante."
        )
      );
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "ana");
      await usuarioDeTeste.click(await dialogo.findByRole("radio", { name: /Ana Souza/ }));
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar usuário/), "ana");
      await usuarioDeTeste.click(await dialogo.findByRole("radio", { name: /ana@exemplo.com/ }));
      await usuarioDeTeste.click(dialogo.getByRole("button", { name: "Cadastrar participante" }));

      const alerta = await dialogo.findByRole("alert");
      expect(alerta.textContent).toMatch(/já está cadastrado como participante/);
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("cancelar fecha, e abrir de novo começa do zero", async () => {
      const { usuarioDeTeste, dialogo } = await abrirFormulario();
      await usuarioDeTeste.type(dialogo.getByLabelText(/Buscar colaborador/), "ana");
      await usuarioDeTeste.click(dialogo.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("dialog")).toBeNull();

      await usuarioDeTeste.click(screen.getByRole("button", { name: "Cadastrar participante" }));
      expect((screen.getByLabelText(/Buscar colaborador/) as HTMLInputElement).value).toBe("");
    });
  });
});
