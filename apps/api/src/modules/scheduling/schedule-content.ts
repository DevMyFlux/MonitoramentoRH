import { createHash } from "node:crypto";
import { groupPendencies, type IssueGroup, type SchedulePendencyLike } from "@my-flux/shared";
import { HttpError } from "../../lib/http-error.js";

/** JSON com as chaves ordenadas: o mesmo conteúdo gera sempre os mesmos bytes (e, portanto, o mesmo hash). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeys(source[key])])
    );
  }
  return value;
}

/**
 * Impressão digital do CONTEÚDO de uma escala (grade, pendências e métricas). A aprovação fica atrelada a ela: se o
 * conteúdo mudar, a aprovação anterior deixa de valer para a versão nova.
 */
export function contentHashOf(result: unknown): string {
  return createHash("sha256")
    .update(canonicalJson(result ?? null))
    .digest("hex");
}

export function pendenciesOf(result: unknown): SchedulePendencyLike[] {
  const list = (result as { pendencies?: unknown } | null)?.pendencies;
  return Array.isArray(list) ? (list as SchedulePendencyLike[]) : [];
}

/** Problemas que IMPEDEM o envio para aprovação (os alertas e as informações não impedem). */
export function blockingIssuesOf(result: unknown): IssueGroup[] {
  return groupPendencies(pendenciesOf(result)).filter((group) => group.severity === "blocking");
}

export function assertSubmittable(result: unknown): void {
  const blocking = blockingIssuesOf(result);
  if (!blocking.length) return;
  const who = [...new Set(blocking.map((issue) => issue.employeeName).filter(Boolean))];
  throw new HttpError(
    409,
    "SCHEDULE_HAS_BLOCKING_ISSUES",
    blocking.length === 1
      ? `A escala tem 1 problema que impede o envio: ${blocking[0]!.title}.`
      : `A escala tem ${blocking.length} problemas que impedem o envio (${who.slice(0, 3).join(", ")}${who.length > 3 ? " e outros" : ""}).`,
    {
      issues: blocking.map((issue) => ({
        code: issue.code,
        title: issue.title,
        detail: issue.detail,
        action: issue.action,
        employeeName: issue.employeeName,
        dates: issue.dates
      }))
    }
  );
}
