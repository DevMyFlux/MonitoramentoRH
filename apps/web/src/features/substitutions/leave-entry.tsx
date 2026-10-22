/* eslint-disable react-hooks/set-state-in-effect */
/* Um afastamento do colaborador (aba "Afastamentos"): datas, remoção e SUBSTITUIÇÃO temporária.
   A tela só oferece o que o perfil pode fazer; a API valida cada permissão no servidor. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import type { IssueGroup } from "@my-flux/shared";
import { Badge, Button } from "../../components/ui";
import { IssueList } from "../../components/issue-list";
import { ApiRequestError, date, errorText, request, text, type Row } from "../my-flux/client";

type Rotation = "HABITUAL" | "SPECIFIC";
type Parity = "ODD" | "EVEN";
type EffectiveStatus = "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";

type Substitution = {
  id: string;
  titularName: string;
  substituteId: string;
  substituteName: string;
  rotation: Rotation;
  specificParity: Parity | null;
  coveredDates: string[];
  status: "ACTIVE" | "CANCELLED";
  effectiveStatus: EffectiveStatus;
  notes: string | null;
  cancelReason: string | null;
};

type Plan = {
  months: Array<{
    month: string;
    demandDates: string[];
    coveredDates: string[];
    skippedByRotation: string[];
  }>;
  demandCount: number;
  coveredCount: number;
  skippedByRotationCount: number;
  uncoveredCount: number;
  issues: IssueGroup[];
};

type SyncOutcome = {
  month: string;
  versionId: string | null;
  outcome:
    | "UPDATED"
    | "NEW_VERSION"
    | "UNCHANGED"
    | "NO_SCHEDULE"
    | "NEEDS_CONFIRMATION"
    | "CONFLICT"
    | "NOT_SUPPORTED"
    | "FAILED";
  changedCells: number;
  message: string;
  issues?: IssueGroup[];
};

type SubstitutionResult = {
  dryRun: boolean;
  substitution: Substitution;
  plan: Plan;
  schedules: SyncOutcome[];
};
type LeaveSync = { substitutions: Substitution[]; schedules: SyncOutcome[] };

const dateBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const shortBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const isoDay = (value: unknown) => String(value ?? "").slice(0, 10);

const statusBadge: Record<
  EffectiveStatus,
  { label: string; tone: "success" | "info" | "neutral" | "danger" }
> = {
  ACTIVE: { label: "Em vigor", tone: "success" },
  SCHEDULED: { label: "Agendada", tone: "info" },
  ENDED: { label: "Encerrada", tone: "neutral" },
  CANCELLED: { label: "Cancelada", tone: "danger" }
};

const outcomeTone: Record<SyncOutcome["outcome"], string> = {
  UPDATED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  NEW_VERSION: "border-emerald-200 bg-emerald-50 text-emerald-900",
  UNCHANGED: "border-slate-200 bg-slate-50 text-slate-700",
  NO_SCHEDULE: "border-slate-200 bg-slate-50 text-slate-700",
  NEEDS_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-900",
  CONFLICT: "border-red-200 bg-red-50 text-red-900",
  NOT_SUPPORTED: "border-amber-200 bg-amber-50 text-amber-900",
  FAILED: "border-red-200 bg-red-50 text-red-900"
};

/** O que aconteceu com a escala de cada mês (e, para escala já em análise/aprovada/publicada, o pedido de confirmação). */
function ScheduleOutcomes({
  outcomes,
  busy,
  onConfirm
}: {
  outcomes: SyncOutcome[];
  busy: boolean;
  onConfirm?: (() => void) | undefined;
}) {
  if (!outcomes.length) return null;
  const waiting = outcomes.some((o) => o.outcome === "NEEDS_CONFIRMATION");
  return (
    <div className="space-y-2" aria-live="polite">
      <p className="text-xs font-semibold text-slate-600">Escalas dos meses afetados</p>
      <ul className="space-y-1.5">
        {outcomes.map((o) => (
          <li key={o.month} className={`rounded border p-2 text-xs ${outcomeTone[o.outcome]}`}>
            <p>{o.message}</p>
            {o.issues?.length ? <IssueList groups={o.issues} className="mt-2" /> : null}
          </li>
        ))}
      </ul>
      {waiting && onConfirm ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={onConfirm}>
          {busy ? "Aplicando..." : "Criar nova versão em rascunho com a substituição"}
        </Button>
      ) : null}
    </div>
  );
}

