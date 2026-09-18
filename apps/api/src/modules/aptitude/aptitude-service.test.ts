import { describe, expect, it } from "vitest";
import { calculateAptitude } from "./aptitude-service.js";

const today = new Date("2026-09-03T12:00:00.000Z");

describe("calculateAptitude", () => {
  it("returns RED with reasons when a required document is missing", () => {
    const result = calculateAptitude({
      today,
      documentRequirements: [
        {
          code: "ASO",
          name: "ASO",
          warningDays: 30,
          required: true,
          documents: []
        }
      ],
      competencyRequirements: []
    });

    expect(result.status).toBe("RED");
    expect(result.reasonCodes).toContain("DOCUMENT_MISSING");
    expect(result.reasons[0]?.message).toContain("ASO");
  });

  it("returns YELLOW with reasons when a competency expires within the warning period", () => {
    const result = calculateAptitude({
      today,
      documentRequirements: [],
      competencyRequirements: [
        {
          competencyCode: "NR35",
          competencyName: "NR-35",
          requiredLevel: 2,
          warningDays: 15,
          required: true,
          competencies: [
            {
              level: 2,
              expiresAt: new Date("2026-09-10T00:00:00.000Z"),
              status: "ACTIVE"
            }
          ]
        }
      ]
    });

    expect(result.status).toBe("YELLOW");
    expect(result.reasonCodes).toEqual(["COMPETENCY_EXPIRING"]);
  });

  it("returns GREEN with a positive reason when every requirement is satisfied", () => {
    const result = calculateAptitude({
      today,
      documentRequirements: [
        {
          code: "ASO",
          name: "ASO",
          warningDays: 30,
          required: true,
          documents: [{ expiresAt: new Date("2027-01-01T00:00:00.000Z"), status: "ACTIVE" }]
        }
      ],
      competencyRequirements: []
    });

    expect(result.status).toBe("GREEN");
    expect(result.reasonCodes).toEqual(["REQUIREMENTS_SATISFIED"]);
  });
});
