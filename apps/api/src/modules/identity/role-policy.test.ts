import { describe, expect, it } from "vitest";
import { canCreateRole, canDisableUser } from "./role-policy.js";

describe("role elevation policy", () => {
  it("allows DEV to create every role including DEV", () => {
    expect(canCreateRole("DEV", "DEV")).toBe(true);
    expect(canCreateRole("DEV", "ADMIN")).toBe(true);
    expect(canCreateRole("DEV", "RH")).toBe(true);
    expect(canCreateRole("DEV", "COMUM")).toBe(true);
  });

  it("prevents ADMIN from creating ADMIN or DEV", () => {
    expect(canCreateRole("ADMIN", "DEV")).toBe(false);
    expect(canCreateRole("ADMIN", "ADMIN")).toBe(false);
    expect(canCreateRole("ADMIN", "RH")).toBe(true);
    expect(canCreateRole("ADMIN", "COMUM")).toBe(true);
  });

  it("prevents RH from creating RH, ADMIN or DEV", () => {
    expect(canCreateRole("RH", "DEV")).toBe(false);
    expect(canCreateRole("RH", "ADMIN")).toBe(false);
    expect(canCreateRole("RH", "RH")).toBe(false);
    expect(canCreateRole("RH", "COMUM")).toBe(true);
  });

  it("prevents COMUM from creating users", () => {
    expect(canCreateRole("COMUM", "DEV")).toBe(false);
    expect(canCreateRole("COMUM", "ADMIN")).toBe(false);
    expect(canCreateRole("COMUM", "RH")).toBe(false);
    expect(canCreateRole("COMUM", "COMUM")).toBe(false);
  });

  it("prevents disabling the last active DEV", () => {
    expect(canDisableUser("DEV", 1)).toBe(false);
    expect(canDisableUser("DEV", 2)).toBe(true);
    expect(canDisableUser("ADMIN", 1)).toBe(true);
  });
});
