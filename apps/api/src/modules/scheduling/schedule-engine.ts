export type ScheduleAptitude = {
  status: "GREEN" | "YELLOW" | "RED";
  reasonCodes: string[];
};

export type ScheduleAvailability = {
  available: boolean;
  reasonCodes: string[];
};

export type SchedulePosition = {
  id: string;
  functionId: string;
  shift?: string | null | undefined;
  parity?: string | null | undefined;
  team?: string | null | undefined;
};

export type ScheduleEmployee = {
  id: string;
  name: string;
  functionId?: string | null | undefined;
  shift?: string | null | undefined;
  team?: string | null | undefined;
  aptitude: ScheduleAptitude;
  availability: ScheduleAvailability;
};

export type TeamRule = {
  team: string;
  maxAssignments?: number | undefined;
};

export type ScheduleEngineInput = {
  positions: SchedulePosition[];
  employees: ScheduleEmployee[];
  teamRules: TeamRule[];
};

export type ScheduleAssignment = {
  positionId: string;
  employeeId: string;
};

export type ScheduleIssue = {
  code: string;
  message: string;
  positionId?: string;
  employeeId?: string;
};

export type ScheduleEngineResult = {
  assignments: ScheduleAssignment[];
  uncoveredPositions: SchedulePosition[];
  conflicts: ScheduleIssue[];
  warnings: ScheduleIssue[];
};

export function generateSchedule(input: ScheduleEngineInput): ScheduleEngineResult {
  const assignments: ScheduleAssignment[] = [];
  const uncoveredPositions: SchedulePosition[] = [];
  const conflicts: ScheduleIssue[] = [];
  const warnings: ScheduleIssue[] = [];
  const assignedEmployeeIds = new Set<string>();
  const teamCounts = new Map<string, number>();
  const sortedPositions = [...input.positions].sort(comparePositions);
  const sortedEmployees = [...input.employees].sort(compareEmployees);

  for (const employee of sortedEmployees) {
    if (employee.aptitude.status === "YELLOW") {
      warnings.push({
        code: "EMPLOYEE_APTITUDE_WARNING",
        message: `${employee.name} possui alerta de aptidao.`,
        employeeId: employee.id
      });
    }
  }

  for (const position of sortedPositions) {
    const candidate = sortedEmployees.find(
      (employee) =>
        !assignedEmployeeIds.has(employee.id) &&
        matchesPosition(employee, position) &&
        isAssignable(employee, conflicts) &&
        respectsTeamRule(position, input.teamRules, teamCounts)
    );

    if (!candidate) {
      uncoveredPositions.push(position);
      conflicts.push({
        code: "POSITION_UNCOVERED",
        message: "Nenhum colaborador elegivel encontrado para a posicao.",
        positionId: position.id
      });
      continue;
    }

    assignments.push({ positionId: position.id, employeeId: candidate.id });
    assignedEmployeeIds.add(candidate.id);
    if (position.team) {
      teamCounts.set(position.team, (teamCounts.get(position.team) ?? 0) + 1);
    }
  }

  return { assignments, uncoveredPositions, conflicts, warnings };
}

function matchesPosition(employee: ScheduleEmployee, position: SchedulePosition): boolean {
  return (
    employee.functionId === position.functionId &&
    nullableMatches(employee.shift, position.shift) &&
    nullableMatches(employee.team, position.team)
  );
}

function isAssignable(employee: ScheduleEmployee, conflicts: ScheduleIssue[]): boolean {
  if (employee.aptitude.status !== "GREEN") {
    conflicts.push({
      code: "EMPLOYEE_APTITUDE_BLOCKED",
      message: `${employee.name} nao esta apto para alocacao.`,
      employeeId: employee.id
    });
    return false;
  }

  if (!employee.availability.available) {
    conflicts.push({
      code: "EMPLOYEE_UNAVAILABLE",
      message: `${employee.name} indisponivel no periodo.`,
      employeeId: employee.id
    });
    return false;
  }

  return true;
}

function respectsTeamRule(
  position: SchedulePosition,
  rules: TeamRule[],
  teamCounts: Map<string, number>
): boolean {
  if (!position.team) {
    return true;
  }

  const rule = rules.find((item) => item.team === position.team);
  return (
    rule?.maxAssignments === undefined || (teamCounts.get(position.team) ?? 0) < rule.maxAssignments
  );
}

function nullableMatches(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return right === null || right === undefined || left === right;
}

function comparePositions(left: SchedulePosition, right: SchedulePosition): number {
  return (
    left.functionId.localeCompare(right.functionId) ||
    (left.shift ?? "").localeCompare(right.shift ?? "") ||
    (left.parity ?? "").localeCompare(right.parity ?? "") ||
    (left.team ?? "").localeCompare(right.team ?? "") ||
    left.id.localeCompare(right.id)
  );
}

function compareEmployees(left: ScheduleEmployee, right: ScheduleEmployee): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
