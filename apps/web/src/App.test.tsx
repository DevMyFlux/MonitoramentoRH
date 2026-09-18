import { describe, expect, it } from "vitest";
import { appName } from "@my-flux/config";

describe("web bootstrap", () => {
  it("uses the shared application name", () => {
    expect(appName).toBe("MY FLUX");
  });
});
