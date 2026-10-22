import { describe, expect, it } from "vitest";
import { canApproveQlp, canTransitionQlp } from "./qlp-workflow.js";

describe("qlp workflow", () => {
  it("prevents who lacks qlp:manage from approving a QLP", () => {
    expect(canApproveQlp(false)).toBe(false);
    expect(canTransitionQlp("IN_REVIEW", "APPROVED", false)).toBe(false);
    expect(canTransitionQlp("APPROVED", "ARCHIVED", false)).toBe(false);
  });

  it("allows who has qlp:manage to approve from review", () => {
    expect(canTransitionQlp("IN_REVIEW", "APPROVED", true)).toBe(true);
  });

  it("only sends to review from draft", () => {
    expect(canTransitionQlp("DRAFT", "IN_REVIEW", false)).toBe(true);
    expect(canTransitionQlp("APPROVED", "IN_REVIEW", true)).toBe(false);
  });
});
