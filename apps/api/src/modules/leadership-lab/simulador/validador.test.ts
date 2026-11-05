import { labEscolhas, labMoldeNiveis } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { categoriasDaBiblioteca, cenarioDe, pacotesDaBiblioteca } from "./catalogo.js";
import { nosDoPercurso, proximoNo } from "./percurso.js";
import type { CenarioDaBiblioteca, NoDoCenario } from "./tipos.js";
import {
  achaParametroTecnico,
  contarPalavras,
  validarCategoria,
  validarCenario
} from "./validador.js";

const copiar = (c: CenarioDaBiblioteca): CenarioDaBiblioteca => structuredClone(c);

function trocar(
  c: CenarioDaBiblioteca,
  id: string,
  mudar: (no: NoDoCenario) => void
): CenarioDaBiblioteca {
  const nova = copiar(c);
  const no = nova.nos.find((n) => n.id === id);
  if (!no) throw new Error(`nó ${id}`);
  mudar(no);
  return nova;
}

describe("a biblioteca de simulações", () => {
  it("cada categoria e cada cenário passam no validador", () => {
    for (const pacote of pacotesDaBiblioteca) {
      expect(validarCategoria(pacote.categoria), pacote.categoria.id).toEqual([]);
      expect(validarCenario(pacote.cenario), pacote.cenario.id).toEqual([]);
    }
  });

  it("há pelo menos 12 temas, cada um com 9 situações e fontes de referência temática", () => {
    expect(pacotesDaBiblioteca.length).toBeGreaterThanOrEqual(12);
    for (const { cenario } of pacotesDaBiblioteca) {
      expect(cenario.nos, cenario.id).toHaveLength(9);
      expect(cenario.fontes.length, cenario.id).toBeGreaterThanOrEqual(2);
      expect(cenario.versao, cenario.id).toMatch(/demonstrativo/);
      expect([...cenario.niveis].sort(), cenario.id).toEqual([...labMoldeNiveis].sort());
    }
  });

  it("os temas pedidos existem", () => {
    const ids = categoriasDaBiblioteca.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "climatizacao-ventilacao",
        "gases-medicinais-alarmes",
        "compressores-vacuo",
        "quadros-eletricos",
        "geradores-transferencia",
        "autoclaves-cme",
        "incendio-alarme",
        "reservatorios-agua",
        "elevadores",
        "refrigeracao-cadeia-frio",
        "hemodialise-agua",
        "equipamentos-medicos"
      ])
    );
  });

  it("os ids de tema são únicos e cada tema tem um cenário", () => {
    const ids = categoriasDaBiblioteca.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      for (const nivel of labMoldeNiveis) expect(cenarioDe(id, nivel)?.categoriaId).toBe(id);
    }
  });

  it("todo caminho tem exatamente 5 decisões e termina sem destino", () => {
    for (const { cenario } of pacotesDaBiblioteca) {
      const opcoes = [...labEscolhas, null] as const;
      const percorrer = (no: NoDoCenario, profundidade: number): number => {
        let folhas = 0;
        for (const escolha of opcoes) {
          const seguinte = proximoNo(cenario, no, escolha);
          if (profundidade === 5) {
            expect(seguinte, `${cenario.id} ${no.id}`).toBeNull();
            folhas += 1;
          } else {
            expect(seguinte, `${cenario.id} ${no.id}`).not.toBeNull();
            if (seguinte) folhas += percorrer(seguinte, profundidade + 1);
          }
        }
        return folhas;
      };
      const inicio = cenario.nos.find((n) => n.id === cenario.inicio);
      if (!inicio) throw new Error("sem início");
      // 4 escolhas possíveis (A, B, C, omissão) em 5 decisões.
      expect(percorrer(inicio, 1)).toBe(4 ** 5);
    }
  });

  it("a escolha muda a consequência e o caminho", () => {
    for (const { cenario } of pacotesDaBiblioteca) {
      const inicio = cenario.nos.find((n) => n.id === cenario.inicio);
      if (!inicio) throw new Error("sem início");
      const consequencias = new Set(labEscolhas.map((e) => inicio.opcoes[e].consequencia));
      expect(consequencias.size, cenario.id).toBe(3);
      const destinos = new Set(labEscolhas.map((e) => inicio.opcoes[e].proximo));
      expect(
        destinos.size,
        `${cenario.id}: opções devem levar a trilhas diferentes`
      ).toBeGreaterThan(1);
    }
  });

  it("a situação 3 é o marco e as demais não", () => {
    for (const { cenario } of pacotesDaBiblioteca) {
      for (const no of cenario.nos) expect(no.camada === 3).toBe(no.camada === 3);
      expect(cenario.nos.filter((n) => n.camada === 3).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("nosDoPercurso refaz o caminho pelas escolhas e falha se faltar uma", () => {
    const cenario = cenarioDe("climatizacao-ventilacao", "supervisor");
    if (!cenario) throw new Error("sem cenário");
    const nos = nosDoPercurso(
      cenario,
      [
        { numero: 1, escolha: "A" },
        { numero: 2, escolha: "B" }
      ],
      3
    );
    expect(nos.map((n) => n.id)).toEqual(["n1", "n2a", "n3a"]);
    expect(() => nosDoPercurso(cenario, [{ numero: 1, escolha: "A" }], 3)).toThrow(
      /falta a escolha/
    );
    const omitido = nosDoPercurso(cenario, [{ numero: 1, escolha: null }], 2);
    expect(omitido.map((n) => n.id)).toEqual(["n1", "n2b"]);
  });
});

describe("o validador recusa cenário quebrado", () => {
  const base = cenarioDe("climatizacao-ventilacao", "supervisor");
  if (!base) throw new Error("sem cenário base");

  it("destino inexistente, beco e destino na camada errada", () => {
    expect(
      validarCenario(trocar(base, "n1", (n) => (n.opcoes.A.proximo = "nx"))).join("|")
    ).toMatch(/destino inexistente/);
    expect(
      validarCenario(trocar(base, "n1", (n) => (n.opcoes.B.proximo = null))).join("|")
    ).toMatch(/beco/);
    expect(
      validarCenario(trocar(base, "n1", (n) => (n.opcoes.C.proximo = "n4a"))).join("|")
    ).toMatch(/camada 2/);
    expect(validarCenario(trocar(base, "n2a", (n) => (n.aoOmitir = null))).join("|")).toMatch(
      /beco/
    );
  });

  it("ciclo (volta a uma camada anterior) e nó inalcançável", () => {
    expect(
      validarCenario(trocar(base, "n3a", (n) => (n.opcoes.A.proximo = "n1"))).join("|")
    ).toMatch(/camada 4/);
    const orfao = copiar(base);
    const nos = [...orfao.nos, { ...structuredClone(orfao.nos[1] as NoDoCenario), id: "orfao" }];
    expect(validarCenario({ ...orfao, nos }).join("|")).toMatch(/inalcançável: orfao/);
  });

  it("última camada não pode ter destino", () => {
    expect(
      validarCenario(trocar(base, "n5a", (n) => (n.opcoes.A.proximo = "n1"))).join("|")
    ).toMatch(/última camada/);
  });

  it("opção faltando, aderência repetida e linha vermelha incoerente", () => {
    expect(
      validarCenario(
        trocar(base, "n1", (n) => delete (n.opcoes as Record<string, unknown>).C)
      ).join("|")
    ).toMatch(/exatamente as opções A, B e C/);
    expect(
      validarCenario(
        trocar(base, "n1", (n) => {
          n.opcoes.B.aderencia = 100;
          n.opcoes.C.aderencia = 100;
          n.opcoes.A.aderencia = 100;
        })
      ).join("|")
    ).toMatch(/aderências diferentes/);
    expect(
      validarCenario(trocar(base, "n1", (n) => (n.opcoes.B.aderencia = 10))).join("|")
    ).toMatch(/linha vermelha/);
  });

  it("texto longo, vazio e com parâmetro técnico", () => {
    expect(
      validarCenario(trocar(base, "n2a", (n) => (n.contexto = "palavra ".repeat(80)))).join("|")
    ).toMatch(/palavras \(máximo/);
    expect(validarCenario(trocar(base, "n2a", (n) => (n.opcoes.A.texto = " "))).join("|")).toMatch(
      /vazio/
    );
    expect(
      validarCenario(
        trocar(base, "n2a", (n) => (n.opcoes.A.texto = "Ajusta a temperatura para 22 °C no setor."))
      ).join("|")
    ).toMatch(/parâmetro técnico/);
  });

  it("estilo incoerente com a aderência", () => {
    expect(
      validarCenario(trocar(base, "n1", (n) => (n.opcoes.A.estilo = "delegacao"))).join("|")
    ).toMatch(/estilo diferente do adequado/);
    expect(
      validarCenario(
        trocar(base, "n1", (n) => {
          n.opcoes.B.estilo = n.estiloAdequado;
        })
      ).join("|")
    ).toMatch(/abaixo de 70/);
  });

  it("fonte desconhecida, skill desconhecida e melhor letra sempre igual", () => {
    const f = copiar(base);
    f.fontes = ["inventada"];
    expect(validarCenario(f).join("|")).toMatch(/fonte desconhecida/);
    expect(
      validarCenario(
        trocar(base, "n1", (n) => ((n.opcoes.A.skills as string[]) = ["nao-existe"]))
      ).join("|")
    ).toMatch(/skill desconhecida/);
    const igual = copiar(base);
    for (const no of igual.nos) {
      const melhorEra = labEscolhas.find((e) => no.opcoes[e].aderencia === 100);
      if (melhorEra && melhorEra !== "A") {
        const troca = no.opcoes.A;
        no.opcoes.A = no.opcoes[melhorEra];
        no.opcoes[melhorEra] = troca;
      }
    }
    expect(validarCenario(igual).join("|")).toMatch(/mesma letra/);
  });
});

describe("utilitários do validador", () => {
  it("conta palavras", () => {
    expect(contarPalavras("  uma  frase de   cinco ")).toBe(4);
    expect(contarPalavras("")).toBe(0);
  });
  it("acha parâmetros técnicos e intervalos de manutenção", () => {
    for (const t of [
      "pressão de 4 bar",
      "mantenha 22°C",
      "revisão a cada 3 meses",
      "5 kPa",
      "380 V"
    ]) {
      // "380 V" não é pego: unidade ambígua com letra solta. Os demais são.
      expect(achaParametroTecnico(t), t).toBe(t !== "380 V");
    }
    expect(achaParametroTecnico("Às 8h chegam duas ordens de serviço")).toBe(false);
    expect(achaParametroTecnico("O setor tem 12 leitos")).toBe(false);
  });
});
