import { describe, expect, it } from "vitest";
import { canTransitionEvaluation } from "./evaluation-workflow.js";

describe("canTransitionEvaluation", () => {
  it("allows who has evaluations:manage to approve an evaluation in review", () => {
    expect(canTransitionEvaluation("IN_RH_REVIEW", "APPROVED", true)).toBe(true);
  });

  it("does not allow who lacks evaluations:manage to approve evaluations", () => {
    expect(canTransitionEvaluation("IN_RH_REVIEW", "APPROVED", false)).toBe(false);
    expect(canTransitionEvaluation("DRAFT", "IN_RH_REVIEW", false)).toBe(false);
    expect(canTransitionEvaluation("IN_RH_REVIEW", "ARCHIVED", false)).toBe(false);
  });

  it("does not reopen archived evaluations", () => {
    expect(canTransitionEvaluation("ARCHIVED", "IN_RH_REVIEW", true)).toBe(false);
  });
});
