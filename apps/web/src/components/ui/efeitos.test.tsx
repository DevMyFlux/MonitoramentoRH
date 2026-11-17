// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "./avatar";
import { BotaoEstrela } from "./botao-estrela";
import { CampoDeSelecao, CampoDeTexto } from "./campo-flutuante";
import { CartaoSpotlight } from "./cartao-spotlight";
import { Dica } from "./dica";
import { Etapas } from "./etapas";
import { EquipesPorTurno, ListaDePendencias, ProgressoDoFluxo } from "./escalas";
import { faisca } from "./faisca";
import { LinhaDoTempo, PastaDeDocumentos } from "./ficha";
import { Interruptor } from "./interruptor";
import { TituloDePagina } from "./titulo-de-pagina";

afterEach(cleanup);

describe("Interruptor", () => {
  function Exemplo() {
    const [ligado, setLigado] = useState(false);
    return (
      <Interruptor
        rotulo="Mostrar desligados"
        checked={ligado}
        onChange={(e) => setLigado(e.target.checked)}
      />
    );
  }
  it("é um switch nativo: clica, usa o teclado e expõe o estado", async () => {
    render(<Exemplo />);
    const sw = screen.getByRole("switch", { name: "Mostrar desligados" }) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    await userEvent.click(sw);
    expect(sw.checked).toBe(true);
    sw.focus();
    await userEvent.keyboard(" ");
    expect(sw.checked).toBe(false);
  });
});

describe("Dica", () => {
  it("é focável e traz o texto também no aria-label (toque, teclado e leitor de tela)", () => {
    render(<Dica texto="Escala comercial: de segunda a sexta">5x2</Dica>);
    const gatilho = screen.getByLabelText("Escala comercial: de segunda a sexta");
    expect(gatilho.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tooltip").textContent).toBe("Escala comercial: de segunda a sexta");
  });
});

describe("BotaoEstrela", () => {
  it("é um botão normal; desativado, para a borda e não dispara o clique", async () => {
    let cliques = 0;
    const { container, rerender } = render(
      <BotaoEstrela onClick={() => cliques++}>Novo colaborador</BotaoEstrela>
    );
    await userEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));
    expect(cliques).toBe(1);
    expect(container.querySelector("[data-desativado]")).toBeNull();
    rerender(
      <BotaoEstrela disabled onClick={() => cliques++}>
        Novo colaborador
      </BotaoEstrela>
    );
    await userEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));
    expect(cliques).toBe(1);
    expect(container.querySelector("[data-desativado]")).not.toBeNull();
  });
});

describe("CartaoSpotlight", () => {
  it("grava a posição do ponteiro em variáveis CSS e mantém o conteúdo", () => {
    render(<CartaoSpotlight data-testid="c">Conteúdo</CartaoSpotlight>);
    const c = screen.getByTestId("c");
    fireEvent.pointerMove(c, { clientX: 30, clientY: 12 });
    expect(c.style.getPropertyValue("--x")).toBe("30px");
    expect(c.style.getPropertyValue("--y")).toBe("12px");
    expect(c.textContent).toBe("Conteúdo");
  });
});

