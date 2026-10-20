import { describe, expect, it } from "vitest";
import { easterSunday, holidaysOfMonth } from "./holidays.js";

describe("easterSunday", () => {
  it("matches the known dates", () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2028)).toEqual({ month: 4, day: 16 });
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
  });
});

describe("holidaysOfMonth", () => {
  it("returns the national holidays of the month, with the movable Sexta-feira Santa", () => {
    expect(holidaysOfMonth(2026, 4)).toEqual([
      { day: 3, name: "Sexta-feira Santa" },
      { day: 21, name: "Tiradentes" }
    ]);
    // 2027: Easter is Mar 28, so Good Friday is Mar 26 and April only has Tiradentes.
    expect(holidaysOfMonth(2027, 3)).toEqual([{ day: 26, name: "Sexta-feira Santa" }]);
    expect(holidaysOfMonth(2027, 4)).toEqual([{ day: 21, name: "Tiradentes" }]);
  });

  it("has Oct 12 in October 2026 (the day painted on the reference HMB sheet) and Nov 2/15/20 in November", () => {
    expect(holidaysOfMonth(2026, 10)).toEqual([{ day: 12, name: "Nossa Senhora Aparecida" }]);
    expect(holidaysOfMonth(2026, 11).map((h) => h.day)).toEqual([2, 15, 20]);
    expect(holidaysOfMonth(2026, 12)).toEqual([{ day: 25, name: "Natal" }]);
    expect(holidaysOfMonth(2027, 1)).toEqual([{ day: 1, name: "Confraternização Universal" }]);
  });

  it("adds the São Paulo dates for HMB only", () => {
    expect(holidaysOfMonth(2027, 1, "HMB").map((h) => h.day)).toEqual([1, 25]);
    expect(holidaysOfMonth(2027, 1, "HETRIN").map((h) => h.day)).toEqual([1]);
    expect(holidaysOfMonth(2026, 7, "HMB")).toEqual([{ day: 9, name: "Revolução Constitucionalista (feriado estadual)" }]);
    expect(holidaysOfMonth(2026, 7, "HETRIN")).toEqual([]);
  });

  it("leaves out ponto facultativo (Carnaval, Corpus Christi)", () => {
    expect(holidaysOfMonth(2026, 2)).toEqual([]);
    expect(holidaysOfMonth(2026, 6, "HMB")).toEqual([]);
  });
});
