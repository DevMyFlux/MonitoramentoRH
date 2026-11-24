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

  describe("Treinamentos", () => {
    const item = navigationGroups.flatMap((g) => g.items).find((i) => i.label === "Treinamentos");

    it("aparece para o participante (COMUM) e o DEV, e não para RH e ADMIN", () => {
      expect(item).toMatchObject({ href: "/treinamentos", roles: ["COMUM", "DEV"] });
      expect(item?.hidden).toBeUndefined();
      expect(itemVisivelPara(item!, "COMUM")).toBe(true);
      expect(itemVisivelPara(item!, "DEV")).toBe(true);
      expect(itemVisivelPara(item!, "RH")).toBe(false);
      expect(itemVisivelPara(item!, "ADMIN")).toBe(false);
    });
  });

  describe("Acompanhamento e configuração de treinamentos", () => {
    const todos = navigationGroups.flatMap((g) => g.items);
    const rh = todos.find((i) => i.href === "/treinamentos/rh")!;
    const config = todos.find((i) => i.href === "/treinamentos/config")!;

    it("o RH acompanha, o ADMIN configura, o DEV vê os dois; o participante, nenhum", () => {
      expect(itemVisivelPara(rh, "RH")).toBe(true);
      expect(itemVisivelPara(rh, "ADMIN")).toBe(false);
      expect(itemVisivelPara(config, "ADMIN")).toBe(true);
      expect(itemVisivelPara(config, "RH")).toBe(false);
      for (const item of [rh, config]) {
        expect(itemVisivelPara(item, "DEV")).toBe(true);
        expect(itemVisivelPara(item, "COMUM")).toBe(false);
      }
    });

    it("ficam só no menu lateral, fora do dock do celular", () => {
      expect(rh.foraDoDock).toBe(true);
      expect(config.foraDoDock).toBe(true);
    });
  });

  describe("Leadership Lab", () => {
    const item = navigationGroups.flatMap((g) => g.items).find((i) => i.label === "Leadership Lab");

    it("está no menu e aponta para o painel do participante", () => {
      expect(item).toMatchObject({ href: "/lab", roles: ["COMUM", "DEV"] });
      const grupo = navigationGroups.find((g) => g.items.includes(item!));
      expect(grupo?.hidden).toBeUndefined();
      expect(item?.hidden).toBeUndefined();
    });

    it("o participante (COMUM) e o DEV (acesso total) o veem", () => {
      expect(itemVisivelPara(item!, "COMUM")).toBe(true);
      expect(itemVisivelPara(item!, "DEV")).toBe(true);
      for (const perfil of ["ADMIN", "RH"] as const) {
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
      expect(acompanhamento).toMatchObject({ href: "/lab/rh", roles: ["RH", "DEV"] });
      expect(configuracao).toMatchObject({ href: "/lab/config", roles: ["ADMIN", "DEV"] });
      for (const item of [acompanhamento, configuracao]) {
        expect(item?.hidden).toBeUndefined();
        expect(navigationGroups.find((g) => g.items.includes(item!))?.hidden).toBeUndefined();
      }
    });

    it("o acompanhamento é do RH e do DEV, e a configuração, de ADMIN e DEV", () => {
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM", undefined] as const) {
        expect(itemVisivelPara(acompanhamento!, perfil), `acompanhamento ${perfil}`).toBe(
          perfil === "RH" || perfil === "DEV"
        );
        expect(itemVisivelPara(configuracao!, perfil), `configuração ${perfil}`).toBe(
          perfil === "ADMIN" || perfil === "DEV"
        );
      }
    });

    it("cada perfil vê uma entrada do Leadership Lab, e o DEV vê as três", () => {
      const doLab = ["/lab", "/lab/rh", "/lab/config"];
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM"] as const) {
        const visiveis = itens.filter((i) => doLab.includes(i.href) && itemVisivelPara(i, perfil));
        expect(visiveis, perfil).toHaveLength(perfil === "DEV" ? 3 : 1);
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
