import { describe, expect, it } from "vitest";
import { itemVisivelPara, navigationGroups } from "./nav-items";

describe("navigation groups", () => {
  it("exposes the MY FLUX operational modules", () => {
    const labels = navigationGroups.flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toContain("Dashboard");
    expect(labels).not.toContain("QLP");
    expect(labels).not.toContain("Recrutamento");
    expect(labels).toContain("Colaboradores");
    expect(labels).toContain("Escalas");
    expect(labels).toContain("Auditoria");
    expect(labels).toContain("Parâmetros");
  });

  describe("Usuários", () => {
    const item = navigationGroups.flatMap((g) => g.items).find((i) => i.label === "Usuários");

    it("aparece para DEV, ADMIN e RH e nunca para o COMUM", () => {
      expect(item).toMatchObject({ href: "/usuarios", roles: ["DEV", "ADMIN", "RH"] });
      expect(item?.hidden).toBeUndefined();
      expect(navigationGroups.find((g) => g.items.includes(item!))?.hidden).toBeUndefined();
      for (const perfil of ["DEV", "ADMIN", "RH"] as const)
        expect(itemVisivelPara(item!, perfil)).toBe(true);
      expect(itemVisivelPara(item!, "COMUM")).toBe(false);
    });

    it("fica só no menu lateral, fora do dock do celular", () => {
      expect(item?.foraDoDock).toBe(true);
    });
  });

  describe("Treinamentos", () => {
    const item = navigationGroups.flatMap((g) => g.items).find((i) => i.label === "Treinamentos");

    it("é só do DEV: o participante faz os cenários dentro do teste do Leadership Lab", () => {
      expect(item).toMatchObject({ href: "/treinamentos", roles: ["DEV"] });
      expect(item?.hidden).toBeUndefined();
      expect(itemVisivelPara(item!, "COMUM")).toBe(false);
      expect(itemVisivelPara(item!, "DEV")).toBe(true);
      expect(itemVisivelPara(item!, "RH")).toBe(false);
      expect(itemVisivelPara(item!, "ADMIN")).toBe(false);
    });
  });

  describe("Acompanhamento do Lab e configuração de treinamentos", () => {
    const todos = navigationGroups.flatMap((g) => g.items);
    const acompanhamento = todos.find((i) => i.href === "/lab/rh")!;
    const config = todos.find((i) => i.href === "/treinamentos/config")!;

    it("o acompanhamento é um só: RH, ADMIN e DEV; o participante não o vê", () => {
      expect(acompanhamento.label).toBe("Acompanhamento do Lab");
      for (const perfil of ["RH", "ADMIN", "DEV"] as const) {
        expect(itemVisivelPara(acompanhamento, perfil), perfil).toBe(true);
      }
      expect(itemVisivelPara(acompanhamento, "COMUM")).toBe(false);
      // O item antigo, "Acompanhamento de treinamentos", foi unificado neste.
      expect(todos.find((i) => i.href === "/treinamentos/rh")).toBeUndefined();
    });

    it("o RH lê a configuração, o ADMIN configura, o DEV vê; o participante, não", () => {
      expect(itemVisivelPara(config, "ADMIN")).toBe(true);
      // O RH só lê a configuração (a tela esconde o que edita).
      expect(itemVisivelPara(config, "RH")).toBe(true);
      expect(itemVisivelPara(config, "DEV")).toBe(true);
      expect(itemVisivelPara(config, "COMUM")).toBe(false);
    });

    it("a configuração fica só no menu lateral, fora do dock do celular", () => {
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
      expect(acompanhamento).toMatchObject({ href: "/lab/rh", roles: ["RH", "ADMIN", "DEV"] });
      expect(configuracao).toMatchObject({ href: "/lab/config", roles: ["ADMIN", "DEV"] });
      for (const item of [acompanhamento, configuracao]) {
        expect(item?.hidden).toBeUndefined();
        expect(navigationGroups.find((g) => g.items.includes(item!))?.hidden).toBeUndefined();
      }
    });

    it("o acompanhamento é de RH, ADMIN e DEV, e a configuração, de ADMIN e DEV", () => {
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM", undefined] as const) {
        expect(itemVisivelPara(acompanhamento!, perfil), `acompanhamento ${perfil}`).toBe(
          perfil === "RH" || perfil === "ADMIN" || perfil === "DEV"
        );
        expect(itemVisivelPara(configuracao!, perfil), `configuração ${perfil}`).toBe(
          perfil === "ADMIN" || perfil === "DEV"
        );
      }
    });

    it("o COMUM e o RH veem uma entrada do Leadership Lab, o ADMIN duas e o DEV as três", () => {
      const doLab = ["/lab", "/lab/rh", "/lab/config"];
      for (const perfil of ["DEV", "ADMIN", "RH", "COMUM"] as const) {
        const visiveis = itens.filter((i) => doLab.includes(i.href) && itemVisivelPara(i, perfil));
        expect(visiveis, perfil).toHaveLength(perfil === "DEV" ? 3 : perfil === "ADMIN" ? 2 : 1);
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

  it("Colaboradores e Escalas são da equipe: nunca aparecem para o COMUM nem sem saber o perfil", () => {
    for (const rotulo of ["Colaboradores", "Escalas"]) {
      const item = navigationGroups.flatMap((g) => g.items).find((i) => i.label === rotulo)!;
      for (const perfil of ["DEV", "ADMIN", "RH"] as const)
        expect(itemVisivelPara(item, perfil), `${rotulo} ${perfil}`).toBe(true);
      expect(itemVisivelPara(item, "COMUM"), rotulo).toBe(false);
      expect(itemVisivelPara(item, undefined), rotulo).toBe(false);
    }
  });

  it("o menu do COMUM tem APENAS o Leadership Lab", () => {
    const itens = navigationGroups
      .filter((g) => !g.hidden)
      .flatMap((g) => g.items)
      .filter((i) => !i.hidden && itemVisivelPara(i, "COMUM"));
    expect(itens.map((i) => i.href)).toEqual(["/lab"]);
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
