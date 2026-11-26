// @vitest-environment jsdom
// Páginas só da equipe: o COMUM, que só tem o Leadership Lab, é levado para lá.
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUsuarioAtual } from "../auth/use-usuario-atual";
import { renderizar } from "../../test/render";
import { SoParaEquipe } from "./so-para-equipe";

vi.mock("../auth/use-usuario-atual", () => ({ useUsuarioAtual: vi.fn() }));
const usuario = vi.mocked(useUsuarioAtual);
const como = (parcial: object) =>
  usuario.mockReturnValue(parcial as ReturnType<typeof useUsuarioAtual>);

const abrir = () =>
  renderizar(
    <SoParaEquipe>
      <p>página da equipe</p>
    </SoParaEquipe>,
    { rota: "/treinamentos", caminho: "/treinamentos" }
  );

beforeEach(() => vi.resetAllMocks());

describe("SoParaEquipe", () => {
  it("o COMUM vai para o Leadership Lab e nunca vê a página", () => {
    como({ isPending: false, data: { role: "COMUM" } });
    abrir();
    expect(screen.getByTestId("local").textContent).toBe("/lab");
    expect(screen.queryByText("página da equipe")).toBeNull();
  });

  it.each(["DEV", "ADMIN", "RH"])("%s vê a página", (role) => {
    como({ isPending: false, data: { role } });
    abrir();
    expect(screen.getByText("página da equipe")).toBeTruthy();
  });

  it("enquanto não sabe quem é, não mostra a página nem decide", () => {
    como({ isPending: true, data: undefined });
    abrir();
    expect(screen.queryByText("página da equipe")).toBeNull();
    expect(screen.queryByTestId("local")).toBeNull();
  });
});
