/**
 * Planejador da substituição temporária (Fase 5) — função pura, sem banco.
 *
 * O sistema não tem "atividades" por colaborador: o que existe na escala é o plantão de cada dia (código na grade).
 * Então a substituição trabalha com o que a grade conhece:
 *
 *  - DEMANDA: cada dia do afastamento em que o titular trabalharia pelo rodízio (ignorando o afastamento) e que está
 *    dentro do que o responsável escolheu cobrir (`coveredDates`; vazio = todos).
 *  - COBERTURA: o dia em que o substituto assume o plantão do titular. Na grade vira `C` (Cobertura) — o dia extra
 *    explícito que o catálogo de códigos já previa. É ADITIVA: o substituto mantém a escala dele; só ganha dias.
 *  - ROD. HABITUAL: cobre os plantões do titular nos dias em que está de folga pelo próprio rodízio.
 *    ROD. ESPECÍFICO (Par/Ímpar): cobre só os plantões que caem em dias do Par/Ímpar escolhido (com a mesma regra de
 *    virada de mês do rodízio normal); os demais ficam para outro substituto. Nada altera o cadastro de ninguém.
 *
 * Nenhum critério novo de elegibilidade: usa `availabilityOn` (admissão, desligamento, afastamentos, aptidão, rodízio).
 * Tudo o que impede a cobertura de um dia vira uma ocorrência com código próprio (traduzido em friendly-messages) —
 * nunca é ignorado em silêncio.
 */
import { isParityWorkday } from "@my-flux/shared";
import { isScheduledDay } from "./employee-availability.js";
import { availabilityOn, type PreparedEmployee } from "./schedule-context.js";

export type SubstitutionConfig = {
  id: string;
  rotation: "HABITUAL" | "SPECIFIC";
  specificParity: "ODD" | "EVEN" | null;
  parityReferenceMonth: string | null;
  /** Plantões do titular a cobrir (AAAA-MM-DD); vazio = todos os do período. */
  coveredDates: string[];
};

/** Códigos das ocorrências de cobertura; todos têm tradução em `friendly-messages.ts`. */
export type CoverageIssueCode =
  | "SUBSTITUTION_SUBSTITUTE_NOT_IN_SCHEDULE"
  | "SUBSTITUTION_SUBSTITUTE_NOT_CONFIGURED"
  | "SUBSTITUTION_SUBSTITUTE_NOT_ACTIVE"
  | "SUBSTITUTION_SUBSTITUTE_ON_LEAVE"
  | "SUBSTITUTION_SUBSTITUTE_APTITUDE"
  | "SUBSTITUTION_SUBSTITUTE_ON_DUTY"
  | "SUBSTITUTION_SUBSTITUTE_ALREADY_COVERING"
  | "SUBSTITUTION_DAY_ALREADY_COVERED"
  | "SUBSTITUTION_MANUAL_ADJUSTMENT";

export type CoverageIssue = {
  substitutionId: string;
  /** A ocorrência é do plantão do TITULAR que ficou sem cobertura; o substituto vai em `otherName`. */
  employeeId: string;
  employeeName: string;
  otherName: string;
  date: string;
  reasonCodes: CoverageIssueCode[];
  details?: Array<{ code: string; message: string }>;
};

export type SubstitutionPlan = {
  substitutionId: string;
  /** Plantões do titular no período (e no escopo escolhido) que precisam de cobertura. */
  demandDates: string[];
  /** Dias em que o substituto assume (a célula dele vira `C`). */
  coveredDates: string[];
  /** Plantões que esta substituição deixa para outra por causa do Par/Ímpar escolhido (não é problema). */
  skippedByRotation: string[];
  issues: CoverageIssue[];
};

export type PlanPerson = { id: string; name: string; prep: PreparedEmployee | null };

export type PlanInput = {
  config: SubstitutionConfig;
  leave: { start: string; end: string };
  /** Recorte da análise (um mês): o contexto da escala é mensal. */
  window: { from: string; to: string };
  titular: PlanPerson;
  substitute: PlanPerson;
  /** Dias já ocupados por substituições anteriores do mesmo contexto: `T|titular|data` e `S|substituto|data`. */
  taken: Set<string>;
  /** O dia da pessoa tem ajuste manual na escala; ele vale sobre a substituição. */
  hasManualAdjustment: (employeeId: string, date: string) => boolean;
};

/** A ocorrência no formato das pendências da escala (sem o vínculo interno com a substituição). */
export function toPendency(issue: CoverageIssue) {
  return {
    employeeId: issue.employeeId,
    employeeName: issue.employeeName,
    otherName: issue.otherName,
    date: issue.date,
    reasonCodes: issue.reasonCodes,
    ...(issue.details ? { details: issue.details } : {})
  };
}

