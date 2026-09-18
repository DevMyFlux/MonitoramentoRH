import { describe, expect, it } from "vitest";
import { canAccessScope } from "./scope-policy.js";

describe("scope policy", () => {
  it("allows global scope", () => {
    expect(canAccessScope([{ isGlobal: true }], { companyId: crypto.randomUUID() })).toBe(true);
  });

  it("denies resources outside user scope", () => {
    const allowedCompanyId = crypto.randomUUID();
    const otherCompanyId = crypto.randomUUID();

    expect(
      canAccessScope([{ companyId: allowedCompanyId, isGlobal: false }], {
        companyId: otherCompanyId
      })
    ).toBe(false);
  });
});
