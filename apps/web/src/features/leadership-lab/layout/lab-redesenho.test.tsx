// @vitest-environment jsdom
// O redesenho do MY FLUX (fases 1 a 5) também vale dentro do Leadership Lab: fundo ambiente, dock no
// celular e campos com rótulo flutuante. Os tokens da paleta têm teste próprio (ui/tokens-paleta.test.ts).
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderizar } from "../../../test/render";
import { Input, Select } from "../ui";
import { LabShell } from "./lab-shell";

const usuarioAtual = vi.hoisted(() => ({
  data: undefined as
    undefined | { id: string; name: string; email: string; role: string; scopes: never[] }
}));
vi.mock("../../auth/use-usuario-atual", async () => ({
  useUsuarioAtual: () => usuarioAtual,
  chaveDoUsuarioAtual: ["auth", "me"]
}));

beforeEach(() => {
  usuarioAtual.data = { id: "u1", name: "Ana", email: "a@b.c", role: "RH", scopes: [] };
  vi.stubEnv("VITE_MODO_TESTE_SEM_LOGIN", "false");
});

const abrir = (rota: string) =>
  renderizar(
    <LabShell breadcrumbs={["MY FLUX", "Leadership Lab"]}>
      <h1>Página</h1>
    </LabShell>,
    { rota, caminho: "/lab/*" }
  );

describe("shell do Lab: base do redesenho", () => {
  it("tem o fundo ambiente e o dock de navegação (celular)", () => {
    const { container } = abrir("/lab/rh/visao-geral");
    expect(container.querySelector(".fundo-ambiente")).not.toBeNull();
    expect(container.querySelector(".fundo-ambiente.fundo-parado")).toBeNull();
    const dock = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(dock.className).toContain("lg:hidden");
  });

  it("durante o teste cronometrado, o fundo fica parado e o dock não aparece", () => {
    const { container } = abrir("/lab/teste");
    expect(container.querySelector(".fundo-ambiente.fundo-parado")).not.toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
  });
});

describe("campos do Lab com rótulo flutuante", () => {
  it("o rótulo é o nome do campo e o erro fica de fora dele, como alerta", () => {
    render(<Input label="E-mail" error="Informe o e-mail" />);
    const campo = screen.getByLabelText("E-mail");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Informe o e-mail");
    expect(campo.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("o texto de exemplo só aparece com o foco (não fica sobre o rótulo)", () => {
    render(<Input label="Buscar" placeholder="Nome ou matrícula" />);
    const campo = screen.getByLabelText("Buscar") as HTMLInputElement;
    expect(campo.placeholder).toBe("Nome ou matrícula");
    expect(campo.className).toContain("placeholder:text-transparent");
    expect(campo.className).toContain("focus:placeholder:text-lab-tinta-3");
  });

  it("a seleção mantém rótulo e opções", () => {
    render(<Select label="Turno" options={[{ value: "D", label: "Diurno" }]} defaultValue="D" />);
    expect((screen.getByLabelText("Turno") as HTMLSelectElement).value).toBe("D");
  });
});
