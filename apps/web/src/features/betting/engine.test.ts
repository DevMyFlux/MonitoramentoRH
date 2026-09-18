import { describe, expect, it } from "vitest";
import {
  calculateExpectedValue,
  calculateFairOdd,
  calculateImpliedProbability,
  calculateStakeCents
} from "./engine";

describe("betting engine calculations", () => {
  it("calculates implied probability from decimal odds", () => {
    expect(calculateImpliedProbability(2)).toBe(0.5);
  });

  it("calculates fair odds from a model probability", () => {
    expect(calculateFairOdd(0.5)).toBe(2);
  });

  it("calculates expected value in decimal units", () => {
    expect(calculateExpectedValue(0.6, 2)).toBeCloseTo(0.2);
  });

  it("blocks stake when expected value is negative", () => {
    expect(
      calculateStakeCents({
        bankrollCents: 100_000,
        confidence: 88,
        expectedValue: -0.02,
        risk: "Baixo"
      })
    ).toBe(0);
  });

  it("caps suggested stake at 2.5 percent of bankroll", () => {
    expect(
      calculateStakeCents({
        bankrollCents: 100_000,
        confidence: 99,
        expectedValue: 0.5,
        risk: "Baixo"
      })
    ).toBe(2_500);
  });
});
