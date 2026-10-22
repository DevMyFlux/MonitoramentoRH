/**
 * Validação das edições de uma escala já gerada.
 *
 * Nada aqui inventa critério novo: cada regra reaproveita o que o sistema já sabe — rodízio (par/ímpar e dias da
 * semana), admissão e desligamento, afastamentos, aptidão (documentos/competências) e o descanso configurado no turno.
 * O catálogo de mensagens amigáveis (packages/shared) traduz todos os códigos abaixo.
 *
 * Severidade: `blocking` impede a edição (e, se persistir na escala, o envio para aprovação); `warning`/`info` são
 * mostrados mas não impedem.
 */
import { issueSeverity, scheduleCodeMap } from "@my-flux/shared";
import {
  availabilityOn,
  evaluateCell,
  isLeaveCode,
  isWorkCode,
  prepareById,
  ruleCodeFor,
  type PreparedEmployee,
  type ScheduleContext
} from "./schedule-context.js";
import type { EmployeeSchedulePendency } from "./employee-schedule-service.js";
import { coverageOf, coveragePendencies } from "./substitution-context.js";
import type { ScheduleGridData, ScheduleGridRow } from "./xlsx-renderer.js";

export type EditChange = {
  employeeId: string;
  date: string;
  code: string;
  reason?: string | null | undefined;
};
export type EditIssue = EmployeeSchedulePendency;

export type RecomputedResult = {
  pendencies: EmployeeSchedulePendency[];
  metrics: { required: number; covered: number; coverage: number };
};

const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

export function gridRows(grid: ScheduleGridData): ScheduleGridRow[] {
  return grid.sections.flatMap((section) => section.rows);
}

/** Cópia da grade com as mudanças aplicadas (não altera a original). */
export function applyChanges(grid: ScheduleGridData, changes: EditChange[]): ScheduleGridData {
  const byEmployee = new Map<string, EditChange[]>();
  for (const change of changes)
    byEmployee.set(change.employeeId, [...(byEmployee.get(change.employeeId) ?? []), change]);
  return {
    ...grid,
    sections: grid.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => {
        const mine = byEmployee.get(row.employeeId);
        if (!mine) return row;
        const days = [...row.days];
        for (const change of mine) days[Number(change.date.slice(8, 10)) - 1] = change.code;
        return { ...row, days };
      })
    }))
  };
}

function issue(prep: PreparedEmployee, date: string, code: string, detail?: string): EditIssue {
  return {
    employeeId: prep.employee.id,
    employeeName: prep.employee.name,
    date,
    reasonCodes: [code],
    ...(detail ? { details: [{ code, message: detail }] } : {})
  };
}

/**
 * Regras de UMA célula já com o código novo. `rowDays` é a linha do colaborador com TODAS as mudanças aplicadas (para
 * conferir os dias vizinhos). `editTime` liga as regras que só fazem sentido no momento da edição (justificativa).
 */
