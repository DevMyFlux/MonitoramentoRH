import { describe, expect, it } from "vitest";
import { canApproveQlp, canTransitionQlp } from "./qlp-workflow.js";

describe("qlp workflow", () => {
  it("prevents RH from approving QLP", () => {
    expect(canApproveQlp("RH")).toBe(false);
    expect(canTransitionQlp("IN_REVIEW", "APPROVED", "RH")).toBe(false);
  });

  it("allows ADMIN approval from review", () => {
    expect(canTransitionQlp("IN_REVIEW", "APPROVED", "ADMIN")).toBe(true);
  });
});
