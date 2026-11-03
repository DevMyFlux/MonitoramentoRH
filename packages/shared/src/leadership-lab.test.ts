import { describe, expect, it } from "vitest";
import {
  labAderenciaEscala,
  labEstilos,
  labMoldeNiveis,
  labMoldesPiloto,
  labSkillsPiloto
} from "./leadership-lab.js";

describe("Leadership Lab: valores fechados", () => {
  it("tem as 8 skills do piloto: 4 hard e 4 soft, com ids únicos em formato slug", () => {
    expect(labSkillsPiloto).toHaveLength(8);
    expect(labSkillsPiloto.filter((s) => s.tipo === "hard")).toHaveLength(4);
    expect(labSkillsPiloto.filter((s) => s.tipo === "soft")).toHaveLength(4);
    const ids = labSkillsPiloto.map((s) => s.id);
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("tem um molde por nível de liderança, cada um com temas", () => {
    expect(labMoldesPiloto.map((m) => m.nivel)).toEqual([...labMoldeNiveis]);
    for (const molde of labMoldesPiloto) expect(molde.temas.length).toBeGreaterThanOrEqual(4);
  });

  it("usa a escala de aderência 100, 70, 40, 10 e 0, em ordem decrescente", () => {
    expect([...labAderenciaEscala]).toEqual([100, 70, 40, 10, 0]);
  });

  it("tem os quatro estilos da Liderança Situacional", () => {
    expect([...labEstilos]).toEqual(["direcao", "orientacao", "apoio", "delegacao"]);
  });
});