export function validateCell(
  prep: PreparedEmployee,
  date: string,
  code: string,
  rowDays: readonly string[],
  options: { editTime: boolean; hasReason: boolean }
): EditIssue[] {
  const issues: EditIssue[] = [];

  if (!(code in scheduleCodeMap)) return [issue(prep, date, "EDIT_UNKNOWN_CODE")];
  if (!prep.configured) return [issue(prep, date, "SHIFT_NOT_CONFIGURED")];

  const availability = availabilityOn(prep, date);
  const { profile } = prep;
  const notYetAdmitted = Boolean(
    profile.admissionDate && profile.admissionDate.slice(0, 10) > date
  );
  const afterTermination = Boolean(profile.terminationDate && date > profile.terminationDate);
  const inactive = availability.reasonCodes.includes("EMPLOYEE_INACTIVE");
  const onLeave = availability.blockingEventTypeCodes.length > 0;
  const leaveText = availability.reasonDetails.find((d) => d.code === "BLOCKED_BY_EVENT")?.message;

  if (isLeaveCode(code)) {
    // Afastamento vem do cadastro de afastamentos do colaborador; não se "inventa" um na grade.
    if (!availability.blockingEventTypeCodes.includes(code))
      issues.push(issue(prep, date, "EDIT_LEAVE_CODE_NOT_ALLOWED"));
  } else if (isWorkCode(code)) {
    if (notYetAdmitted || afterTermination || inactive) {
      issues.push(issue(prep, date, "EDIT_EMPLOYEE_NOT_ACTIVE"));
    } else if (onLeave) {
      issues.push(issue(prep, date, "EDIT_EMPLOYEE_ON_LEAVE", leaveText));
    } else {
      // Trabalhar em dia de folga do rodízio só como Cobertura (C): é o dia extra explícito; D/N/M/T em folga é erro.
      if (!availability.scheduled && code !== "C")
        issues.push(issue(prep, date, "EDIT_WORK_ON_REST_DAY"));
      if (availability.scheduled && code === "C")
        issues.push(issue(prep, date, "EDIT_COVERAGE_ON_WORKDAY"));

      const aptitude = availability.reasonDetails.filter((d) =>
        /^(DOCUMENT|COMPETENCY)_/.test(d.code)
      );
      if (aptitude.length) {
        issues.push({
          ...issue(prep, date, "EDIT_APTITUDE_NOT_OK"),
          details: aptitude.map((d) => ({ code: "EDIT_APTITUDE_NOT_OK", message: d.message }))
        });
      }
      const rest = restWarning(prep, date, rowDays);
      if (rest) issues.push(issue(prep, date, "EDIT_REST_TIME_SHORT", rest));
    }
  } else {
    // folga (F, FE, FA, BH)
    if (onLeave) {
      issues.push(issue(prep, date, "EDIT_EMPLOYEE_ON_LEAVE", leaveText));
    } else if (availability.scheduled && !notYetAdmitted && !afterTermination) {
      issues.push(issue(prep, date, "EDIT_COVERAGE_REDUCED"));
    }
  }

  if (options.editTime && code !== ruleCodeFor(prep, date) && !options.hasReason) {
    issues.push(issue(prep, date, "EDIT_JUSTIFICATION_REQUIRED"));
  }
  return issues;
}

/** Descanso entre dois dias seguidos de trabalho menor que o previsto no turno (só aviso; não inventa regra nova). */
function restWarning(
  prep: PreparedEmployee,
  date: string,
  rowDays: readonly string[]
): string | null {
  const shift = prep.shiftConfig;
  if (!shift) return null;
  const day = Number(date.slice(8, 10));
  const worksOn = (d: number) => d >= 1 && d <= rowDays.length && isWorkCode(rowDays[d - 1] ?? "");
  if (!worksOn(day - 1) && !worksOn(day + 1)) return null;
  // mesmo turno todos os dias: o intervalo entre o fim de um dia e o início do seguinte é 24 h − duração
  const gap = Math.max(0, 24 - shift.durationHours);
  if (gap >= shift.restHours) return null;
  const next = worksOn(day + 1) ? day + 1 : day - 1;
  return `Descanso de ${gap} h entre os dias ${Math.min(day, next)} e ${Math.max(day, next)}; o turno prevê ${shift.restHours} h.`;
}

/**
 * Valida as mudanças pedidas ANTES de gravar: regras de cada célula e as de conjunto (duplicidade, colaborador e data
 * dentro da escala). Devolve todos os problemas (impeditivos e avisos).
 */
