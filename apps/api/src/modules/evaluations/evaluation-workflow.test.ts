import { describe, expect, it } from "vitest";
import { canTransitionEvaluation } from "./evaluation-workflow.js";

describe("canTransitionEvaluation", () => {
  it("allows RH to approve an evaluation in review", () => {
    expect(canTransitionEvaluation("IN_RH_REVIEW", "APPROVED", "RH")).toBe(true);
  });

  it("does not allow COMUM to approve evaluations", () => {
    expect(canTransitionEvaluation("IN_RH_REVIEW", "APPROVED", "COMUM")).toBe(false);
  });

  it("does not reopen archived evaluations", () => {
    expect(canTransitionEvaluation("ARCHIVED", "IN_RH_REVIEW", "DEV")).toBe(false);
  });
});
