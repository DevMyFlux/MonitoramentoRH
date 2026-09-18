import { describe, expect, it } from "vitest";
import { generateSchedule } from "./schedule-engine.js";

describe("generateSchedule", () => {
  it("assigns eligible employees deterministically", () => {
    const result = generateSchedule({
      positions: [{ id: "p1", functionId: "driver", shift: "day", team: "A" }],
      employees: [
        {
          id: "e2",
          name: "Bruno",
          functionId: "driver",
          shift: "day",
          team: "A",
          aptitude: { status: "GREEN", reasonCodes: ["REQUIREMENTS_SATISFIED"] },
          availability: { available: true, reasonCodes: ["AVAILABLE"] }
        },
        {
          id: "e1",
          name: "Ana",
          functionId: "driver",
          shift: "day",
          team: "A",
          aptitude: { status: "GREEN", reasonCodes: ["REQUIREMENTS_SATISFIED"] },
          availability: { available: true, reasonCodes: ["AVAILABLE"] }
        }
      ],
      teamRules: []
    });

    expect(result.assignments).toEqual([{ positionId: "p1", employeeId: "e1" }]);
    expect(result.uncoveredPositions).toEqual([]);
  });

  it("returns uncovered positions and conflicts when employees are not eligible", () => {
    const result = generateSchedule({
      positions: [{ id: "p1", functionId: "driver" }],
      employees: [
        {
          id: "e1",
          name: "Ana",
          functionId: "driver",
          aptitude: { status: "RED", reasonCodes: ["DOCUMENT_EXPIRED"] },
          availability: { available: true, reasonCodes: ["AVAILABLE"] }
        }
      ],
      teamRules: []
    });

    expect(result.assignments).toEqual([]);
    expect(result.uncoveredPositions).toHaveLength(1);
    expect(result.conflicts.map((conflict) => conflict.code)).toContain(
      "EMPLOYEE_APTITUDE_BLOCKED"
    );
    expect(result.conflicts.map((conflict) => conflict.code)).toContain("POSITION_UNCOVERED");
  });
});
