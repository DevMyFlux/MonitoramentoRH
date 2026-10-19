import { describe, expect, it } from "vitest";
import { resolveRotation } from "./employee-repository.js";

const configs: Record<string, unknown> = {
  DIURNO: { startHour: 7, durationHours: 12, weekdays: [0, 1, 2, 3, 4, 5, 6] },
  COMERCIAL: { startHour: 8, durationHours: 9, weekdays: [1, 2, 3, 4, 5] },
  ADMINISTRATIVO: { startHour: 7, durationHours: 10, weekdays: [1, 2, 3, 4, 5] }
};
const db = {
  operationalParameter: {
    findFirst: async (args: { where: { code: string } }) =>
      configs[args.where.code] ? { configuration: configs[args.where.code] } : null
  }
} as unknown as Parameters<typeof resolveRotation>[0];

const base = { operationId: "op", status: "ACTIVE" } as const;

describe("resolveRotation (scale coherence on create/update)", () => {
  it("clears Par/Ímpar for a 5x2 shift, whichever 5x2 shift the unit has", async () => {
    expect(await resolveRotation(db, { ...base, shift: "COMERCIAL", parity: "ODD" })).toEqual({ parity: null, weekdayOnly: true });
    expect(await resolveRotation(db, { ...base, shift: "ADMINISTRATIVO", parity: "EVEN" })).toEqual({ parity: null, weekdayOnly: true });
    expect(await resolveRotation(db, { ...base, shift: "COMERCIAL", parity: null })).toEqual({ parity: null, weekdayOnly: true });
  });

  it("keeps Par/Ímpar for a 12x36 shift", async () => {
    expect(await resolveRotation(db, { ...base, shift: "DIURNO", parity: "ODD" })).toEqual({ parity: "ODD", weekdayOnly: false });
  });

  it("requires Par/Ímpar for a 12x36 shift when the person enters the schedule", async () => {
    await expect(resolveRotation(db, { ...base, shift: "DIURNO", parity: null })).rejects.toMatchObject({ code: "PARITY_REQUIRED" });
    await expect(resolveRotation(db, { ...base, status: "SCHEDULED_ADMISSION", shift: "DIURNO", parity: null })).rejects.toMatchObject({
      code: "PARITY_REQUIRED"
    });
  });

  it("does not block people who are not in the schedule (e.g. desligados) or have no shift/parameter", async () => {
    expect(await resolveRotation(db, { ...base, status: "TERMINATED", shift: "DIURNO", parity: null })).toEqual({ parity: null, weekdayOnly: false });
    expect(await resolveRotation(db, { ...base, shift: null, parity: null })).toEqual({ parity: null, weekdayOnly: false });
    expect(await resolveRotation(db, { ...base, shift: "OUTRO", parity: "EVEN" })).toEqual({ parity: "EVEN", weekdayOnly: false });
  });
});
