import { describe, expect, it } from "vitest";
import {
  employeeAvailability,
  isParityWorkday,
  isScheduledDay,
  isWeekdayWorkday,
  type EmployeeScheduleProfile
} from "./employee-availability.js";

const noRequirements = { documentRequirements: [], competencyRequirements: [] };

const baseEmployee: EmployeeScheduleProfile = {
  id: "employee-1",
  status: "ACTIVE",
  admissionDate: "2025-01-02T00:00:00.000Z",
  parity: "ODD"
};

describe("isParityWorkday", () => {
  it("puts ODD on duty on odd calendar days, including weekends", () => {
    expect(isParityWorkday("ODD", "2026-10-01")).toBe(true);
    expect(isParityWorkday("ODD", "2026-10-03")).toBe(true); // Saturday
    expect(isParityWorkday("ODD", "2026-10-31")).toBe(true);
    expect(isParityWorkday("ODD", "2026-10-02")).toBe(false);
    expect(isParityWorkday("ODD", "2026-10-30")).toBe(false);
  });

  it("is the exact inverse for EVEN", () => {
    expect(isParityWorkday("EVEN", "2026-10-01")).toBe(false);
    expect(isParityWorkday("EVEN", "2026-10-02")).toBe(true);
  });
});

describe("isWeekdayWorkday", () => {
  it("matches a fixed Mon-Fri pattern regardless of parity", () => {
    const weekdays = [1, 2, 3, 4, 5];
    expect(isWeekdayWorkday(weekdays, "2026-10-01")).toBe(true); // Thursday
    expect(isWeekdayWorkday(weekdays, "2026-10-05")).toBe(true); // Monday
    expect(isWeekdayWorkday(weekdays, "2026-10-03")).toBe(false); // Saturday
  });
});

describe("isScheduledDay", () => {
  it("uses parity when the employee has one, ignoring the shift weekdays", () => {
    expect(isScheduledDay({ parity: "ODD" }, "2026-10-03", { weekdays: [1, 2, 3, 4, 5] })).toBe(
      true
    ); // Saturday, but odd day
  });

  it("falls back to the shift weekday pattern when there is no parity", () => {
    expect(isScheduledDay({ parity: null }, "2026-10-03", { weekdays: [1, 2, 3, 4, 5] })).toBe(
      false
    ); // Saturday, no weekend coverage
    expect(isScheduledDay({ parity: null }, "2026-10-05", { weekdays: [1, 2, 3, 4, 5] })).toBe(
      true
    ); // Monday
  });
});

describe("employeeAvailability", () => {
  const shift = { weekdays: [1, 2, 3, 4, 5] };

  it("is available on a scheduled day with no absences and no aptitude issues", () => {
    const result = employeeAvailability({
      employee: baseEmployee,
      date: "2026-10-01",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(result.scheduled).toBe(true);
    expect(result.available).toBe(true);
    expect(result.reasonCodes).toEqual([]);
  });

  it("is unavailable but still scheduled when blocked by an absence", () => {
    const result = employeeAvailability({
      employee: baseEmployee,
      date: "2026-10-01",
      shift,
      events: [
        {
          id: "event-1",
          title: "Atestado",
          startsAt: new Date("2026-09-25T00:00:00.000Z"),
          endsAt: new Date("2026-10-05T23:59:59.000Z"),
          type: { code: "AT", name: "Atestado", blocksAvailability: true }
        }
      ],
      aptitude: noRequirements
    });

    expect(result.scheduled).toBe(true);
    expect(result.available).toBe(false);
    expect(result.reasonCodes).toContain("BLOCKED_BY_EVENT");
    expect(result.blockingEventTypeCodes).toEqual(["AT"]);
  });

  it("marks the rest day as not scheduled, not as a problem", () => {
    const result = employeeAvailability({
      employee: baseEmployee,
      date: "2026-10-02",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(result.scheduled).toBe(false);
    expect(result.available).toBe(false);
    expect(result.reasonCodes).toEqual(["OFF_ROTATION_DAY"]);
  });

  it("does not block SCHEDULED_ADMISSION before the admission date (FUTURE_ADMISSION already covers it)", () => {
    const result = employeeAvailability({
      employee: { ...baseEmployee, status: "SCHEDULED_ADMISSION", admissionDate: "2026-10-15T00:00:00.000Z" },
      date: "2026-10-01",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(result.available).toBe(false);
    expect(result.reasonCodes).toEqual(["FUTURE_ADMISSION"]);
  });

  it("becomes available for SCHEDULED_ADMISSION once the admission date arrives", () => {
    const result = employeeAvailability({
      employee: { ...baseEmployee, status: "SCHEDULED_ADMISSION", admissionDate: "2026-10-01T00:00:00.000Z" },
      date: "2026-10-01",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(result.available).toBe(true);
    expect(result.reasonCodes).toEqual([]);
  });

  it("blocks inactive employees", () => {
    const result = employeeAvailability({
      employee: { ...baseEmployee, status: "TERMINATED" },
      date: "2026-10-01",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(result.available).toBe(false);
    expect(result.reasonCodes).toContain("EMPLOYEE_INACTIVE");
  });

  it("blocks admission dates in the future", () => {
    const result = employeeAvailability({
      employee: { ...baseEmployee, admissionDate: "2026-11-01T00:00:00.000Z" },
      date: "2026-10-01",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(result.available).toBe(false);
    expect(result.reasonCodes).toContain("FUTURE_ADMISSION");
  });

  it("blocks on a missing required document, same policy as the QLP-based engine", () => {
    const result = employeeAvailability({
      employee: baseEmployee,
      date: "2026-10-01",
      shift,
      events: [],
      aptitude: {
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
      }
    });

    expect(result.available).toBe(false);
    expect(result.reasonCodes).toContain("DOCUMENT_MISSING");
  });

  it("respects the shift weekday pattern for employees without parity", () => {
    const commercial: EmployeeScheduleProfile = { ...baseEmployee, parity: null };
    const saturday = employeeAvailability({
      employee: commercial,
      date: "2026-10-03",
      shift,
      events: [],
      aptitude: noRequirements
    });
    const monday = employeeAvailability({
      employee: commercial,
      date: "2026-10-05",
      shift,
      events: [],
      aptitude: noRequirements
    });

    expect(saturday.scheduled).toBe(false);
    expect(monday.scheduled).toBe(true);
    expect(monday.available).toBe(true);
  });
});
