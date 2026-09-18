import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password-service.js";

describe("password service", () => {
  it("hashes passwords without storing the raw value", () => {
    const password = "ChangeMe!2026";
    const hash = hashPassword(password);

    expect(hash).not.toBe(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});
