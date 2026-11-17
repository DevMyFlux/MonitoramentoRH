// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoTemporario } from "./aviso-temporario";

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AvisoTemporario", () => {
  it("sem mensagem, não aparece", () => {
    const { container } = render(<AvisoTemporario mensagem="" aoFechar={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("é um status com a mensagem e fecha sozinho depois do tempo", () => {
    const fechar = vi.fn();
    render(
      <AvisoTemporario mensagem="Colaborador desligado." aoFechar={fechar} duracaoMs={5000} />
    );
    expect(screen.getByRole("status").textContent).toContain("Colaborador desligado.");
    act(() => void vi.advanceTimersByTime(4900));
    expect(fechar).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(200));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it("passar o mouse pausa a contagem; sair a retoma", () => {
    const fechar = vi.fn();
    render(<AvisoTemporario mensagem="Oi" aoFechar={fechar} duracaoMs={3000} />);
    fireEvent.mouseEnter(screen.getByRole("status"));
    act(() => void vi.advanceTimersByTime(10_000));
    expect(fechar).not.toHaveBeenCalled();
    fireEvent.mouseLeave(screen.getByRole("status"));
    act(() => void vi.advanceTimersByTime(3100));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it("o botão fecha na hora, com alvo de 44 px", async () => {
    const fechar = vi.fn();
    render(<AvisoTemporario mensagem="Oi" aoFechar={fechar} />);
    const botao = screen.getByRole("button", { name: "Fechar aviso" });
    expect(botao.className).toContain("h-11");
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(botao);
    expect(fechar).toHaveBeenCalledTimes(1);
  });
});
