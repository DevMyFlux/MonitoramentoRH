// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../../../test/render";
import { MapaDoCaminho } from "./mapa-do-caminho";

describe("MapaDoCaminho", () => {
  it("mostra a situação atual e o total, e marca o passo atual para tecnologia assistiva", () => {
    render(<MapaDoCaminho total={5} atual={3} marco={3} />);

    expect(screen.getByText("Situação 3 de 5")).toBeTruthy();
    const passos = within(screen.getByRole("list", { name: "Mapa do caminho" })).getAllByRole(
      "listitem"
    );
    expect(passos).toHaveLength(5);
    expect(passos.map((p) => p.getAttribute("aria-current"))).toEqual([
      null,
      null,
      "step",
      null,
      null
    ]);
  });

  it("diz, em texto, o que cada passo é: feita, em andamento ou a seguir, e onde fica o marco", () => {
    render(<MapaDoCaminho total={5} atual={3} marco={3} />);

    expect(screen.getByText("Situação 1: feita")).toBeTruthy();
    expect(screen.getByText("Situação 2: feita")).toBeTruthy();
    expect(screen.getByText("Situação 3, marco: em andamento")).toBeTruthy();
    expect(screen.getByText("Situação 4: a seguir")).toBeTruthy();
    expect(screen.getByText("Situação 5: a seguir")).toBeTruthy();
  });

  it("na primeira situação nada está feito", () => {
    render(<MapaDoCaminho total={5} atual={1} marco={3} />);
    expect(screen.getByText("Situação 1: em andamento")).toBeTruthy();
    expect(screen.queryByText(/: feita$/)).toBeNull();
  });
});
