import { describe, expect, it } from "vitest";
import {
  MODULOS,
  idsDosModulos,
  moduloDaRotaApi,
  moduloDaRotaWeb,
  modulosOcultos,
  rotaDaApiPermitidaAoComum
} from "./modules.js";

describe("registro de módulos", () => {
  it("ids únicos, rotas da web únicas e prefixos da API de um dono só", () => {
    expect(new Set(idsDosModulos).size).toBe(idsDosModulos.length);
    const web = Object.values(MODULOS).flatMap((m) => m.rotasWeb);
    expect(new Set(web).size).toBe(web.length);
    const api = Object.values(MODULOS).flatMap((m) => m.apiPrefixos);
    expect(new Set(api).size).toBe(api.length);
    for (const prefixo of [...web, ...api]) expect(prefixo.startsWith("/"), prefixo).toBe(true);
    for (const m of Object.values(MODULOS))
      expect(m.id).toBe(Object.keys(MODULOS).find((k) => MODULOS[k] === m));
  });

  it("hoje só QLP e Recrutamento estão ocultos (a lista final depende do negócio)", () => {
    expect(
      modulosOcultos()
        .map((m) => m.id)
        .sort()
    ).toEqual(["qlp", "recrutamento"]);
  });

  it("só o Leadership Lab (e Treinamentos, transitório) são do COMUM", () => {
    expect(
      Object.values(MODULOS)
        .filter((m) => m.comumPode)
        .map((m) => m.id)
        .sort()
    ).toEqual(["lab", "treinamentos"]);
  });

  it("acha o módulo pela rota da API e da web, respeitando o limite do prefixo", () => {
    expect(moduloDaRotaApi("/qlp/versions")?.id).toBe("qlp");
    expect(moduloDaRotaApi("/positions")?.id).toBe("qlp");
    expect(moduloDaRotaApi("/employees/export")?.id).toBe("colaboradores");
    expect(moduloDaRotaApi("/employeesx")).toBeUndefined();
    // Endpoints compartilhados com telas ativas não pertencem a um módulo oculto.
    for (const compartilhado of [
      "/operations",
      "/functions",
      "/parameters",
      "/event-types",
      "/documents",
      "/calendar/events"
    ])
      expect(moduloDaRotaApi(compartilhado), compartilhado).toBeUndefined();
    expect(moduloDaRotaWeb("/qlp")?.id).toBe("qlp");
    expect(moduloDaRotaWeb("/lab/teste")?.id).toBe("lab");
    expect(moduloDaRotaWeb("/labx")).toBeUndefined();
  });

  it("o COMUM só alcança o que é global e o que os módulos dele liberam (negado por padrão)", () => {
    for (const rota of [
      "/auth/me",
      "/auth/login",
      "/health",
      "/suporte/conversa",
      "/leadership-lab/painel",
      "/leadership-lab/sessoes/abc/resultado",
      "/treinamentos/minhas"
    ])
      expect(rotaDaApiPermitidaAoComum(rota), rota).toBe(true);
    for (const rota of [
      "/employees",
      "/employees/export",
      "/employees/1",
      "/operations",
      "/functions",
      "/parameters",
      "/event-types",
      "/documents",
      "/calendar/events",
      "/schedules",
      "/employee-schedules/generate",
      "/users",
      "/audit/logs",
      "/imports",
      "/dashboard/summary",
      "/qlp/versions",
      "/positions",
      "/recruitment/requests",
      "/reports/x",
      "/leadership-labx",
      "/authx",
      "/suporte-x",
      "/"
    ])
      expect(rotaDaApiPermitidaAoComum(rota), rota).toBe(false);
  });
});
