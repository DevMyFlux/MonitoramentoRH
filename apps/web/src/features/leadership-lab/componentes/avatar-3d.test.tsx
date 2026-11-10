// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../../../test/render";
import { amortecer, poses } from "./avatar-poses";
import { AvatarFacilitador3D } from "./avatar-facilitador-3d";
import type { EstadoDoAvatar } from "./avatar-facilitador";

const estados: EstadoDoAvatar[] = ["falando", "ouvindo", "refletindo", "feedback"];

describe("AvatarFacilitador3D", () => {
  it("sem WebGL (jsdom), mostra o avatar 2D com o mesmo rótulo e estado", () => {
    for (const estado of estados) {
      const { unmount } = render(<AvatarFacilitador3D estado={estado} />);
      const figura = screen.getByRole("img");
      expect(figura.getAttribute("aria-label")).toMatch(/^Facilitador, /);
      expect(figura.getAttribute("data-estado")).toBe(estado);
      expect(figura.getAttribute("data-modo")).toBeNull();
      unmount();
    }
  });
});

describe("poses do facilitador", () => {
  it("cada estado tem a sua pose, e só o feedback faz joinha", () => {
    expect(Object.keys(poses).sort()).toEqual([...estados].sort());
    expect(estados.filter((e) => poses[e].polegar)).toEqual(["feedback"]);
  });

  it("só falando mexe a boca; só refletindo flutua", () => {
    expect(estados.filter((e) => poses[e].fala)).toEqual(["falando"]);
    expect(estados.filter((e) => poses[e].flutua)).toEqual(["refletindo"]);
  });

  it("ouvindo inclina a cabeça; falando levanta o braço para apontar", () => {
    expect(poses.ouvindo.cabecaZ).not.toBe(0);
    expect(poses.falando.bracoX).toBeLessThan(poses.ouvindo.bracoX);
  });
});

describe("amortecer", () => {
  it("aproxima do alvo sem ultrapassar, e com taxa alta chega nele", () => {
    const passo = amortecer(0, 10, 7, 0.016);
    expect(passo).toBeGreaterThan(0);
    expect(passo).toBeLessThan(10);
    expect(amortecer(0, 10, 1000, 0.05)).toBeCloseTo(10, 5);
  });

  it("não depende da taxa de quadros: dois passos de dt valem um de 2·dt", () => {
    const dois = amortecer(amortecer(0, 1, 5, 0.01), 1, 5, 0.01);
    expect(dois).toBeCloseTo(amortecer(0, 1, 5, 0.02), 10);
  });
});
