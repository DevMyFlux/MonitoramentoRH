import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARITY_REFERENCE_MONTH,
  currentMonthInSaoPaulo,
  daysInMonth,
  effectiveParity,
  isParityWorkday,
  monthInvertsParity,
  parityInversionsBetween,
  type ParityGroup
} from "./parity-rotation.js";

/** Every calendar day from `from` to `to` (inclusive), as YYYY-MM-DD. */
function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

describe("monthInvertsParity", () => {
  it("inverts only for 31-day months", () => {
    for (const month of [1, 3, 5, 7, 8, 10, 12]) expect(monthInvertsParity(2026, month)).toBe(true);
    for (const month of [4, 6, 9, 11]) expect(monthInvertsParity(2026, month)).toBe(false);
  });

  it("keeps the pre-existing behaviour (no inversion) for February, leap or not", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(monthInvertsParity(2027, 2)).toBe(false);
    expect(monthInvertsParity(2028, 2)).toBe(false);
  });
});

describe("month of 31 days (reference month = the 31-day month itself)", () => {
  it("Ímpar works day 31, rests day 1 and returns on day 2 following Par", () => {
    expect(isParityWorkday("ODD", "2026-10-31", "2026-10")).toBe(true);
    expect(isParityWorkday("ODD", "2026-11-01", "2026-10")).toBe(false);
    expect(isParityWorkday("ODD", "2026-11-02", "2026-10")).toBe(true);
    expect(effectiveParity("ODD", "2026-10", "2026-11")).toBe("EVEN");
  });

  it("Par works day 30, rests day 31 and returns on day 1 following Ímpar", () => {
    expect(isParityWorkday("EVEN", "2026-10-30", "2026-10")).toBe(true);
    expect(isParityWorkday("EVEN", "2026-10-31", "2026-10")).toBe(false);
    expect(isParityWorkday("EVEN", "2026-11-01", "2026-10")).toBe(true);
    expect(effectiveParity("EVEN", "2026-10", "2026-11")).toBe("ODD");
  });
});

describe("month of 30 days (reference month = the 30-day month itself)", () => {
  it("Par works day 30, rests day 1 and returns on day 2 staying Par", () => {
    expect(isParityWorkday("EVEN", "2026-11-30", "2026-11")).toBe(true);
    expect(isParityWorkday("EVEN", "2026-12-01", "2026-11")).toBe(false);
    expect(isParityWorkday("EVEN", "2026-12-02", "2026-11")).toBe(true);
    expect(effectiveParity("EVEN", "2026-11", "2026-12")).toBe("EVEN");
  });

  it("Ímpar works day 29, rests day 30 and returns on day 1 staying Ímpar", () => {
    expect(isParityWorkday("ODD", "2026-11-29", "2026-11")).toBe(true);
    expect(isParityWorkday("ODD", "2026-11-30", "2026-11")).toBe(false);
    expect(isParityWorkday("ODD", "2026-12-01", "2026-11")).toBe(true);
    expect(effectiveParity("ODD", "2026-11", "2026-12")).toBe("ODD");
  });
});

describe("turn of the year (December has 31 days)", () => {
  it("Ímpar works Dec 31, rests Jan 1 and returns Jan 2", () => {
    expect(isParityWorkday("ODD", "2026-12-31", "2026-12")).toBe(true);
    expect(isParityWorkday("ODD", "2027-01-01", "2026-12")).toBe(false);
    expect(isParityWorkday("ODD", "2027-01-02", "2026-12")).toBe(true);
  });

  it("Par works Dec 30, rests Dec 31 and returns Jan 1", () => {
    expect(isParityWorkday("EVEN", "2026-12-30", "2026-12")).toBe(true);
    expect(isParityWorkday("EVEN", "2026-12-31", "2026-12")).toBe(false);
    expect(isParityWorkday("EVEN", "2027-01-01", "2026-12")).toBe(true);
  });

  it("carries a registration made in October through Nov, Dec, Jan and Feb", () => {
    // Oct (31) inverts, Nov (30) keeps, Dec (31) inverts, Jan (31) inverts.
    expect(effectiveParity("ODD", "2026-10", "2026-10")).toBe("ODD");
    expect(effectiveParity("ODD", "2026-10", "2026-11")).toBe("EVEN");
    expect(effectiveParity("ODD", "2026-10", "2026-12")).toBe("EVEN");
    expect(effectiveParity("ODD", "2026-10", "2027-01")).toBe("ODD");
    expect(effectiveParity("ODD", "2026-10", "2027-02")).toBe("EVEN");
  });
});

