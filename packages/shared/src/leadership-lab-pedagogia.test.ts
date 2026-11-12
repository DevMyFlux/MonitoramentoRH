import { describe, expect, it } from "vitest";
import { labMoldeNiveis, labSkillsPiloto } from "./leadership-lab.js";
import {
  fundamentacaoFinal,
  labEnquadramentoPorMolde,
  labRubrica,
  labSkillsTransversais
} from "./leadership-lab-pedagogia.js";

const skills = new Set<string>(labSkillsPiloto.map((s) => s.id));
const tecnicas = labSkillsPiloto.filter((s) => s.tipo === "hard").map((s) => s.id);

describe("enquadramento pedagógico por cargo", () => {
  it("cobre os três moldes, com responsabilidades e foco só em skills do piloto", () => {
    for (const nivel of labMoldeNiveis) {
      const e = labEnquadramentoPorMolde[nivel];
      expect(e.responsabilidades.length).toBeGreaterThanOrEqual(5);
      expect(new Set(e.foco).size).toBe(e.foco.length);
      for (const s of e.foco) expect(skills.has(s)).toBe(true);
    }
  });

  it("toda skill técnica tem uma profundidade definida em cada cargo", () => {
    for (const nivel of labMoldeNiveis) {
      for (const s of tecnicas) {
        expect(
          labEnquadramentoPorMolde[nivel].profundidadeTecnica[s],
          `${nivel}/${s}`
        ).toBeDefined();
      }
    }
  });

  it("conhecimento técnico é cobrado proporcionalmente: o coordenador não vai além da noção em NR/POP e OS", () => {
    const c = labEnquadramentoPorMolde.coordenador.profundidadeTecnica;
    expect(c["aplicacao-nr-pop"]).toBe("nocao");
    expect(c["gestao-os"]).toBe("nocao");
    expect(labEnquadramentoPorMolde.coordenador.limiteTecnico).toMatch(/diagnosticar tecnicamente/);
    expect(labEnquadramentoPorMolde.encarregado.profundidadeTecnica["aplicacao-nr-pop"]).toBe(
      "aplicacao"
    );
  });

  it("as competências de comportamento aparecem no foco ou no que é transversal a todos", () => {
    for (const s of labSkillsTransversais) expect(skills.has(s)).toBe(true);
    for (const nivel of labMoldeNiveis) {
      const foco = labEnquadramentoPorMolde[nivel].foco;
      expect(foco.some((s) => (labSkillsTransversais as readonly string[]).includes(s))).toBe(true);
    }
  });
});

describe("rubrica", () => {
  it("tem exatamente a escala do sistema, da melhor à pior, e um critério para cada skill", () => {
    expect(labRubrica.niveis.map((n) => n.aderencia)).toEqual([100, 70, 40, 10]);
    expect(Object.keys(labRubrica.observar).sort()).toEqual([...skills].sort());
  });

  it("nasce não validada e versionada", () => {
    expect(labRubrica.validada).toBe(false);
    expect(labRubrica.versao).toMatch(/^\d{4}-\d{2}-\d+$/);
  });
});

describe("fundamentacaoFinal", () => {
  it("só é validada com a IA dizendo validada E a rubrica validada", () => {
    expect(fundamentacaoFinal("validada", true)).toBe("validada");
    expect(fundamentacaoFinal("validada", false)).toBe("experimental");
    expect(fundamentacaoFinal("experimental", true)).toBe("experimental");
  });
  it("na dúvida (IA que não informou), é experimental", () => {
    expect(fundamentacaoFinal(undefined, true)).toBe("experimental");
  });
  it("com a rubrica em vigor (hoje não validada), nada é oficial", () => {
    expect(fundamentacaoFinal("validada")).toBe("experimental");
  });
});
