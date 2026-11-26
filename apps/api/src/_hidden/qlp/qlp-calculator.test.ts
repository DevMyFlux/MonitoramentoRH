import { describe, expect, it } from "vitest";
import { calculateQlpCoverage } from "./qlp-calculator.js";

describe("qlp calculator", () => {
  it("calculates vacancies, surplus and projection separately", () => {
    const [coverage] = calculateQlpCoverage(
      [{ functionId: "fn-1", shift: "D", team: "A", quantity: 2 }],
      [
        { functionId: "fn-1", shift: "D", team: "A", isCurrent: true, isProjected: false },
        { functionId: "fn-1", shift: "D", team: "A", isCurrent: false, isProjected: true }
      ]
    );

    expect(coverage).toMatchObject({
      required: 2,
      current: 1,
      projected: 2,
      vacancies: 1,
      surplus: 0,
      coveragePercent: 50
    });
  });
});