describe("continuity over consecutive months", () => {
  const groups: ParityGroup[] = ["ODD", "EVEN"];
  const references = ["2026-10", "2026-11", "2026-12", "2027-02", "2027-07"];

  it("alternates strictly (work, rest, work...) across every month turn, forwards and backwards from the reference", () => {
    for (const reference of references) {
      for (const group of groups) {
        const days = eachDay("2025-01-01", "2028-12-31");
        const worked = days.map((day) => isParityWorkday(group, day, reference));
        const breaks: string[] = [];
        for (let i = 1; i < days.length; i++) {
          if (worked[i] === worked[i - 1]) breaks.push(`${days[i - 1]} -> ${days[i]}`);
        }
        // The only turn the business rule does not cover is the 29-day (leap) February.
        expect(breaks, `${group} / ref ${reference}`).toEqual(["2028-02-29 -> 2028-03-01"]);
      }
    }
  });

  it("never schedules a day twice or leaves it uncovered: exactly one of Par/Ímpar works each day", () => {
    for (const reference of references) {
      for (const day of eachDay("2026-09-01", "2027-12-31")) {
        const odd = isParityWorkday("ODD", day, reference);
        const even = isParityWorkday("EVEN", day, reference);
        expect(odd !== even, `${day} / ref ${reference}`).toBe(true);
      }
    }
  });

  it("counts inversions the same way in both directions", () => {
    expect(parityInversionsBetween("2026-10", "2027-03")).toBe(parityInversionsBetween("2027-03", "2026-10"));
    expect(parityInversionsBetween("2026-10", "2026-10")).toBe(0);
    // Oct, Dec and Jan invert; Nov and Feb do not.
    expect(parityInversionsBetween("2026-10", "2027-03")).toBe(3);
  });
});

describe("regenerating months that already existed", () => {
  it("keeps outubro/2026 and setembro/2026 identical to the old calendar-parity behaviour", () => {
    // September has 30 days (no inversion), so with the default reference (2026-10)
    // both months still follow plain calendar parity.
    expect(DEFAULT_PARITY_REFERENCE_MONTH).toBe("2026-10");
    for (const day of eachDay("2026-09-01", "2026-10-31")) {
      const calendarDay = Number(day.slice(8, 10));
      expect(isParityWorkday("ODD", day), day).toBe(calendarDay % 2 === 1);
      expect(isParityWorkday("EVEN", day), day).toBe(calendarDay % 2 === 0);
    }
  });

  it("uses the default reference when none is recorded", () => {
    expect(effectiveParity("ODD", null, "2026-11")).toBe("EVEN");
    expect(effectiveParity("ODD", undefined, "2026-11")).toBe("EVEN");
    expect(effectiveParity("ODD", "", "2026-11")).toBe("EVEN");
  });
});

describe("February (not covered by the business rule)", () => {
  it("does not invert at the end of a 28-day February, which is what the continuous cycle needs anyway", () => {
    // Jan 2027 (31) inverts, so in Feb an Ímpar registered for Jan follows Par.
    expect(effectiveParity("ODD", "2027-01", "2027-02")).toBe("EVEN");
    expect(isParityWorkday("EVEN", "2027-02-28", "2027-02")).toBe(true);
    expect(isParityWorkday("EVEN", "2027-03-01", "2027-02")).toBe(false);
    expect(isParityWorkday("EVEN", "2027-03-02", "2027-02")).toBe(true);
    expect(effectiveParity("EVEN", "2027-02", "2027-03")).toBe("EVEN");
  });

  it("keeps the previous behaviour for a 29-day February: pending business decision", () => {
    // Documented open point (docs/escalas-par-impar.md): Ímpar works Feb 29 and Mar 1.
    expect(isParityWorkday("ODD", "2028-02-29", "2028-02")).toBe(true);
    expect(isParityWorkday("ODD", "2028-03-01", "2028-02")).toBe(true);
  });
});

describe("helpers", () => {
  it("rejects malformed months", () => {
    expect(() => effectiveParity("ODD", "2026-13", "2026-10")).toThrow();
    expect(() => effectiveParity("ODD", "2026-10", "10/2026")).toThrow();
  });

  it("reads the current month on the Sao Paulo calendar", () => {
    expect(currentMonthInSaoPaulo(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10"); // 23:00 on Oct 31 in SP
    expect(currentMonthInSaoPaulo(new Date("2026-11-01T03:30:00Z"))).toBe("2026-11");
  });
});