/** Datas AAAA-MM-DD de `from` a `to`, inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** O titular trabalharia neste dia pelo rodízio, ignorando o afastamento? (é o que precisa ser coberto) */
export function titularWorksOn(prep: PreparedEmployee, date: string): boolean {
  const { profile } = prep;
  if (!prep.configured) return false;
  if (!profile.admissionDate || profile.admissionDate.slice(0, 10) > date) return false;
  if (profile.terminationDate && date > profile.terminationDate) return false;
  return isScheduledDay(profile, date, { weekdays: prep.shiftConfig?.weekdays ?? [] });
}

export function planSubstitution(input: PlanInput): SubstitutionPlan {
  const { config, leave, window, titular, substitute, taken } = input;
  const plan: SubstitutionPlan = {
    substitutionId: config.id,
    demandDates: [],
    coveredDates: [],
    skippedByRotation: [],
    issues: []
  };
  if (!titular.prep) return plan; // o titular nem está na escala deste mês: não há plantão a cobrir

  const from = leave.start > window.from ? leave.start : window.from;
  const to = leave.end < window.to ? leave.end : window.to;
  if (from > to) return plan;

  const scope = new Set(config.coveredDates);
  const issue = (date: string, code: CoverageIssueCode, detail?: string): void => {
    plan.issues.push({
      substitutionId: config.id,
      employeeId: titular.id,
      employeeName: titular.name,
      otherName: substitute.name,
      date,
      reasonCodes: [code],
      ...(detail ? { details: [{ code, message: detail }] } : {})
    });
  };

  for (const date of eachDate(from, to)) {
    if (scope.size && !scope.has(date)) continue;
    if (!titularWorksOn(titular.prep, date)) continue;
    plan.demandDates.push(date);

    // Rodízio específico: só os plantões que caem nos dias do Par/Ímpar escolhido são deste substituto.
    if (config.rotation === "SPECIFIC" && config.specificParity) {
      const reference = config.parityReferenceMonth ?? date.slice(0, 7);
      if (!isParityWorkday(config.specificParity, date, reference)) {
        plan.skippedByRotation.push(date);
        continue;
      }
    }

    if (!substitute.prep) {
      issue(date, "SUBSTITUTION_SUBSTITUTE_NOT_IN_SCHEDULE");
      continue;
    }
    if (!substitute.prep.configured) {
      issue(date, "SUBSTITUTION_SUBSTITUTE_NOT_CONFIGURED");
      continue;
    }
    if (taken.has(`T|${titular.id}|${date}`)) {
      issue(date, "SUBSTITUTION_DAY_ALREADY_COVERED");
      continue;
    }
    if (taken.has(`S|${substitute.id}|${date}`)) {
      issue(date, "SUBSTITUTION_SUBSTITUTE_ALREADY_COVERING");
      continue;
    }

    const availability = availabilityOn(substitute.prep, date);
    const codes = availability.reasonCodes;
    if (
      codes.includes("EMPLOYEE_INACTIVE") ||
      codes.includes("FUTURE_ADMISSION") ||
      codes.includes("AFTER_TERMINATION")
    ) {
      issue(date, "SUBSTITUTION_SUBSTITUTE_NOT_ACTIVE");
      continue;
    }
    if (availability.blockingEventTypeCodes.length) {
      const text = availability.reasonDetails.find((d) => d.code === "BLOCKED_BY_EVENT")?.message;
      issue(date, "SUBSTITUTION_SUBSTITUTE_ON_LEAVE", text);
      continue;
    }
    const aptitude = availability.reasonDetails.filter((d) =>
      /^(DOCUMENT|COMPETENCY)_/.test(d.code)
    );
    if (aptitude.length) {
      issue(date, "SUBSTITUTION_SUBSTITUTE_APTITUDE", aptitude.map((d) => d.message).join(" "));
      continue;
    }
    // Já trabalha neste dia pelo próprio rodízio: não dá para ocupar dois plantões ao mesmo tempo.
    if (availability.scheduled) {
      issue(date, "SUBSTITUTION_SUBSTITUTE_ON_DUTY");
      continue;
    }
    if (input.hasManualAdjustment(substitute.id, date)) {
      issue(date, "SUBSTITUTION_MANUAL_ADJUSTMENT");
      continue;
    }

    taken.add(`T|${titular.id}|${date}`);
    taken.add(`S|${substitute.id}|${date}`);
    plan.coveredDates.push(date);
  }
  return plan;
}
