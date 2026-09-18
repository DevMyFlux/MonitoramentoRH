import { describe, expect, it } from "vitest";
import { calculateAvailability } from "./availability-service.js";

describe("calculateAvailability", () => {
  it("blocks availability when a blocking event overlaps the interval", () => {
    const result = calculateAvailability(
      [
        {
          id: "event-1",
          title: "Ferias",
          startsAt: new Date("2026-09-01T00:00:00.000Z"),
          endsAt: new Date("2026-09-10T23:59:59.000Z"),
          type: { code: "VACATION", name: "Ferias", blocksAvailability: true }
        }
      ],
      {
        startsAt: new Date("2026-09-03T00:00:00.000Z"),
        endsAt: new Date("2026-09-03T23:59:59.000Z")
      }
    );

    expect(result.available).toBe(false);
    expect(result.reasonCodes).toEqual(["BLOCKED_BY_EVENT"]);
  });

  it("keeps availability when overlapping events are informational", () => {
    const result = calculateAvailability(
      [
        {
          id: "event-1",
          title: "Comunicado",
          startsAt: new Date("2026-09-03T00:00:00.000Z"),
          endsAt: new Date("2026-09-03T23:59:59.000Z"),
          type: { code: "OTHER", name: "Outro", blocksAvailability: false }
        }
      ],
      {
        startsAt: new Date("2026-09-03T08:00:00.000Z"),
        endsAt: new Date("2026-09-03T18:00:00.000Z")
      }
    );

    expect(result.available).toBe(true);
    expect(result.reasonCodes).toEqual(["AVAILABLE"]);
  });
});
