// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../../../test/render";
import { situacao } from "../../../test/dados-do-lab";
import { SituacaoDoTeste } from "./situacao-do-teste";

function montar(extra: { desabilitado?: boolean; numero?: number } = {}) {
  const aoConfirmar = vi.fn();
  const usuario = userEvent.setup();
  render(
    <SituacaoDoTeste
      situacao={situacao(extra.numero ?? 1)}
      desabilitado={extra.desabilitado ?? false}
      aoConfirmar={aoConfirmar}
    />
  );
  const radio = (letra: string) => screen.getByRole("radio", { name: new RegExp(`^${letra}\\.`) });
  const confirmar = () => screen.getByRole("button", { name: "Confirmar resposta" });
  return { aoConfirmar, usuario, radio, confirmar };
}

describe("SituacaoDoTeste", () => {
  it("mostra o texto da situação e as três opções, nada além", () => {
    montar();
    expect(screen.getByText("Texto da situação 1.")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByText(/aderência/i)).toBeNull();
  });

  it("marca a situação de marco", () => {
    montar({ numero: 3 });
    expect(screen.getByText("Situação de marco")).toBeTruthy();
  });

  it("outras situações não têm o selo de marco", () => {
    montar({ numero: 2 });
    expect(screen.queryByText("Situação de marco")).toBeNull();
  });

  it("não deixa confirmar sem escolher", () => {
    const { confirmar } = montar();
    expect((confirmar() as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ["1", "A"],
    ["2", "B"],
    ["3", "C"]
  ])("a tecla %s escolhe a opção %s, mas não envia", async (tecla, letra) => {
    const { usuario, radio, confirmar, aoConfirmar } = montar();
    await usuario.keyboard(tecla);
    expect((radio(letra) as HTMLInputElement).checked).toBe(true);
    expect((confirmar() as HTMLButtonElement).disabled).toBe(false);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it("outras teclas não escolhem nada", async () => {
    const { usuario, radio } = montar();
    await usuario.keyboard("4a0 ");
    for (const letra of ["A", "B", "C"])
      expect((radio(letra) as HTMLInputElement).checked).toBe(false);
  });

  it("a tecla vale também com Ctrl: atalho do navegador não escolhe opção", async () => {
    const { usuario, radio } = montar();
    await usuario.keyboard("{Control>}1{/Control}");
    expect((radio("A") as HTMLInputElement).checked).toBe(false);
  });

  it("digitar números no campo livre escreve o número, não troca a opção", async () => {
    const { usuario, radio } = montar();
    await usuario.keyboard("2");
    await usuario.click(screen.getByLabelText(/O que mais você faria/));
    await usuario.keyboard("1 e 3");
    expect((screen.getByLabelText(/O que mais você faria/) as HTMLTextAreaElement).value).toBe(
      "1 e 3"
    );
    expect((radio("B") as HTMLInputElement).checked).toBe(true);
  });

  it("clicar escolhe a opção; confirmar envia a letra e o texto", async () => {
    const { usuario, radio, confirmar, aoConfirmar } = montar();
    await usuario.click(radio("C"));
    await usuario.type(screen.getByLabelText(/O que mais você faria/), "Chamaria o time.");
    await usuario.click(confirmar());
    expect(aoConfirmar).toHaveBeenCalledOnce();
    expect(aoConfirmar).toHaveBeenCalledWith("C", "Chamaria o time.");
  });

  it("Enter com uma opção marcada confirma (envio do formulário)", async () => {
    const { usuario, radio, aoConfirmar } = montar();
    await usuario.click(radio("A"));
    await usuario.keyboard("{Enter}");
    expect(aoConfirmar).toHaveBeenCalledWith("A", "");
  });

  it("mostra o contador do campo livre, com o teto de 1000 caracteres", async () => {
    const { usuario } = montar();
    expect(screen.getByText("0/1000")).toBeTruthy();
    await usuario.type(screen.getByLabelText(/O que mais você faria/), "abc");
    expect(screen.getByText("3/1000")).toBeTruthy();
    expect(screen.getByLabelText(/O que mais você faria/).getAttribute("maxlength")).toBe("1000");
  });

  it("desabilitado (enviando ou tempo esgotado): nada muda e nada envia, nem pelo teclado", async () => {
    const { usuario, radio, confirmar, aoConfirmar } = montar({ desabilitado: true });
    await usuario.keyboard("1");
    expect((radio("A") as HTMLInputElement).checked).toBe(false);
    // O <fieldset disabled> desabilita as opções (a propriedade .disabled não herda, o :disabled sim).
    expect(radio("A").matches(":disabled")).toBe(true);
    expect((confirmar() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(/O que mais você faria/) as HTMLTextAreaElement).disabled).toBe(
      true
    );
    expect(aoConfirmar).not.toHaveBeenCalled();
  });
});
