import { describe, expect, it } from "vitest";
import { canTransitionSchedule } from "./schedule-workflow.js";

describe("canTransitionSchedule", () => {
  it("allows ADMIN to approve and publish in sequence", () => {
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", "ADMIN", false)).toBe(true);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", "ADMIN", false)).toBe(true);
  });

  it("does not allow RH to approve", () => {
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", "RH", false)).toBe(false);
  });

  it("allows DEV override with justification flag", () => {
    expect(canTransitionSchedule("DRAFT", "PUBLISHED", "DEV", true)).toBe(true);
    expect(canTransitionSchedule("DRAFT", "PUBLISHED", "DEV", false)).toBe(false);
  });
});
