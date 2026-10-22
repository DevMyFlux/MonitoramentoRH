import { afterEach, describe, expect, it } from "vitest";
import { getSessionUser, setSessionUser, userCan, type SessionUser } from "./session-store";

const rh: SessionUser = {
  id: "1",
  email: "rh@x.com",
  name: "RH",
  role: "RH",
  permissions: ["auth:me", "schedules:read", "schedules:submit"]
};

afterEach(() => setSessionUser(null));

describe("session store", () => {
  it("guarda o usuário logado e limpa ao sair", () => {
    expect(getSessionUser()).toBeNull();
    setSessionUser(rh);
    expect(getSessionUser()?.email).toBe("rh@x.com");
    setSessionUser(null);
    expect(getSessionUser()).toBeNull();
  });

  it("userCan responde só pelas permissões recebidas, nunca pelo nome do perfil", () => {
    expect(userCan(rh, "schedules:submit")).toBe(true);
    expect(userCan(rh, "schedules:approve")).toBe(false);
    expect(userCan({ permissions: [] }, "schedules:read")).toBe(false);
    expect(userCan(null, "schedules:read")).toBe(false);
    // "DEV" sem permissões não pode nada
    const devWithoutPermissions: SessionUser = { ...rh, role: "DEV", permissions: [] };
    expect(userCan(devWithoutPermissions, "schedules:approve")).toBe(false);
  });
});
