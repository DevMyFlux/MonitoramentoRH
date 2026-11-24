import { describe, expect, it } from "vitest";
import { acessoATentativa, perfilPermite, type TreinoAtor } from "./treinamentos-acesso.js";

const ator = (role: TreinoAtor["role"], participanteId: string | null = null): TreinoAtor => ({
  userId: `u-${role}`,
  role,
  participanteId
});
const alvo = { participanteId: "p1", turmaCuradorId: "u-RH", turmaAtiva: true };

describe("acesso aos Treinamentos", () => {
  it("cada perfil tem os papéis da matriz; o DEV acumula os três", () => {
    expect(perfilPermite(ator("COMUM"), "participante")).toBe(true);
    expect(perfilPermite(ator("COMUM"), "curador")).toBe(false);
    expect(perfilPermite(ator("RH"), "curador")).toBe(true);
    expect(perfilPermite(ator("RH"), "administrador")).toBe(false);
    expect(perfilPermite(ator("ADMIN"), "administrador")).toBe(true);
    expect(perfilPermite(ator("ADMIN"), "participante")).toBe(false);
    for (const papel of ["participante", "curador", "administrador"] as const)
      expect(perfilPermite(ator("DEV"), papel)).toBe(true);
  });

  it("o participante só chega à própria tentativa", () => {
    expect(acessoATentativa(ator("COMUM", "p1"), alvo)).toBe("dono");
    expect(acessoATentativa(ator("COMUM", "p2"), alvo)).toBeNull();
    expect(acessoATentativa(ator("COMUM"), alvo)).toBeNull();
  });

  it("o curador só nas turmas ativas dele; o DEV em todas; o ADMIN em nenhuma", () => {
    expect(acessoATentativa(ator("RH"), alvo)).toBe("curador");
    expect(acessoATentativa({ ...ator("RH"), userId: "outro" }, alvo)).toBeNull();
    expect(acessoATentativa(ator("RH"), { ...alvo, turmaAtiva: false })).toBeNull();
    expect(acessoATentativa(ator("DEV"), { ...alvo, turmaAtiva: false })).toBe("curador");
    expect(acessoATentativa(ator("ADMIN"), alvo)).toBeNull();
  });

  it("um DEV participante lê a própria tentativa como dono", () => {
    expect(acessoATentativa(ator("DEV", "p1"), alvo)).toBe("dono");
  });
});