describe("Avatar", () => {
  it("usa a primeira e a última inicial e some para o leitor de tela", () => {
    const { container } = render(<Avatar nome="ana beatriz souza" tom="ativo" />);
    const el = container.firstElementChild!;
    expect(el.textContent).toBe("AS");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
  it("um nome só dá uma inicial", () => {
    const { container } = render(<Avatar nome="Madonna" />);
    expect(container.textContent).toBe("M");
  });
});

describe("TituloDePagina", () => {
  it("tem um único h1, a etiqueta, a descrição e as ações", () => {
    render(
      <TituloDePagina
        etiqueta="MY FLUX · Pessoas"
        titulo="Colaboradores"
        descricao="Cadastro único"
        acoes={<button>Ir</button>}
      />
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("MY FLUX · Pessoas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ir" })).toBeTruthy();
  });
});

describe("CampoDeTexto e CampoDeSelecao (rótulo flutuante)", () => {
  it("o rótulo está ligado ao campo, o obrigatório é marcado e o erro vira alerta", () => {
    render(
      <CampoDeTexto
        rotulo="Matrícula"
        valor=""
        aoMudar={() => undefined}
        obrigatorio
        erro="Informe a matrícula"
      />
    );
    const campo = screen.getByLabelText(/^Matrícula/);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect((campo as HTMLInputElement).required).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Informe a matrícula");
    expect(campo.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("a ajuda aparece quando não há erro; digitar chama aoMudar", async () => {
    let valor = "";
    render(
      <CampoDeTexto
        rotulo="Nome"
        valor={valor}
        aoMudar={(v) => (valor = v)}
        ajuda="Como no documento"
      />
    );
    expect(screen.getByText("Como no documento")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Nome"), "A");
    expect(valor).toBe("A");
  });

  it("a seleção mostra as opções e avisa a escolha", async () => {
    let escolhido = "";
    render(
      <CampoDeSelecao
        rotulo="Turno"
        valor=""
        aoMudar={(v) => (escolhido = v)}
        opcoes={[
          { value: "", label: "Selecione" },
          { value: "D", label: "Diurno" }
        ]}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText("Turno"), "D");
    expect(escolhido).toBe("D");
  });
});

describe("Etapas", () => {
  const passos = [
    {
      id: "a",
      rotulo: "Dados",
      conteudo: <p>conteúdo A</p>,
      validar: (): string | null => "Falta algo"
    },
    { id: "b", rotulo: "Contrato", conteudo: <p>conteúdo B</p> }
  ];
  function Exemplo() {
    const [atual, setAtual] = useState(0);
    const [aviso, setAviso] = useState("");
    return (
      <Etapas
        passos={passos}
        atual={atual}
        aoMudar={setAtual}
        aviso={aviso}
        aoAvisar={setAviso}
        acaoFinal={<button>Concluir</button>}
      />
    );
  }
  it("bloqueia o avanço com aviso, avança quando liberado e mostra a ação final no último passo", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toBe("Falta algo");
    expect(screen.getByText("conteúdo A")).toBeTruthy();
    passos[0]!.validar = () => null;
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("conteúdo B")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("conteúdo A")).toBeTruthy();
  });
});

describe("LinhaDoTempo e PastaDeDocumentos", () => {
  it("vazios, explicam com simpatia", () => {
    render(
      <>
        <LinhaDoTempo momentos={[]} aoRemover={() => undefined} />
        <PastaDeDocumentos documentos={[]} />
      </>
    );
    expect(screen.getByText("Nenhum afastamento registrado")).toBeTruthy();
    expect(screen.getByText("A pasta está vazia")).toBeTruthy();
  });

  it("só o ASO ou NR vencido recebe a borda de urgência", () => {
    const doc = (id: string, nome: string, situacao: "vencido" | "em-dia", critico: boolean) => ({
      id,
      nome,
      codigo: id,
      validade: "2026-01-01",
      situacao,
      critico,
      detalhe: "x"
    });
    render(
      <PastaDeDocumentos
        documentos={[
          doc("1", "ASO", "vencido", true),
          doc("2", "Diploma", "vencido", false),
          doc("3", "NR-32", "em-dia", true)
        ]}
      />
    );
    expect(screen.getByText("ASO").closest("li")!.className).toContain("borda-eletrica");
    expect(screen.getByText("Diploma").closest("li")!.className).not.toContain("borda-eletrica");
    expect(screen.getByText("NR-32").closest("li")!.className).not.toContain("borda-eletrica");
  });
});

describe("peças de Escalas", () => {
  it("o andamento marca a etapa atual e trata a escala arquivada", () => {
    const { rerender } = render(<ProgressoDoFluxo status="IN_REVIEW" />);
    expect(screen.getByText("Em aprovação").closest("li")!.getAttribute("aria-current")).toBe(
      "step"
    );
    expect(screen.getByText("Rascunho").textContent).toContain("concluída");
    rerender(<ProgressoDoFluxo status="ARCHIVED" />);
    expect(screen.getByText("Escala arquivada")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("a lista de pendências mostra poucas e abre todas sob demanda", async () => {
    const itens = Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      pessoa: `Pessoa ${i}`,
      data: "2026-10-01",
      motivos: ["X"]
    }));
    render(<ListaDePendencias itens={itens} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: "Mostrar todas (9)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    await userEvent.click(screen.getByRole("button", { name: "Mostrar menos" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("sem pendências, a lista não aparece", () => {
    const { container } = render(<ListaDePendencias itens={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("equipes por turno: contam as pessoas e usam a luz azul na noite", () => {
    render(
      <EquipesPorTurno
        equipes={[
          { nome: "Diurno Par", pessoas: 1 },
          { nome: "Noturno Ímpar", pessoas: 4 }
        ]}
      />
    );
    expect(screen.getByText("pessoa")).toBeTruthy();
    expect(screen.getByText("pessoas")).toBeTruthy();
    const noite = screen.getByText("Noturno Ímpar").closest(".spotlight") as HTMLElement;
    expect(noite.style.getPropertyValue("--spot")).toBe("var(--mf-azul)");
  });

  it("a faísca cria partículas que somem e não faz nada sem origem", () => {
    faisca(null);
    expect(document.body.querySelectorAll("span[aria-hidden]").length).toBe(0);
    faisca({ x: 10, y: 10 });
    // jsdom não tem Web Animations: as partículas são removidas na hora, sem sobrar lixo.
    expect(document.body.querySelectorAll("span[style*='fixed']").length).toBe(0);
  });
});
