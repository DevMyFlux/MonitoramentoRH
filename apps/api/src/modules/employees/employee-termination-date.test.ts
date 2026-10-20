import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { applyTerminationDate } from "./employee-repository.js";

const now = new Date("2026-11-05T15:00:00Z"); // 12:00 on Nov 5 in São Paulo
const today = new Date("2026-11-05T00:00:00.000Z");

function run(
  before: { status: string; terminationDate: Date | null },
  data: { status?: string; terminationDate?: string | null }
) {
  const updateData: Prisma.EmployeeUncheckedUpdateInput = {};
  applyTerminationDate(updateData, before, data, now);
  return updateData;
}

describe("applyTerminationDate (Employee.terminationDate on update)", () => {
  it("stores the date the form sends, or clears it when emptied", () => {
    expect(run({ status: "ACTIVE", terminationDate: null }, { terminationDate: "2026-11-30T00:00:00.000Z" })).toEqual({
      terminationDate: new Date("2026-11-30T00:00:00.000Z")
    });
    expect(run({ status: "ACTIVE", terminationDate: new Date("2026-11-30") }, { terminationDate: null })).toEqual({ terminationDate: null });
  });

  it("'Desligar' without a date records today, or today instead of a later planned date", () => {
    expect(run({ status: "ACTIVE", terminationDate: null }, { status: "TERMINATED" })).toEqual({ terminationDate: today });
    expect(run({ status: "ACTIVE", terminationDate: new Date("2026-12-31") }, { status: "TERMINATED" })).toEqual({ terminationDate: today });
  });

  it("keeps an earlier date already recorded when marking Desligado", () => {
    expect(run({ status: "ACTIVE", terminationDate: new Date("2026-11-01") }, { status: "TERMINATED" })).toEqual({});
  });

  it("reactivating a desligado clears the date", () => {
    expect(run({ status: "TERMINATED", terminationDate: new Date("2026-10-31") }, { status: "ACTIVE" })).toEqual({ terminationDate: null });
  });

  it("does nothing for unrelated updates", () => {
    expect(run({ status: "ACTIVE", terminationDate: new Date("2026-12-31") }, {})).toEqual({});
    expect(run({ status: "ACTIVE", terminationDate: null }, { status: "VACATION" })).toEqual({});
  });
});
