import { describe, expect, it } from "vitest";
import { countsAsCurrentHeadcount } from "./employee-rules.js";

describe("employee headcount rules", () => {
  it("does not count scheduled future admissions as current headcount", () => {
    expect(
      countsAsCurrentHeadcount(
        "ACTIVE",
        new Date("2026-10-01T00:00:00.000Z"),
        new Date("2026-09-03T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("does not count inactive employees", () => {
    expect(countsAsCurrentHeadcount("TERMINATED", null, new Date("2026-09-03T00:00:00.000Z"))).toBe(
      false
    );
  });
});
