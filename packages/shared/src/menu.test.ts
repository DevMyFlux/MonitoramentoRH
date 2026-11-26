import { describe, expect, it } from "vitest";
import { caminhoInterno, homeFor, menuDoPerfil, podeAbrirRota } from "./menu.js";

describe("homeFor", () => {
  it("o COMUM cai no Leadership Lab; a equipe, na primeira rota do menu", () => {
    expect(homeFor("COMUM")).toBe("/lab");
    for (const perfil of ["DEV", "ADMIN", "RH"] as const)
      expect(homeFor(perfil)).toBe("/colaboradores");
  });

  it("segue a ordem do menu, qualquer que seja a ordem das permissões recebidas", () => {
    expect(homeFor("RH", ["/usuarios", "/escalas"])).toBe("/escalas");
  });

  it("nunca devolve rota que o perfil não abre, nem com permissões estranhas", () => {
    expect(homeFor("COMUM", ["/colaboradores", "/lab"])).toBe("/lab");
    expect(homeFor("COMUM", [])).toBe("/lab");
  });

  it("sem perfil, é o login", () => {
    expect(homeFor(undefined)).toBe("/login");
  });

  it.each(["DEV", "ADMIN", "RH", "COMUM"] as const)(
    "%s: tudo o que está no menu, o perfil pode abrir",
    (perfil) => {
      for (const rota of menuDoPerfil(perfil))
        expect(podeAbrirRota(perfil, rota), rota).toBe(true);
    }
  );
});

describe("podeAbrirRota", () => {
  it("o COMUM só abre o Lab dele", () => {
    for (const rota of ["/lab", "/lab/teste", "/lab/resultado/abc", "/lab/aprendizagem"])
      expect(podeAbrirRota("COMUM", rota), rota).toBe(true);
    for (const rota of [
      "/colaboradores",
      "/escalas",
      "/usuarios",
      "/dashboard",
      "/lab/rh/revisao",
      "/lab/config",
      "/treinamentos"
    ])
      expect(podeAbrirRota("COMUM", rota), rota).toBe(false);
  });

  it("a configuração do Lab é de ADMIN e DEV; o acompanhamento, da equipe", () => {
    expect(podeAbrirRota("RH", "/lab/config")).toBe(false);
    expect(podeAbrirRota("ADMIN", "/lab/config")).toBe(true);
    expect(podeAbrirRota("RH", "/lab/rh/acompanhamento")).toBe(true);
  });

  it("módulo oculto não abre para ninguém", () => {
    expect(podeAbrirRota("DEV", "/qlp")).toBe(false);
  });
});

describe("caminhoInterno (sem open redirect)", () => {
  it("aceita só caminhos internos", () => {
    expect(caminhoInterno("/escalas?mes=2")).toBe("/escalas?mes=2");
  });

  it.each([
    "https://exemplo.com",
    "//exemplo.com",
    "/\\exemplo.com",
    "/\t/exemplo.com",
    "javascript:alert(1)",
    "escalas",
    "",
    "/login",
    "/login?x=1",
    null,
    undefined,
    42
  ])("recusa %j", (valor) => {
    expect(caminhoInterno(valor)).toBeNull();
  });
});