function PlanSummary({ plan }: { plan: Plan }) {
  return (
    <div className="space-y-2 text-xs">
      <p>
        <span className="font-semibold">{plan.coveredCount}</span> de{" "}
        <span className="font-semibold">{plan.demandCount}</span>{" "}
        {plan.demandCount === 1 ? "plantão" : "plantões"} do afastado serão cobertos
        {plan.skippedByRotationCount
          ? `; ${plan.skippedByRotationCount} ficam para outro substituto (outro rodízio)`
          : ""}
        {plan.uncoveredCount
          ? `; ${plan.uncoveredCount} não puderam ser cobertos (veja abaixo)`
          : ""}
        .
      </p>
      {plan.months.map((m) =>
        m.coveredDates.length ? (
          <p key={m.month} className="text-slate-600">
            <span className="font-medium">
              {m.month.slice(5, 7)}/{m.month.slice(0, 4)}:
            </span>{" "}
            Cobertura (C) em {m.coveredDates.map(shortBr).join(", ")}
          </p>
        ) : null
      )}
      <IssueList groups={plan.issues} />
    </div>
  );
}

export function LeaveEntry({
  event,
  titular,
  employees,
  canLeaves,
  canSubstitute,
  onUpdated,
  onRemoved,
  notify
}: {
  event: Row;
  titular: Row | undefined;
  employees: Row[];
  canLeaves: boolean;
  canSubstitute: boolean;
  onUpdated: (row: Row) => void;
  onRemoved: (id: string) => void;
  notify: (message: string) => void;
}) {
  const from = isoDay(event.startsAt);
  const to = isoDay(event.endsAt);

  const [subs, setSubs] = useState<Substitution[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<SyncOutcome[]>([]);
  const [pendingApply, setPendingApply] = useState<{
    ids: string[];
    refresh: { from: string; to: string };
  } | null>(null);

  const loadSubs = useCallback(async () => {
    try {
      setSubs(await request<Substitution[]>(`/substitutions?leaveEventId=${event.id}`));
      setError("");
    } catch (e) {
      setError(errorText(e, "Não foi possível carregar as substituições."));
    } finally {
      setLoaded(true);
    }
  }, [event.id]);
  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);

  const active = subs.filter((s) => s.status === "ACTIVE");

  // ── datas do afastamento ────────────────────────────────────────────────
  const [editingDates, setEditingDates] = useState(false);
  const [newStart, setNewStart] = useState(from);
  const [newEnd, setNewEnd] = useState(to);

  async function confirmLocked(ids: string[], refresh: { from: string; to: string }) {
    setBusy(true);
    try {
      const results = await Promise.all(
        ids.map((id) =>
          request<{ schedules: SyncOutcome[] }>(`/substitutions/${id}/apply`, "POST", {
            applyToLockedSchedules: true,
            refreshFrom: refresh.from,
            refreshTo: refresh.to
          })
        )
      );
      // O mesmo mês pode vir de mais de uma substituição: mostra o resultado mais recente de cada um.
      const byMonth = new Map<string, SyncOutcome>();
      for (const r of results) for (const o of r.schedules) byMonth.set(o.month, o);
      setOutcomes([...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)));
      setPendingApply(null);
      await loadSubs();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDates() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await request<Row & { substitutionSync?: LeaveSync }>(
        `/calendar/events/${event.id}`,
        "PATCH",
        { startsAt: `${newStart}T00:00:00.000Z`, endsAt: `${newEnd}T23:59:59.000Z` }
      );
      const { substitutionSync, ...row } = updated;
      onUpdated({ ...event, ...row });
      setEditingDates(false);
      if (substitutionSync) {
        setOutcomes(substitutionSync.schedules);
        if (substitutionSync.schedules.some((o) => o.outcome === "NEEDS_CONFIRMATION")) {
          setPendingApply({
            ids: substitutionSync.substitutions.map((s) => s.id),
            refresh: { from: from < newStart ? from : newStart, to: to > newEnd ? to : newEnd }
          });
        }
      }
      await loadSubs();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const withSubs = active.length;
    const ask = withSubs
      ? `Remover este afastamento? ${withSubs === 1 ? "A substituição dele será cancelada" : `As ${withSubs} substituições dele serão canceladas`} e as coberturas saem das escalas.`
      : "Remover este afastamento?";
    if (!window.confirm(ask)) return;
    setBusy(true);
    try {
      const archived = await request<Row & { substitutionSync?: LeaveSync }>(
        `/calendar/events/${event.id}`,
        "DELETE"
      );
      const sync = archived.substitutionSync;
      const locked = sync?.schedules.filter((o) => o.outcome === "NEEDS_CONFIRMATION") ?? [];
      let message = "Afastamento removido.";
      if (sync) {
        const done = sync.schedules.filter(
          (o) => o.outcome === "UPDATED" || o.outcome === "NEW_VERSION"
        );
        if (done.length) message += ` ${done.map((o) => o.message).join(" ")}`;
        const problems = sync.schedules.filter((o) =>
          ["CONFLICT", "FAILED", "NOT_SUPPORTED"].includes(o.outcome)
        );
        if (problems.length) message += ` Atenção: ${problems.map((o) => o.message).join(" ")}`;
      }
      if (locked.length && sync) {
        const go = window.confirm(
          `${locked.map((o) => o.message).join("\n\n")}\n\nCriar a nova versão em rascunho agora?`
        );
        if (go) {
          const results = await Promise.all(
            sync.substitutions.map((s) =>
              request<{ schedules: SyncOutcome[] }>(`/substitutions/${s.id}/apply`, "POST", {
                applyToLockedSchedules: true,
                refreshFrom: from,
                refreshTo: to
              })
            )
          );
          const created = results
            .flatMap((r) => r.schedules)
            .filter((o) => o.outcome === "NEW_VERSION");
          if (created.length) message += ` ${created.map((o) => o.message).join(" ")}`;
        } else {
          message += " As escalas bloqueadas não foram alteradas.";
        }
      }
      notify(message);
      onRemoved(event.id);
    } catch (e) {
      notify(errorText(e, "Não foi possível remover o afastamento."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{text(event.title)}</p>
          <p className="text-xs text-slate-500">
            {date(event.startsAt)} – {date(event.endsAt)}
          </p>
        </div>
        {canLeaves && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              icon={<CalendarClock size={14} />}
              onClick={() => {
                setNewStart(from);
                setNewEnd(to);
                setEditingDates((v) => !v);
              }}
              aria-label="Alterar datas do afastamento"
              title="Alterar datas"
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} />}
              disabled={busy}
              onClick={() => void remove()}
              aria-label="Remover afastamento"
            />
          </div>
        )}
      </div>

      {editingDates && (
        <div className="space-y-2 rounded bg-slate-50 p-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              Início
              <input
                className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              Fim
              <input
                className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </label>
          </div>
          {active.length ? (
            <p className="text-xs text-slate-600">
              Este afastamento tem substituição: ao salvar, as coberturas e as escalas já geradas
              são recalculadas.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !newStart || !newEnd || newEnd < newStart}
              onClick={() => void saveDates()}
            >
              {busy ? "Salvando..." : "Salvar datas"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingDates(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Users size={13} aria-hidden /> Substituição
        </p>
        {!loaded ? (
          <p className="text-xs text-slate-500">Carregando...</p>
        ) : subs.length === 0 ? (
          <p className="text-xs text-slate-500">Sem substituto definido (não é obrigatório).</p>
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => (
              <SubstitutionItem
                key={s.id}
                sub={s}
                leave={{ from, to }}
                titular={titular}
                employees={employees}
                canSubstitute={canSubstitute}
                onChanged={async (result) => {
                  setOutcomes(result?.schedules ?? []);
                  if (result?.schedules.some((o) => o.outcome === "NEEDS_CONFIRMATION"))
                    setPendingApply({ ids: [s.id], refresh: { from, to } });
                  await loadSubs();
                }}
              />
            ))}
          </ul>
        )}

        {canSubstitute && (
          <SubstitutionForm
            leaveEventId={String(event.id)}
            leave={{ from, to }}
            titular={titular}
            employees={employees}
            takenSubstituteIds={active.map((s) => s.substituteId)}
            onSaved={async (result) => {
              setOutcomes(result.schedules);
              if (result.schedules.some((o) => o.outcome === "NEEDS_CONFIRMATION"))
                setPendingApply({ ids: [result.substitution.id], refresh: { from, to } });
              await loadSubs();
            }}
          />
        )}

        <ScheduleOutcomes
          outcomes={outcomes}
          busy={busy}
          onConfirm={
            pendingApply
              ? () => void confirmLocked(pendingApply.ids, pendingApply.refresh)
              : undefined
          }
        />
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── uma substituição já cadastrada ───────────────────────────────────────────

function SubstitutionItem({
  sub,
  leave,
  titular,
  employees,
  canSubstitute,
  onChanged
}: {
  sub: Substitution;
  leave: { from: string; to: string };
  titular: Row | undefined;
  employees: Row[];
  canSubstitute: boolean;
  onChanged: (result?: { schedules: SyncOutcome[] }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const badge = statusBadge[sub.effectiveStatus];
  const rotation =
    sub.rotation === "HABITUAL"
      ? "rodízio habitual"
      : `rodízio específico (${sub.specificParity === "ODD" ? "Ímpar" : "Par"})`;

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ schedules: SyncOutcome[] }>(
        `/substitutions/${sub.id}/cancel`,
        "POST",
        { reason }
      );
      setCancelling(false);
      setReason("");
      await onChanged(result);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 rounded bg-slate-50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs">
          <p className="font-medium text-slate-800">
            {sub.substituteName} cobre {sub.titularName}
          </p>
          <p className="text-slate-500">
            {rotation}
            {sub.coveredDates.length
              ? ` · só ${sub.coveredDates.length} plantões escolhidos`
              : " · todos os plantões do período"}
          </p>
          {sub.cancelReason ? (
            <p className="text-slate-500">Motivo do cancelamento: {sub.cancelReason}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {canSubstitute && sub.status === "ACTIVE" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Pencil size={13} />}
                aria-label="Alterar substituição"
                onClick={() => setEditing((v) => !v)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={13} />}
                aria-label="Cancelar substituição"
                onClick={() => setCancelling((v) => !v)}
              />
            </>
          )}
        </div>
      </div>

      {cancelling && (
        <div className="space-y-2">
          <label className="block text-xs">
            Motivo do cancelamento <span className="text-red-500">*</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-500">
            As coberturas saem das escalas; o registro da substituição é mantido.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={busy || reason.trim().length < 5}
              onClick={() => void cancel()}
            >
              {busy ? "Cancelando..." : "Cancelar substituição"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <SubstitutionForm
          existing={sub}
          leaveEventId=""
          leave={leave}
          titular={titular}
          employees={employees}
          takenSubstituteIds={[]}
          startOpen
          onClose={() => setEditing(false)}
          onSaved={async (result) => {
            setEditing(false);
            await onChanged(result);
          }}
        />
      )}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </li>
  );
}

// ── configurar / alterar ─────────────────────────────────────────────────────

function SubstitutionForm({
  leaveEventId,
  existing,
  leave,
  titular,
  employees,
  takenSubstituteIds,
  startOpen = false,
  onClose,
  onSaved
}: {
  leaveEventId: string;
  existing?: Substitution;
  leave: { from: string; to: string };
  titular: Row | undefined;
  employees: Row[];
  takenSubstituteIds: string[];
  startOpen?: boolean;
  onClose?: () => void;
  onSaved: (result: SubstitutionResult) => Promise<void>;
}) {
  const [open, setOpen] = useState(startOpen);
  const [substituteId, setSubstituteId] = useState(existing?.substituteId ?? "");
  const [mode, setMode] = useState<"HABITUAL" | "ODD" | "EVEN">(
    existing
      ? existing.rotation === "HABITUAL"
        ? "HABITUAL"
        : (existing.specificParity ?? "ODD")
      : "HABITUAL"
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [picked, setPicked] = useState<Set<string> | null>(
    existing?.coveredDates.length ? new Set(existing.coveredDates) : null // null = todos
  );
  const [plan, setPlan] = useState<Plan | null>(null);
  const [blocked, setBlocked] = useState<IssueGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const candidates = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.operationId === titular?.operationId &&
          e.id !== titular?.id &&
          e.recordStatus !== "ARCHIVED" &&
          !["TERMINATED", "INACTIVE"].includes(String(e.status)) &&
          (e.id === existing?.substituteId || !takenSubstituteIds.includes(e.id))
      ),
    [employees, titular, existing, takenSubstituteIds]
  );

  const demandDates = useMemo(() => plan?.months.flatMap((m) => m.demandDates) ?? [], [plan]);
  const body = useCallback(
    (extra: object = {}) => ({
      substituteId,
      rotation: mode === "HABITUAL" ? "HABITUAL" : "SPECIFIC",
      specificParity: mode === "HABITUAL" ? null : mode,
      // todos os plantões marcados = sem restrição (acompanha mudanças de data do afastamento)
      coveredDates:
        picked && demandDates.length && picked.size < demandDates.length ? [...picked].sort() : [],
      notes: notes.trim() || null,
      ...extra
    }),
    [substituteId, mode, picked, demandDates, notes]
  );

  async function send(dryRun: boolean) {
    if (!substituteId || busy) return;
    setBusy(true);
    setError("");
    setBlocked([]);
    try {
      const result = existing
        ? await request<SubstitutionResult>(
            `/substitutions/${existing.id}`,
            "PATCH",
            body({ dryRun })
          )
        : await request<SubstitutionResult>(
            "/substitutions",
            "POST",
            body({ leaveEventId, dryRun })
          );
      setPlan(result.plan);
      if (!dryRun) {
        await onSaved(result);
        if (!existing) {
          setOpen(false);
          setSubstituteId("");
          setPicked(null);
          setPlan(null);
        }
      }
    } catch (e) {
      setError(errorText(e));
      if (e instanceof ApiRequestError && Array.isArray(e.details.issues))
        setBlocked(e.details.issues as IssueGroup[]);
      if (e instanceof ApiRequestError && e.details.plan) setPlan(e.details.plan as Plan);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="secondary"
        icon={<UserPlus size={14} />}
        onClick={() => setOpen(true)}
      >
        Definir substituto
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">
        {existing ? "Alterar substituição" : "Nova substituição"} · afastamento de{" "}
        {dateBr(leave.from)} a {dateBr(leave.to)}
      </p>
      <label className="block text-xs">
        Quem substitui <span className="text-red-500">*</span>
        <select
          className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
          value={substituteId}
          onChange={(e) => {
            setSubstituteId(e.target.value);
            setPlan(null);
          }}
        >
          <option value="">Selecione...</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {text(c.name)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Rodízio da substituição
        <select
          className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            setPlan(null);
          }}
        >
          <option value="HABITUAL">
            Habitual — cobre nos dias de folga dele, sem mudar o cadastro
          </option>
          <option value="ODD">Específico — só os plantões em dias Ímpares</option>
          <option value="EVEN">Específico — só os plantões em dias Pares</option>
        </select>
        <span className="mt-1 block text-slate-500">
          Vale só durante este afastamento. Cada plantão coberto aparece na escala do substituto
          como Cobertura (C).
        </span>
      </label>
      <label className="block text-xs">
        Observação (opcional)
        <input
          className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {plan && demandDates.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-slate-700">
            Plantões do afastado a cobrir
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {demandDates.map((d) => {
              const checked = picked === null || picked.has(d);
              return (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs ${checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white text-slate-500"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setPicked((current) => {
                        const next = new Set(current ?? demandDates);
                        if (next.has(d)) next.delete(d);
                        else next.add(d);
                        return next.size === demandDates.length ? null : next;
                      })
                    }
                  />
                  {shortBr(d)}
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">
            Desmarque os plantões que não precisam de cobertura. Depois, veja o plano de novo.
          </p>
        </fieldset>
      )}

      {plan ? <PlanSummary plan={plan} /> : null}
      {blocked.length ? <IssueList groups={blocked} /> : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!substituteId || busy}
          onClick={() => void send(true)}
        >
          {busy ? "Calculando..." : "Ver plano"}
        </Button>
        <Button size="sm" disabled={!substituteId || busy} onClick={() => void send(false)}>
          {existing ? "Salvar alterações" : "Salvar substituição"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          Fechar
        </Button>
      </div>
    </div>
  );
}
