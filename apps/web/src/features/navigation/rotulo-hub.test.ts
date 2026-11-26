// O grupo que se chamava "Desenvolvimento" agora é "Hub Leadership" no menu e nos cabeçalhos.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { navigationGroups } from "./nav-items";

describe("rótulo Hub Leadership", () => {
  it("o grupo do menu mudou só de nome: as rotas são as mesmas", () => {
    const grupo = navigationGroups.find((g) => g.label === "Hub Leadership");
    expect(grupo?.items.map((i) => i.href)).toEqual([
      "/lab",
      "/lab/rh",
      "/lab/config",
      "/treinamentos",
      "/treinamentos/config"
    ]);
    expect(navigationGroups.map((g) => g.label)).not.toContain("Desenvolvimento");
  });

  it.each([
    "../leadership-lab/cadastro/layout-do-acompanhamento.tsx",
    "../../pages/lab/lab-config-page.tsx",
    "../../pages/lab/lab-painel-page.tsx",
    "../../pages/treinamentos/treinamentos-page.tsx"
  ])("o cabeçalho de %s usa o nome novo", (arquivo) => {
    const codigo = readFileSync(new URL(arquivo, import.meta.url), "utf8");
    expect(codigo).toContain("MY FLUX · Hub Leadership");
    expect(codigo).not.toContain("MY FLUX · Desenvolvimento");
  });
});
