import { currentMonthInSaoPaulo } from "@my-flux/shared";
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { applyParityReference } from "./employee-repository.js";

function run(
  before: { parity: "ODD" | "EVEN" | null },
  data: { parity?: "ODD" | "EVEN" | null; parityReferenceMonth?: string | null }
) {
  const updateData: Prisma.EmployeeUncheckedUpdateInput = {};
  applyParityReference(updateData, before, data);
  return updateData;
}

describe("applyParityReference (Employee.parityReferenceMonth on update)", () => {
  const now = currentMonthInSaoPaulo();

  it("stamps the current month when the Par/Ímpar choice changes without a month", () => {
    expect(run({ parity: "ODD" }, { parity: "EVEN" })).toEqual({ parityReferenceMonth: now });
    expect(run({ parity: null }, { parity: "ODD" })).toEqual({ parityReferenceMonth: now });
  });

  it("uses the month the user gave", () => {
    expect(run({ parity: "ODD" }, { parity: "EVEN", parityReferenceMonth: "2026-11" })).toEqual({
      parityReferenceMonth: "2026-11"
    });
    expect(run({ parity: "ODD" }, { parityReferenceMonth: "2026-12" })).toEqual({ parityReferenceMonth: "2026-12" });
  });

  it("leaves the reference alone when the parity does not change", () => {
    expect(run({ parity: "ODD" }, { parity: "ODD" })).toEqual({});
    expect(run({ parity: "ODD" }, {})).toEqual({});
  });

  it("clears the reference when the rotation is removed", () => {
    expect(run({ parity: "ODD" }, { parity: null })).toEqual({ parityReferenceMonth: null });
    expect(run({ parity: null }, { parity: null, parityReferenceMonth: "2026-11" })).toEqual({
      parityReferenceMonth: null
    });
  });
});
