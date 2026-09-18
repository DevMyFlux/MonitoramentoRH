import { calculateAptitude } from "../aptitude/aptitude-service.js";
import type { AptitudeInput } from "../aptitude/aptitude-service.js";

export type Duty = {
  positionId: string;
  functionId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  team: string | null;
  shift: string | null;
};
export type Worker = {
  id: string;
  name: string;
  functionId: string | null;
  shift: string | null;
  status: string;
  admissionDate: string | null;
  assignments: { positionId: string | null; startsAt: string; endsAt: string | null }[];
  events: { startsAt: string; endsAt: string; code: string; blocks: boolean }[];
  aptitude: AptitudeInput;
};
export type Assignment = Duty & { employeeId: string; employeeName: string; reasonCodes: string[] };
export type Gap = Duty & { reasonCodes: string[] };
export const engineVersion = "2.0.0";
export function overlaps(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string }
) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
export function eligibility(worker: Worker, duty: Duty) {
  const reasons: string[] = [];
  if (worker.status !== "ACTIVE") reasons.push("EMPLOYEE_INACTIVE");
  if (!worker.admissionDate || worker.admissionDate > duty.startsAt)
    reasons.push("FUTURE_ADMISSION");
  if (worker.functionId !== duty.functionId) reasons.push("POSITION_FUNCTION_MISMATCH");
  if (duty.shift && worker.shift !== duty.shift) reasons.push("SHIFT_MISMATCH");
  if (
    worker.events.some(
      (event) =>
        event.blocks &&
        (event.code === "TERMINATION" ? event.startsAt <= duty.startsAt : overlaps(event, duty))
    )
  )
    reasons.push("EMPLOYEE_UNAVAILABLE");
  const aptitude = calculateAptitude({ ...worker.aptitude, today: new Date(duty.endsAt) });
  if (aptitude.status !== "GREEN") reasons.push(...aptitude.reasonCodes);
  return reasons;
}
export function generateMonthly(
  duties: Duty[],
  workers: Worker[],
  restHours: number,
  minimumTeam: number
) {
  const assignments: Assignment[] = [];
  const uncovered: Gap[] = [];
  const conflicts: { code: string; date: string; team: string | null }[] = [];
  for (const duty of [...duties].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.positionId.localeCompare(b.positionId)
  )) {
    const ranked = [...workers].sort((a, b) => {
      const owns = (w: Worker) =>
        w.assignments.some(
          (x) =>
            x.positionId === duty.positionId &&
            x.startsAt <= duty.startsAt &&
            (!x.endsAt || x.endsAt >= duty.endsAt)
        );
      return Number(owns(b)) - Number(owns(a)) || a.id.localeCompare(b.id);
    });
    const reasons = new Set<string>();
    const worker = ranked.find((w) => {
      const blocked = eligibility(w, duty);
      if (
        assignments.some(
          (a) =>
            a.employeeId === w.id &&
            (overlaps(a, duty) ||
              (new Date(duty.startsAt).getTime() - new Date(a.endsAt).getTime() >= 0 &&
                new Date(duty.startsAt).getTime() - new Date(a.endsAt).getTime() <
                  restHours * 3600000))
        )
      )
        blocked.push("WORKING_TIME_CONFLICT");
      blocked.forEach((r) => reasons.add(r));
      return !blocked.length;
    });
    if (worker)
      assignments.push({
        ...duty,
        employeeId: worker.id,
        employeeName: worker.name,
        reasonCodes: ["ELIGIBLE"]
      });
    else uncovered.push({ ...duty, reasonCodes: ["POSITION_UNCOVERED", ...reasons] });
  }
  for (const key of new Set(duties.filter((d) => d.team).map((d) => `${d.date}|${d.team}`))) {
    const [date, team] = key.split("|");
    if (
      date &&
      team &&
      assignments.filter((a) => a.date === date && a.team === team).length < minimumTeam
    )
      conflicts.push({ code: "TEAM_REQUIREMENT_NOT_MET", date, team });
  }
  return {
    assignments,
    uncovered,
    conflicts,
    metrics: {
      required: duties.length,
      covered: assignments.length,
      coverage: duties.length ? Math.round((assignments.length / duties.length) * 100) : 0
    }
  };
}
