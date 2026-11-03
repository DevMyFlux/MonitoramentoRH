// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../../../test/render";
import { TermoDeCiencia } from "./termo-de-ciencia";

function montar(extra: { aceitando?: boolean; erro?: { titulo: string; descricao: string } } = {}) {
  const aoAceitar = vi.fn();
  render(
    <TermoDeCiencia
      versao="2026-1"
      aceitando={extra.aceitando ?? false}
      erro={extra.erro ? { tipo: "tentar-de-novo", podeTentarDeNovo: true, ...extra.erro } : null}
      aoAceitar={aoAceitar}
    />
  );
  return { aoAceitar, usuario: userEvent.setup() };
}

describe("TermoDeCiencia", () => {
  it("diz o que o sistema faz e avisa que o texto completo ainda é provisório (a versão aparece)", () => {
    montar();
    expect(screen.getByText(/Nenhum dado pessoal seu/)).toBeTruthy();
    expect(screen.getByText(/validado pelo RH/)).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("versão 2026-1");
    expect(screen.getByRole("note").textContent).toContain("ainda será definido");
  });

  it("só deixa aceitar depois de marcar 'li e estou ciente'", async () => {
    const { aoAceitar, usuario } = montar();
    const botao = screen.getByRole("button", { name: "Aceitar e continuar" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);

    await usuario.click(screen.getByRole("checkbox", { name: "Li e estou ciente." }));
    expect(botao.disabled).toBe(false);
    await usuario.click(botao);
    expect(aoAceitar).toHaveBeenCalledOnce();
  });

  it("desmarcar volta a bloquear", async () => {
    const { usuario } = montar();
    const caixa = screen.getByRole("checkbox", { name: "Li e estou ciente." });
    await usuario.click(caixa);
    await usuario.click(caixa);
    expect(
      (screen.getByRole("button", { name: "Aceitar e continuar" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("enquanto registra, o botão fica bloqueado e diz o que faz", async () => {
    montar({ aceitando: true });
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Li e estou ciente." }));
    const botao = screen.getByRole("button", { name: "Registrando..." }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });

  it("mostra o erro, se houver", () => {
    montar({ erro: { titulo: "Sem conexão com o servidor", descricao: "Tente de novo." } });
    expect(screen.getByRole("alert").textContent).toBe(
      "Sem conexão com o servidor. Tente de novo."
    );
  });
});
