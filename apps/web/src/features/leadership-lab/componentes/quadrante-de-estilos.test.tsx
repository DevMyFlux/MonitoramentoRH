// @vitest-environment jsdom
import type { LabTipoDePerfil } from "@my-flux/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../../../test/render";
import { QuadranteDeEstilos } from "./quadrante-de-estilos";

type Perfil = Extract<LabTipoDePerfil, { disponivel: true }>;

const perfil = (extra: Partial<Perfil> = {}): Perfil => ({
  disponivel: true,
  estiloPredominante: "orientacao",
  estilosEmpatados: ["orientacao"],
  distribuicao: { direcao: 1, orientacao: 6, apoio: 2, delegacao: 1 },
  flexibilidade: "media",
  flexibilidadePct: 62.5,
  nEscolhas: 10,
  testesConsiderados: 3,
  testesAguardandoValidacao: 1,
  ...extra
});

describe("QuadranteDeEstilos", () => {
  it("mostra os quatro estilos com a quantidade de escolhas de cada um", () => {
    render(<QuadranteDeEstilos perfil={perfil()} />);
    // O nome do estilo predominante aparece também no resumo; a primeira ocorrência é a da célula.
    const celula = (nome: string) => screen.getAllByText(nome)[0]?.parentElement?.textContent;
    for (const nome of ["Direção", "Orientação", "Apoio", "Delegação"]) {
      expect(celula(nome), nome).toBeTruthy();
    }
    expect(celula("Orientação")).toContain("6escolhas");
    expect(celula("Direção")).toContain("1escolha");
    expect(celula("Apoio")).toContain("2escolhas");
  });

  it("diz o estilo predominante e a flexibilidade, com o percentual", () => {
    render(<QuadranteDeEstilos perfil={perfil()} />);
    expect(screen.getByText("Estilo predominante").nextElementSibling?.textContent).toBe(
      "Orientação"
    );
    expect(screen.getByText("Flexibilidade").nextElementSibling?.textContent).toBe("Média (62,5%)");
  });

  it("empate: não escolhe um em silêncio, diz entre quais", () => {
    render(
      <QuadranteDeEstilos
        perfil={perfil({
          estiloPredominante: null,
          estilosEmpatados: ["direcao", "apoio"],
          distribuicao: { direcao: 3, orientacao: 1, apoio: 3, delegacao: 0 },
          nEscolhas: 7
        })}
      />
    );
    expect(screen.getByText("Estilo predominante").nextElementSibling?.textContent).toBe(
      "Empate entre Direção e Apoio"
    );
  });

  it("sem escolhas que envolvam a equipe, diz isso (e não inventa estilo nem flexibilidade)", () => {
    render(
      <QuadranteDeEstilos
        perfil={perfil({
          estiloPredominante: null,
          estilosEmpatados: [],
          distribuicao: { direcao: 0, orientacao: 0, apoio: 0, delegacao: 0 },
          flexibilidade: null,
          flexibilidadePct: null,
          nEscolhas: 0
        })}
      />
    );
    expect(screen.getByText("Estilo predominante").nextElementSibling?.textContent).toBe(
      "Ainda sem escolhas que envolvam a equipe"
    );
    expect(screen.getByText("Flexibilidade").nextElementSibling?.textContent).toBe("—");
  });

  it("diz em quantos testes se baseia e quantos aguardam validação", () => {
    render(<QuadranteDeEstilos perfil={perfil()} />);
    expect(
      screen.getByText("Baseado em 10 escolhas de 3 testes, dos quais 1 aguardando validação.")
    ).toBeTruthy();
  });
});
