import { describe, expect, it } from "vitest";
import { isRoleAtLeast } from "./index";

describe("role hierarchy", () => {
  it("preserves DEV > ADMIN > RH > COMUM", () => {
    expect(isRoleAtLeast("DEV", "ADMIN")).toBe(true);
    expect(isRoleAtLeast("ADMIN", "DEV")).toBe(false);
    expect(isRoleAtLeast("RH", "ADMIN")).toBe(false);
    expect(isRoleAtLeast("COMUM", "RH")).toBe(false);
  });
});
