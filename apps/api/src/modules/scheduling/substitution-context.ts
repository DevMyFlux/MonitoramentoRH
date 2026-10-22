/**
 * Cobertura planejada das substituições de um contexto de escala (unidade × mês).
 *
 * Geração, revalidação e edição precisam enxergar a MESMA cobertura, então o plano é calculado uma vez por contexto
 * (cache) a partir das substituições ativas, em ordem de criação — a mais antiga ganha quando duas disputam o mesmo
 * dia (o outro vira ocorrência `SUBSTITUTION_DAY_ALREADY_COVERED` / `SUBSTITUTION_SUBSTITUTE_ALREADY_COVERING`).
 */
import { prepareById, type ContextSubstitution, type ScheduleContext } from "./schedule-context.js";
import {
  planSubstitution,
  toPendency,
  type CoverageIssue,
  type SubstitutionPlan
} from "./substitution-planner.js";
import type { EmployeeSchedulePendency } from "./employee-schedule-service.js";

export type PlannedSubstitution = {
  row: ContextSubstitution;
  plan: SubstitutionPlan;
};

export type ContextCoverage = {
  plans: PlannedSubstitution[];
  /** `colaboradorId|AAAA-MM-DD` do substituto → substituição que o põe de Cobertura (C) nesse dia. */
  cells: Map<string, string>;
  issues: CoverageIssue[];
};

const cache = new WeakMap<ScheduleContext, ContextCoverage>();

export const leaveDate = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * `manualKeys` (`colaboradorId|data`) = os dias com ajuste manual a considerar; por padrão, os do contexto. A edição de
 * escala passa os ajustes que valerão DEPOIS dela (o contexto só conhece os de antes), e então o plano não é guardado.
 */
export function coverageOf(
  ctx: ScheduleContext,
  manualKeys?: ReadonlySet<string>
): ContextCoverage {
  const hit = manualKeys ? undefined : cache.get(ctx);
  if (hit) return hit;

  const taken = new Set<string>();
  const window = {
    from: `${ctx.month}-01`,
    to: `${ctx.month}-${String(ctx.dayCount).padStart(2, "0")}`
  };
  const coverage: ContextCoverage = { plans: [], cells: new Map(), issues: [] };

  // A prioridade é a ordem de criação, e não a ordem em que as linhas chegaram: a mais antiga cobre primeiro.
  const ordered = [...ctx.substitutionRows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );
  for (const row of ordered) {
    const plan = planSubstitution({
      config: {
        id: row.id,
        rotation: row.rotation,
        specificParity: row.specificParity,
        parityReferenceMonth: row.parityReferenceMonth,
        coveredDates: row.coveredDates
      },
      leave: { start: leaveDate(row.leaveEvent.startsAt), end: leaveDate(row.leaveEvent.endsAt) },
      window,
      titular: {
        id: row.titularId,
        name: row.titular.name,
        prep: prepareById(ctx, row.titularId) ?? null
      },
      substitute: {
        id: row.substituteId,
        name: row.substitute.name,
        prep: prepareById(ctx, row.substituteId) ?? null
      },
      taken,
      hasManualAdjustment: (employeeId, date) =>
        (manualKeys ?? ctx.overrideByKey).has(`${employeeId}|${date}`)
    });
    coverage.plans.push({ row, plan });
    coverage.issues.push(...plan.issues);
    for (const date of plan.coveredDates) coverage.cells.set(`${row.substituteId}|${date}`, row.id);
  }
  if (!manualKeys) cache.set(ctx, coverage);
  return coverage;
}

/** As ocorrências de cobertura no formato das pendências da escala (agrupadas e traduzidas pela camada de mensagens). */
export function coveragePendencies(coverage: ContextCoverage): EmployeeSchedulePendency[] {
  return coverage.issues.map(toPendency);
}

export type SubstitutionCellRef = { employeeId: string; date: string; substitutionId: string };

/** As células de Cobertura que a grade deve ter (guardadas junto do resultado, para poder desfazê-las depois). */
export function coverageCellRefs(coverage: ContextCoverage): SubstitutionCellRef[] {
  return [...coverage.cells.entries()]
    .map(([key, substitutionId]) => {
      const [employeeId, date] = key.split("|") as [string, string];
      return { employeeId, date, substitutionId };
    })
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.date.localeCompare(b.date));
}