export function validateChanges(
  ctx: ScheduleContext,
  grid: ScheduleGridData,
  changes: EditChange[],
  options: { justification?: string | null } = {}
): EditIssue[] {
  const issues: EditIssue[] = [];
  const rows = new Map(gridRows(grid).map((row) => [row.employeeId, row]));
  const employees = new Map(ctx.employees.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const valid: EditChange[] = [];

  for (const change of changes) {
    const employee = employees.get(change.employeeId);
    const name = employee?.name ?? rows.get(change.employeeId)?.employeeName ?? "Colaborador";
    const base = { employeeId: change.employeeId, employeeName: name, date: change.date };
    const inMonth =
      /^\d{4}-\d{2}-\d{2}$/.test(change.date) && change.date.startsWith(`${ctx.month}-`);
    const day = Number(change.date.slice(8, 10));
    if (!rows.has(change.employeeId) || !employee) {
      issues.push({ ...base, reasonCodes: ["EDIT_EMPLOYEE_NOT_IN_SCHEDULE"] });
      continue;
    }
    if (!inMonth || day < 1 || day > ctx.dayCount) {
      issues.push({ ...base, reasonCodes: ["EDIT_DATE_OUTSIDE_MONTH"] });
      continue;
    }
    const key = cellKey(change.employeeId, change.date);
    if (seen.has(key)) {
      issues.push({ ...base, reasonCodes: ["EDIT_DUPLICATE_CHANGE"] });
      continue;
    }
    seen.add(key);
    valid.push(change);
  }

  const after = applyChanges(grid, valid);
  const afterRows = new Map(gridRows(after).map((row) => [row.employeeId, row]));
  for (const change of valid) {
    const prep = prepareFrom(ctx, change.employeeId);
    if (!prep) continue;
    issues.push(
      ...validateCell(prep, change.date, change.code, afterRows.get(change.employeeId)!.days, {
        editTime: true,
        hasReason: Boolean(change.reason?.trim()) || Boolean(options.justification?.trim())
      })
    );
  }
  return issues;
}

/** Os problemas que impedem gravar a edição. */
export function blockingEditIssues(issues: EditIssue[]): EditIssue[] {
  return issues.filter((i) => i.reasonCodes.some((code) => issueSeverity(code) === "blocking"));
}

// ── recálculo das pendências e métricas a partir da grade que já existe ──────────────────────────────

const prepareFrom = prepareById;

/**
 * Refaz pendências e métricas de uma grade existente SEM regerar as células: as células automáticas mantêm o código
 * que já têm e passam pela mesma contabilidade da geração; as ajustadas manualmente (override) valem como estão e
 * passam pelas regras de validação (um ajuste que deixou de ser válido — ex.: afastamento registrado depois — volta a
 * aparecer como pendência, e se for impeditiva barra o envio). Sem edição, o resultado é igual ao da geração.
 */
export function recomputeResult(
  ctx: ScheduleContext,
  grid: ScheduleGridData,
  overrides: ReadonlyMap<string, { code: string }>
): RecomputedResult {
  const rows = new Map(gridRows(grid).map((row) => [row.employeeId, row]));
  const pendencies: EmployeeSchedulePendency[] = [];
  let required = 0;
  let covered = 0;
  // o plano considera os ajustes manuais que valem DEPOIS desta edição (`overrides`), não só os já gravados
  const coverage = coverageOf(ctx, new Set(overrides.keys()));

  for (const employee of ctx.employees) {
    const row = rows.get(employee.id);
    if (!row) continue;
    const prep = prepareFrom(ctx, employee.id)!;
    if (!prep.configured) {
      pendencies.push({
        employeeId: employee.id,
        employeeName: employee.name,
        date: `${ctx.month}-01`,
        reasonCodes: ["SHIFT_NOT_CONFIGURED"]
      });
    }
    for (let day = 1; day <= ctx.dayCount; day++) {
      const date = `${ctx.month}-${String(day).padStart(2, "0")}`;
      const storedCode = row.days[day - 1] ?? "";
      // Ajuste manual é o que está na grade e coincide com o override do mês; um override de outra versão que não
      // chegou a esta grade não conta aqui (a célula segue a regra, com o código que ela já tem).
      const candidate = overrides.get(cellKey(employee.id, date));
      const override = candidate && candidate.code === storedCode ? candidate : undefined;
      const cell = evaluateCell(
        prep,
        date,
        override,
        storedCode,
        coverage.cells.has(cellKey(employee.id, date))
      );
      if (!cell) continue;
      if (cell.pendency) {
        pendencies.push({
          employeeId: employee.id,
          employeeName: employee.name,
          date,
          ...cell.pendency
        });
      }
      if ((cell.scheduled || cell.isWork) && !cell.substitution) required += 1;
      if (cell.isWork) covered += 1;
      if (override) {
        pendencies.push(
          ...validateCell(prep, date, override.code, row.days, { editTime: false, hasReason: true })
        );
      } else if (cell.substitution) {
        // Cobertura de substituição: mesma conferência de uma edição (descanso entre dias seguidos de trabalho etc.)
        pendencies.push(
          ...validateCell(prep, date, storedCode, row.days, { editTime: false, hasReason: true })
        );
      }
    }
  }
  pendencies.push(...coveragePendencies(coverage));
  return {
    pendencies,
    metrics: { required, covered, coverage: required ? Math.round((covered / required) * 100) : 0 }
  };
}
