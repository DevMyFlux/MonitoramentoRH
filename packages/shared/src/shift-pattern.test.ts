import { describe, expect, it } from "vitest";
import { describeShiftWeekdays, isWeekdayOnlyShift, shiftHoursText } from "./shift-pattern.js";

describe("shift pattern", () => {
  it("tells weekday-only (5x2) shifts from 12x36 rotation shifts by their weekdays", () => {
    expect(isWeekdayOnlyShift({ weekdays: [1, 2, 3, 4, 5] })).toBe(true);
    expect(isWeekdayOnlyShift({ weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe(false);
    expect(isWeekdayOnlyShift({ weekdays: [] })).toBe(false);
    expect(isWeekdayOnlyShift(null)).toBe(false);
    expect(isWeekdayOnlyShift({})).toBe(false);
  });

  it("describes the days and hours in Portuguese", () => {
    expect(describeShiftWeekdays({ weekdays: [1, 2, 3, 4, 5] })).toBe("segunda a sexta");
    expect(describeShiftWeekdays({ weekdays: [1, 3, 5] })).toBe("segunda, quarta e sexta");
    expect(shiftHoursText({ startHour: 8, durationHours: 9 })).toBe("08:00–17:00");
    expect(shiftHoursText({ startHour: 19, durationHours: 12 })).toBe("19:00–07:00");
    expect(shiftHoursText({})).toBe("");
  });
});
