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

  describe("áreas do RH e da administração do Leadership Lab", () => {
    const itens = navigationGroups.flatMap((g) => g.items);
    const acompanhamento = itens.find((i) => i.label === "Acompanhamento do Lab");
    const configuracao = itens.find((i) => i.label === "Configuração do Lab");

    it("estão no menu e apontam para as telas certas", () => {
      expect(acompanhamento).toMatchObject({ href: "/lab/rh", roles: ["RH"] });
      expect(configuracao).toMatchObject({ href: "/lab/config", roles: ["ADMIN", "DEV"] });
      for (const item of [acompanhamento, configuracao]) {
        expect(item?.hidden).toBeUndefined();
        expect(navigationGroups.find((g) => g.items.includes(item!))?.hidden).toBeUndefined();
      }
    });

    it("o acompanhamento é só do RH, e a configuração, só de ADMIN e DEV", () => {
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM", undefined] as const) {
        expect(itemVisivelPara(acompanhamento!, perfil), `acompanhamento ${perfil}`).toBe(
          perfil === "RH"
        );
        expect(itemVisivelPara(configuracao!, perfil), `configuração ${perfil}`).toBe(
          perfil === "ADMIN" || perfil === "DEV"
        );
      }
    });

    it("cada perfil vê exatamente uma entrada do Leadership Lab", () => {
      const doLab = ["/lab", "/lab/rh", "/lab/config"];
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM"] as const) {
        const visiveis = itens.filter((i) => doLab.includes(i.href) && itemVisivelPara(i, perfil));
        expect(visiveis, perfil).toHaveLength(1);
      }
    });

    it("no modo de teste todas aparecem, para o Lab poder ser encontrado", () => {
      for (const item of [acompanhamento!, configuracao!]) {
        for (const perfil of ["DEV", "RH", "COMUM", undefined] as const) {
          expect(itemVisivelPara(item, perfil, true)).toBe(true);
        }
      }
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

  describe("modo de teste (todo visitante entra como DEV)", () => {
    const itens = navigationGroups.flatMap((g) => g.items);
    const lab = itens.find((i) => i.label === "Leadership Lab")!;

    it("mostra o item restrito a qualquer perfil, e até sem saber quem está logado", () => {
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM", undefined] as const) {
        expect(itemVisivelPara(lab, perfil, true)).toBe(true);
      }
    });

    it("sem o modo de teste (o padrão da função), a restrição por perfil vale", () => {
      expect(itemVisivelPara(lab, "RH")).toBe(false);
      expect(itemVisivelPara(lab, "RH", false)).toBe(false);
      expect(itemVisivelPara(lab, "COMUM", false)).toBe(true);
    });
  });
});
