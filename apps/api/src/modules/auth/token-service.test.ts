import { describe, expect, it } from "vitest";
import { createAccessToken, verifyAccessToken } from "./token-service.js";

describe("token service", () => {
  it("signs and verifies access tokens", () => {
    const token = createAccessToken({
      id: crypto.randomUUID(),
      email: "dev@myflux.local",
      name: "Usuario DEV Inicial",
      role: "DEV",
      scopes: [{ isGlobal: true }]
    });

    const payload = verifyAccessToken(token);

    expect(payload?.email).toBe("dev@myflux.local");
    expect(payload?.role).toBe("DEV");
  });
});
