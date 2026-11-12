// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../test/render";
import { Cronometro } from "./cronometro";

describe("Cronometro", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const montar = (restanteMs: number, aoZerar = vi.fn(), antesDaChegadaMs = 0) =>
    render(
      <Cronometro
        restanteMs={restanteMs}
        limiteMs={60_000}
        recebidaEm={performance.now() - antesDaChegadaMs}
        aoZerar={aoZerar}
      />
    );
  const avancar = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const relogio = () => screen.getByRole("timer").textContent;

  it("conta regressivamente a partir do que o servidor disse que restava", () => {
    montar(60_000);
    expect(relogio()).toBe("1:00");
    avancar(1_000);
    expect(relogio()).toBe("0:59");
    avancar(29_000);
    expect(relogio()).toBe("0:30");
  });

  it("conta a partir de quando a situação CHEGOU: voltar a uma tela em cache não devolve o tempo", () => {
    // A situação chegou há 20 s com 60 s de prazo.
    montar(60_000, vi.fn(), 20_000);
    avancar(250);
    expect(relogio()).toBe("0:40");
  });

  it("chama aoZerar uma vez só, quando chega a zero", () => {
    const aoZerar = vi.fn();
    montar(3_000, aoZerar);

    avancar(2_000);
    expect(aoZerar).not.toHaveBeenCalled();
    avancar(1_000);
    expect(aoZerar).toHaveBeenCalledTimes(1);
    avancar(10_000);
    expect(aoZerar).toHaveBeenCalledTimes(1);
    expect(relogio()).toBe("0:00");
  });

  it("se já chegou zerado (recarregou depois do prazo), avisa logo", () => {
    const aoZerar = vi.fn();
    montar(0, aoZerar);
    expect(aoZerar).toHaveBeenCalledTimes(1);
    expect(relogio()).toBe("0:00");
  });

  it("avisa o leitor de tela só em 30 e 10 segundos e ao acabar, não a cada segundo", () => {
    const { container } = montar(40_000);
    const anuncio = () => container.querySelector("[aria-live=polite]")?.textContent;
    expect(anuncio()).toBe("");
    avancar(10_000);
    expect(anuncio()).toBe("Faltam 30 segundos.");
    avancar(1_000);
    expect(anuncio()).toBe("");
    avancar(19_000);
    expect(anuncio()).toBe("Faltam 10 segundos.");
    avancar(10_000);
    expect(anuncio()).toBe("O tempo acabou.");
  });

  it("fica vermelho nos últimos 10 segundos", () => {
    montar(15_000);
    expect(screen.getByRole("timer").dataset.urgente).toBeUndefined();
    avancar(5_000);
    expect(screen.getByRole("timer").dataset.urgente).toBe("true");
  });
});
