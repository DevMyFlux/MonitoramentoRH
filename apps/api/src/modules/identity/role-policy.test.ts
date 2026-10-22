import { describe, expect, it } from "vitest";
import { canCreateRole, canDisableUser, canManageRole } from "./role-policy.js";

describe("role elevation policy", () => {
  it("allows DEV to create every role including DEV", () => {
    expect(canCreateRole("DEV", "DEV")).toBe(true);
    expect(canCreateRole("DEV", "ADMIN")).toBe(true);
    expect(canCreateRole("DEV", "RH")).toBe(true);
    expect(canCreateRole("DEV", "APPROVER")).toBe(true);
    expect(canCreateRole("DEV", "COMUM")).toBe(true);
  });

  it("prevents ADMIN from creating ADMIN or DEV, but allows RH, APPROVER and COMUM", () => {
    expect(canCreateRole("ADMIN", "DEV")).toBe(false);
    expect(canCreateRole("ADMIN", "ADMIN")).toBe(false);
    expect(canCreateRole("ADMIN", "RH")).toBe(true);
    expect(canCreateRole("ADMIN", "APPROVER")).toBe(true);
    expect(canCreateRole("ADMIN", "COMUM")).toBe(true);
  });

  it("prevents RH from creating RH, APPROVER, ADMIN or DEV", () => {
    expect(canCreateRole("RH", "DEV")).toBe(false);
    expect(canCreateRole("RH", "ADMIN")).toBe(false);
    expect(canCreateRole("RH", "RH")).toBe(false);
    expect(canCreateRole("RH", "APPROVER")).toBe(false);
    expect(canCreateRole("RH", "COMUM")).toBe(true);
  });

  it("COMUM never creates users, and APPROVER never creates a role at or above its own", () => {
    for (const target of ["DEV", "ADMIN", "RH", "APPROVER", "COMUM"] as const) {
      expect(canCreateRole("COMUM", target), `COMUM -> ${target}`).toBe(false);
    }
    for (const target of ["DEV", "ADMIN", "RH", "APPROVER"] as const) {
      expect(canCreateRole("APPROVER", target), `APPROVER -> ${target}`).toBe(false);
    }
    // A hierarquia só impede a escalada; QUEM pode criar usuários é decidido pela permissão `users:create`,
    // que o Aprovador não recebe por padrão (ver permissions.test.ts).
  });

  it("RH and APPROVER are peers: neither manages the other", () => {
    expect(canManageRole("RH", "APPROVER")).toBe(false);
    expect(canManageRole("APPROVER", "RH")).toBe(false);
    expect(canManageRole("ADMIN", "APPROVER")).toBe(true);
  });

  it("prevents disabling the last active DEV", () => {
    expect(canDisableUser("DEV", 1)).toBe(false);
    expect(canDisableUser("DEV", 2)).toBe(true);
    expect(canDisableUser("ADMIN", 1)).toBe(true);
  });
});
