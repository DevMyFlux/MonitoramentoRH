export type QlpRequirement = {
  functionId: string;
  shift?: string | null;
  team?: string | null;
  quantity: number;
};

export type QlpEmployee = {
  functionId?: string | null;
  shift?: string | null;
  team?: string | null;
  isCurrent: boolean;
  isProjected: boolean;
};

export type QlpCoverage = {
  functionId: string;
  shift: string | null;
  team: string | null;
  required: number;
  current: number;
  projected: number;
  vacancies: number;
  surplus: number;
  coveragePercent: number;
};

export function calculateQlpCoverage(
  requirements: QlpRequirement[],
  employees: QlpEmployee[]
): QlpCoverage[] {
  return requirements.map((requirement) => {
    const matching = employees.filter(
      (employee) =>
        employee.functionId === requirement.functionId &&
        nullableEquals(employee.shift, requirement.shift) &&
        nullableEquals(employee.team, requirement.team)
    );
    const current = matching.filter((employee) => employee.isCurrent).length;
    const projected = matching.filter(
      (employee) => employee.isCurrent || employee.isProjected
    ).length;
    const vacancies = Math.max(requirement.quantity - current, 0);
    const surplus = Math.max(current - requirement.quantity, 0);

    return {
      functionId: requirement.functionId,
      shift: requirement.shift ?? null,
      team: requirement.team ?? null,
      required: requirement.quantity,
      current,
      projected,
      vacancies,
      surplus,
      coveragePercent:
        requirement.quantity === 0 ? 100 : Math.round((current / requirement.quantity) * 100)
    };
  });
}

function nullableEquals(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return (left ?? null) === (right ?? null);
}
