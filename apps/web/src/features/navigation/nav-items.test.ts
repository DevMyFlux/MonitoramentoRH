import { describe, expect, it } from "vitest";
import { itemVisivelPara, navigationGroups } from "./nav-items";

describe("navigation groups", () => {
  it("exposes the MY FLUX operational modules", () => {
    const labels = navigationGroups.flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toContain("Dashboard");
    expect(labels).toContain("QLP");
    expect(labels).toContain("Colaboradores");
    expect(labels).toContain("Escalas");
    expect(labels).toContain("Auditoria");
    expect(labels).toContain("Parâmetros");
  });

  describe("Leadership Lab", () => {
    const item = navigationGroups.flatMap((g) => g.items).find((i) => i.label === "Leadership Lab");

    it("está no menu e aponta para o painel do participante", () => {
      expect(item).toMatchObject({ href: "/lab", roles: ["COMUM"] });
      const grupo = navigationGroups.find((g) => g.items.includes(item!));
      expect(grupo?.hidden).toBeUndefined();
      expect(item?.hidden).toBeUndefined();
    });

    it("só o perfil COMUM (o participante) o vê", () => {
      expect(itemVisivelPara(item!, "COMUM")).toBe(true);
      for (const perfil of ["DEV", "ADMIN", "RH"] as const) {
        expect(itemVisivelPara(item!, perfil)).toBe(false);
      }
    });

    it("enquanto não se sabe quem está logado, o item restrito não aparece", () => {
      expect(itemVisivelPara(item!, undefined)).toBe(false);
    });
  });

  it("os itens sem restrição de perfil continuam aparecendo para todos, como antes", () => {
    const colaboradores = navigationGroups
      .flatMap((g) => g.items)
      .find((i) => i.label === "Colaboradores");
    for (const perfil of ["DEV", "ADMIN", "RH", "COMUM", undefined] as const) {
      expect(itemVisivelPara(colaboradores!, perfil)).toBe(true);
    }
  });
});
