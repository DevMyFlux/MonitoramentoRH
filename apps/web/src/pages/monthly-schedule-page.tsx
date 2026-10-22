/* This page synchronizes the persisted monthly schedule when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Fragment, useMemo, useRef, useState, useEffect } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import {
  groupPendencies,
  holidaysOfMonth,
  scheduleCodeMap,
  scheduleCodes,
  type IssueGroup,
  type SchedulePendencyLike
} from "@my-flux/shared";
import { Badge, Button } from "../components/ui";
import { IssueList } from "../components/issue-list";
import { usePermissions } from "../features/auth/session-store";
import { ApiRequestError, download, errorText, request, text, date, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";

const demoOp = "55555555-5555-4555-8555-555555555555";

type GridRow = {
  employeeId: string;
  employeeName: string;
  initials: string;
  functionName: string;
  scheduleLabel: string;
  hours: string;
  days: string[];
  observation: string | null;
};
type GridSection = { label: string; rows: GridRow[] };
type Grid = {
  year: number;
  month: number;
  sections: GridSection[];
  /** Legal holidays of the month, recorded at generation (absent on older schedules). */
  holidays?: { day: number; name: string }[];
};
type Pendency = SchedulePendencyLike & { employeeId: string };
type Metrics = { required: number; covered: number; coverage: number };
type SelectedCell = {
  employeeId: string;
  employeeName: string;
  sectionIndex: number;
  rowIndex: number;
  dayIndex: number;
  date: string;
  currentCode: string;
};

/** Situação da escala em português. "Reprovada" é próprio da escala (as avaliações usam "Rejeitado" no mapa compartilhado). */
const statusLabel = (status: string) => (status === "REJECTED" ? "Reprovada" : (labels[status] ?? status));

const historyLabels: Record<string, string> = {
  SCHEDULE_GENERATE: "Gerada",
  SUBMIT: "Enviada para aprovação",
  APPROVE: "Aprovada",
  REJECT: "Reprovada",
  PUBLISH: "Publicada",
  SUPERSEDED: "Substituída por versão mais recente",
  EDIT: "Editada",
  NEW_VERSION_DRAFTED: "Nova versão em rascunho criada para revisar esta escala",
  ARCHIVE: "Excluída",
  DELETE: "Excluída"
};
type HistoryEntry = { id: string; action: string; reason: string | null; at: string; byName: string | null };

type EditOutcome = {
  changed: boolean;
  derived: boolean;
  versionId: string;
  revision: number;
  issues: IssueGroup[];
  cells: Array<{ employeeId: string; date: string; current: string; rule: string }>;
};
/** Resultado da pré-validação de um ajuste (a API valida de verdade ao salvar; isto só adianta a resposta). */
type EditPreview = { issues: IssueGroup[]; blocked: boolean; problem: string | null };
const JUSTIFICATION_ISSUE = "EDIT_JUSTIFICATION_REQUIRED";

/** O código que a regra colocaria na célula, vindo dos detalhes de uma recusa do servidor. */
function ruleFromDetails(details: Record<string, unknown>): string | undefined {
  const cells = details.cells as EditOutcome["cells"] | undefined;
  return Array.isArray(cells) ? cells[0]?.rule : undefined;
}

/** O que acontece ao salvar um ajuste, conforme a situação da escala. `null` = edita a própria versão. */
function versionNotice(status: string): string | null {
  switch (status) {
    case "IN_REVIEW":
      return "Esta escala está em análise. Ao salvar, é criada uma nova versão em rascunho com este ajuste; a análise atual perde a validade e a nova versão precisa ser enviada para aprovação.";
    case "APPROVED":
      return "Esta escala já foi aprovada. Ao salvar, é criada uma nova versão em rascunho com este ajuste; a aprovação atual não vale para ela e a nova versão precisa ser aprovada de novo.";
    case "PUBLISHED":
      return "Esta escala está publicada. Ao salvar, é criada uma nova versão em rascunho; a publicada continua valendo até a nova ser aprovada e publicada.";
    default:
      return null;
  }
}

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  DRAFT: "neutral",
  IN_REVIEW: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  PUBLISHED: "success",
  ARCHIVED: "neutral"
};

const monthNames = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

function getGrid(version: Row | null): Grid | null {
  return ((version?.generatedResult as Row | undefined)?.grid as Grid | undefined) ?? null;
}
function getMetrics(version: Row | null): Metrics | null {
  return ((version?.generatedResult as Row | undefined)?.metrics as Metrics | undefined) ?? null;
}
function getPendencies(version: Row | null): Pendency[] {
  return ((version?.generatedResult as Row | undefined)?.pendencies as Pendency[] | undefined) ?? [];
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
/** "outubro/2026" from the version's month (stored as the 1st of the month, UTC). */
function monthLabel(value: unknown): string {
  const [year, month] = String(value).slice(0, 7).split("-").map(Number);
  const name = monthNames[(month ?? 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}/${year}`;
}
/** When the version was generated, in the browser's local time. */
function generatedAt(value: unknown): string {
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function MonthlySchedulePage() {
  // Só a interface: a API valida cada permissão no servidor. Aqui se evita mostrar o que o perfil não pode fazer.
  const { can } = usePermissions();
  const canEdit = can("schedules:edit");
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [operationId, setOperationId] = useState(demoOp);
  const [unitTouched, setUnitTouched] = useState(false);
  const [month, setMonth] = useState("2026-10");
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overridesIndex, setOverridesIndex] = useState<Map<string, Row>>(new Map());
  const [cell, setCell] = useState<SelectedCell | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [ruleCode, setRuleCode] = useState<string | null>(null);
  const previewSeq = useRef(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const selected = schedules.find((s) => s.id === selectedId) ?? null;
  // Versão substituída só se consulta; o resto depende da permissão (a API confere de novo ao salvar).
  const editable = canEdit && Boolean(selected) && !selected?.supersededAt;
  const grid = getGrid(selected);
  const pendencies = getPendencies(selected);
  const issueGroups = useMemo(() => groupPendencies(pendencies), [selected?.id, selected?.generatedResult]);

  // Units never mix on this screen: everything below is the schedules of the
  // unit picked in "Operação", most recently generated first. The first one is
  // "a última escala gerada"; the rest only show up under Histórico.
  const unitSchedules = useMemo(
    () =>
      schedules
        .filter((s) => s.operationId === operationId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [schedules, operationId]
  );
  const latest = unitSchedules[0] ?? null;
  // escalas em análise e ainda válidas (não substituídas), de todas as unidades do acesso do usuário
  const pendingApprovals = schedules.filter((s) => text(s.status) === "IN_REVIEW" && !s.supersededAt);
  const unitName = text(operations.find((o) => o.id === operationId)?.name ?? "—");

  async function load() {
    try {
      const [s, o] = await Promise.all([
        request<Row[]>("/schedules"),
        request<Row[]>("/operations")
      ]);
      setSchedules(s);
      setOperations(o);
      if (o.length && !o.some((x) => x.id === operationId)) setOperationId(o.at(0)?.id ?? demoOp);
    } catch (e) {
      setNotice(errorText(e, "Falha ao carregar escalas."));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Open on the unit that was worked on last, not on whatever the dropdown lists
  // first — until the user picks a unit themselves.
  useEffect(() => {
    if (unitTouched || !schedules.length) return;
    const newest = [...schedules].sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    )[0];
    if (newest && newest.operationId !== operationId) setOperationId(text(newest.operationId));
  }, [schedules, unitTouched]);

  // The latest schedule of the unit is shown open, whatever its status. When a
  // different one becomes "the latest" (unit switch, new generation, deletion)
  // it takes the viewer over.
  useEffect(() => {
    if (!latest) {
      setSelectedId(null);
      return;
    }
    setSelectedId(latest.id);
    void loadOverrides(latest);
  }, [latest?.id]);

  async function loadOverrides(version: Row) {
    try {
      const versionMonth = String(version.month).slice(0, 7);
      const rows = await request<Row[]>(
        `/schedule-day-overrides?operationId=${version.operationId}&month=${versionMonth}`
      );
      setOverridesIndex(
        new Map(rows.map((r) => [`${r.employeeId}|${String(r.date).slice(0, 10)}`, r]))
      );
    } catch {
      setOverridesIndex(new Map());
    }
  }

  /** Same for every status: opening a schedule never depends on where it is in the workflow. */
  function toggleView(s: Row) {
    if (s.id === selectedId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(s.id);
    void loadOverrides(s);
  }

  async function generate() {
    try {
      const row = await request<Row>("/employee-schedules/generate", "POST", { operationId, month });
      setSchedules((s) => [row, ...s]);
      setSelectedId(row.id);
      void loadOverrides(row);
      setNotice("Escala gerada a partir dos colaboradores ativos desta unidade.");
    } catch (e) {
      setNotice(
        errorText(e, "Geração bloqueada; verifique os colaboradores desta unidade.")
      );
    }
  }

  async function status(version: Row, next: string, reason?: string) {
    try {
      await request<Row>(`/schedules/${version.id}/status`, "PATCH", {
        status: next,
        // a revisão que a pessoa está vendo: se alguém mudou a escala nesse meio-tempo, a API recusa em vez de sobrescrever
        expectedRevision: Number(version.revision) || undefined,
        ...(reason ? { reason } : {})
      });
      setNotice(`Escala ${statusLabel(next).toLowerCase()}.`);
      setRejecting(null);
      setRejectReason("");
      await load();
      if (historyOf === version.id) void openHistory(version);
    } catch (e) {
      setNotice(errorText(e, "Transição não permitida para este perfil."));
      await load(); // a escala pode ter mudado: mostra o estado atual
    }
  }

  async function openHistory(version: Row) {
    if (historyOf === version.id && history.length) {
      setHistoryOf(null);
      return;
    }
    try {
      setHistory(await request<HistoryEntry[]>(`/schedules/${version.id}/history`));
      setHistoryOf(version.id);
    } catch (e) {
      setNotice(errorText(e, "Não foi possível carregar o histórico."));
    }
  }

  async function exportXlsx(version: Row) {
    try {
      // No explicit name: the server picks it (e.g. "Escala Hetrin - Setembro.xlsx").
      await download(`/employee-schedules/${version.id}/export`);
    } catch (e) {
      setNotice(errorText(e, "Não foi possível exportar esta versão."));
    }
  }

  async function removeSchedule(version: Row) {
    if (deletingId) return;
    const published = text(version.status) === "PUBLISHED";
    const confirmed = window.confirm(
      `Excluir esta escala?\n\n` +
        `Unidade: ${text(operations.find((o) => o.id === version.operationId)?.name ?? "—")}\n` +
        `Período: ${monthLabel(version.month)} · Versão ${text(version.version)}\n` +
        `Gerada em: ${generatedAt(version.createdAt)}\n` +
        `Status: ${statusLabel(text(version.status))}\n\n` +
        (published ? "ATENÇÃO: esta escala está PUBLICADA.\n\n" : "") +
        `Só esta escala sai da lista. Colaboradores, outras escalas e outras unidades não são afetados.`
    );
    if (!confirmed) return;
    setDeletingId(version.id);
    try {
      await request(`/employee-schedules/${version.id}`, "DELETE");
      setSchedules((current) => current.filter((x) => x.id !== version.id));
      setNotice(`Escala ${monthLabel(version.month)} · versão ${text(version.version)} excluída.`);
    } catch (e) {
      setNotice(errorText(e, "Não foi possível excluir a escala."));
    } finally {
      setDeletingId(null);
    }
  }

  function openCell(sectionIndex: number, rowIndex: number, dayIndex: number) {
    if (!grid) return;
    const row = grid.sections[sectionIndex]!.rows[rowIndex]!;
    const dateStr = `${grid.year}-${pad(grid.month)}-${pad(dayIndex + 1)}`;
    setCell({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      sectionIndex,
      rowIndex,
      dayIndex,
      date: dateStr,
      currentCode: row.days[dayIndex] ?? ""
    });
    setEditCode(row.days[dayIndex] ?? "");
    setEditReason("");
    setPreview(null);
    setRuleCode(null);
  }

  function editBody(dryRun: boolean) {
    const reason = editReason.trim();
    return {
      expectedRevision: Number(selected?.revision),
      dryRun,
      changes: [{ employeeId: cell?.employeeId, date: cell?.date, code: editCode, ...(reason ? { reason } : {}) }],
      ...(reason ? { justification: reason } : {})
    };
  }

  // Pré-validação enquanto a pessoa escolhe o código/escreve o motivo: mostra, em linguagem simples, o que a API
  // recusaria ou avisaria — sem gravar nada. Respostas atrasadas são descartadas.
  useEffect(() => {
    if (!cell || !selected || !editable) return;
    const seq = ++previewSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const out = await request<EditOutcome>(`/employee-schedules/${selected.id}/cells`, "PATCH", editBody(true));
          if (seq !== previewSeq.current) return;
          setRuleCode(out.cells[0]?.rule ?? null);
          setPreview({ issues: out.issues, blocked: false, problem: null });
        } catch (e) {
          if (seq !== previewSeq.current) return;
          if (e instanceof ApiRequestError && e.code === "SCHEDULE_EDIT_INVALID" && Array.isArray(e.details.issues)) {
            setRuleCode(ruleFromDetails(e.details) ?? null);
            setPreview({ issues: e.details.issues as IssueGroup[], blocked: true, problem: null });
          } else {
            setPreview({ issues: [], blocked: false, problem: errorText(e, "Não foi possível validar o ajuste.") });
          }
        }
      })();
    }, 250);
    return () => {
      previewSeq.current++;
      window.clearTimeout(timer);
    };
  }, [cell?.employeeId, cell?.date, editCode, editReason, selected?.id, selected?.revision]);

  async function saveEdit() {
    if (!cell || !selected || saving) return;
    setSaving(true);
    try {
      const out = await request<EditOutcome>(`/employee-schedules/${selected.id}/cells`, "PATCH", editBody(false));
      setCell(null);
      setNotice(
        !out.changed
          ? "Nada a alterar: este dia já está com esse código."
          : out.derived
            ? "Ajuste salvo em uma nova versão (rascunho). A aprovação anterior não vale para ela: envie para aprovação quando terminar os ajustes."
            : "Ajuste salvo e a escala foi revalidada. Ele será mantido nas próximas gerações desta unidade/mês."
      );
      await load();
      if (out.derived) setSelectedId(out.versionId);
      else void loadOverrides(selected); // realce dos dias com ajuste manual
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "SCHEDULE_EDIT_INVALID" && Array.isArray(e.details.issues)) {
        setRuleCode(ruleFromDetails(e.details) ?? ruleCode);
        setPreview({ issues: e.details.issues as IssueGroup[], blocked: true, problem: null });
      } else {
        setCell(null);
        setNotice(errorText(e, "Não foi possível salvar o ajuste."));
        await load(); // a escala pode ter mudado: mostra o estado atual
      }
    } finally {
      setSaving(false);
    }
  }

  const codeColors = useMemo(
    () => new Map(scheduleCodes.map((c) => [c.code, c.color])),
    []
  );

  // Workflow buttons — unchanged meaning, identical for the latest card and the
  // history rows.
  function statusActions(s: Row) {
    const current = text(s.status);
    if (s.supersededAt) return null; // versão substituída: não se decide mais
    return (
      <>
        {(current === "DRAFT" || current === "REJECTED") && can("schedules:submit") && (
          <Button size="sm" icon={<Check size={14} />} onClick={() => void status(s, "IN_REVIEW")}>
            {current === "REJECTED" ? "Reenviar para aprovação" : "Enviar para aprovação"}
          </Button>
        )}
        {current === "IN_REVIEW" && can("schedules:approve") && (
          <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => void status(s, "APPROVED")}>
            Aprovar
          </Button>
        )}
        {current === "IN_REVIEW" && can("schedules:reject") && (
          <Button
            size="sm"
            variant="danger"
            icon={<X size={14} />}
            onClick={() => {
              setRejecting(s);
              setRejectReason("");
            }}
          >
            Reprovar
          </Button>
        )}
        {current === "APPROVED" && can("schedules:publish") && (
          <Button size="sm" onClick={() => void status(s, "PUBLISHED")}>
            Publicar
          </Button>
        )}
      </>
    );
  }

  /** Motivo da reprovação, substituição por versão mais nova e o histórico de decisões (quem, quando, por quê). */
  function decisionNotes(s: Row) {
    const superseded = s.supersededAt
      ? unitSchedules.find((x) => x.id === s.supersededById)
      : undefined;
    return (
      <div className="mt-3 space-y-2">
        {text(s.status) === "REJECTED" && s.rejectionReason ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Reprovada em {generatedAt(s.rejectedAt)}</p>
            <p className="mt-0.5">Motivo: {text(s.rejectionReason)}</p>
            <p className="mt-1 text-xs">Corrija a escala, ajuste o que for preciso e reenvie para aprovação.</p>
          </div>
        ) : null}
        {s.supersededAt ? (
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Esta versão foi substituída{superseded ? ` pela versão ${text(superseded.version)}` : " por uma mais recente"} e
            fica só para consulta.
          </p>
        ) : null}
        <button
          type="button"
          className="text-xs font-medium text-emerald-800 hover:underline"
          onClick={() => void openHistory(s)}
        >
          {historyOf === s.id ? "Ocultar histórico de decisões" : "Ver histórico de decisões"}
        </button>
        {historyOf === s.id && (
          <ol className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-slate-500">{generatedAt(h.at)}</span> ·{" "}
                <b>{historyLabels[h.action] ?? h.action}</b>
                {h.byName ? ` — ${h.byName}` : ""}
                {h.reason ? <span className="text-slate-600"> · {h.reason}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  function viewButton(s: Row) {
    const open = s.id === selectedId;
    return (
      <Button
        size="sm"
        variant="ghost"
        icon={open ? <EyeOff size={14} /> : <Eye size={14} />}
        onClick={() => toggleView(s)}
      >
        {open ? "Ocultar escala" : "Visualizar escala"}
      </Button>
    );
  }

  function metricsRow(s: Row) {
    const m = getMetrics(s);
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded bg-slate-50 p-3 text-sm">
          Necessário
          <br />
          <b>{m?.required ?? "—"}</b>
        </div>
        <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">
          Coberto
          <br />
          <b>{m?.covered ?? "—"}</b>
        </div>
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Cobertura
          <br />
          <b>{m?.coverage ?? "—"}%</b>
        </div>
      </div>
    );
  }

  function scheduleViewer(s: Row) {
    if (s.id !== selectedId) return null;
    if (!grid) {
      return (
        <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Esta versão não guarda a grade de colaboradores (foi gerada por um fluxo anterior), então
          não há o que exibir aqui.
        </div>
      );
    }
    // Older versions were saved without the holiday list: the calendar is fixed, so derive it.
    const unitCode = text(operations.find((o) => o.id === s.operationId)?.code ?? "");
    const holidayByDay = new Map(
      (grid.holidays ?? holidaysOfMonth(grid.year, grid.month, unitCode)).map((holiday) => [holiday.day, holiday.name])
    );
    return (
      <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {scheduleCodes
            .filter((c) => c.color)
            .map((c) => (
              <span key={c.code} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 rounded"
                  style={{
                    backgroundColor: c.color?.fill ? `#${c.color.fill}` : "transparent",
                    border: `2px solid #${c.color?.font}`
                  }}
                />
                {c.code} — {c.label}
              </span>
            ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-slate-200" />F — Folga
          </span>
          {holidayByDay.size > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: "#B4C6E7" }} />
              Feriado:{" "}
              {[...holidayByDay]
                .map(([day, name]) => `${pad(day)}/${pad(grid.month)} ${name}`)
                .join(" · ")}
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-left">Colaborador</th>
                <th className="px-2 py-2 text-left">Escala</th>
                <th className="px-2 py-2 text-left">Horário</th>
                {Array.from({ length: grid.sections[0]?.rows[0]?.days.length ?? 0 }, (_, i) => (
                  <th
                    className="px-1 py-2 text-center"
                    key={i}
                    title={holidayByDay.get(i + 1) ? `Feriado: ${holidayByDay.get(i + 1)}` : undefined}
                    style={holidayByDay.has(i + 1) ? { backgroundColor: "#B4C6E7", color: "#1F3A63" } : undefined}
                  >
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.sections.map((section, sectionIndex) => (
                <Fragment key={section.label}>
                  <tr>
                    <td
                      colSpan={3 + (section.rows[0]?.days.length ?? 0)}
                      className="bg-yellow-100 px-2 py-1 font-semibold"
                    >
                      {section.label}
                    </td>
                  </tr>
                  {section.rows.map((row, rowIndex) => (
                    <tr key={row.employeeId} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5">
                        <div className="font-medium">{row.employeeName}</div>
                        <div className="text-slate-400">{row.initials}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">{row.scheduleLabel}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{row.hours}</td>
                      {row.days.map((code, dayIndex) => {
                        const color = codeColors.get(code);
                        const hasOverride = overridesIndex.has(
                          `${row.employeeId}|${grid.year}-${pad(grid.month)}-${pad(dayIndex + 1)}`
                        );
                        return (
                          <td
                            key={dayIndex}
                            role={editable ? "button" : undefined}
                            tabIndex={editable ? 0 : undefined}
                            onClick={() => editable && openCell(sectionIndex, rowIndex, dayIndex)}
                            className={`w-7 px-0.5 py-1.5 text-center ${editable ? "cursor-pointer hover:bg-emerald-50" : ""}`}
                            style={{
                              color: color ? `#${color.font}` : undefined,
                              fontWeight: color?.bold ? 700 : 400,
                              backgroundColor: color?.fill
                                ? `#${color.fill}`
                                : hasOverride
                                  ? "#ECFDF5"
                                  : holidayByDay.has(dayIndex + 1)
                                    ? "#DCE6F5"
                                    : undefined
                            }}
                            title={
                              hasOverride
                                ? "Ajuste manual"
                                : holidayByDay.get(dayIndex + 1)
                                  ? `Feriado: ${holidayByDay.get(dayIndex + 1)}`
                                  : undefined
                            }
                          >
                            {code || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <IssueList groups={issueGroups} />
      </div>
    );
  }

  const leaveCell = cell ? scheduleCodeMap[cell.currentCode]?.category === "LEAVE" : false;
  const needReason =
    Boolean(cell) && Boolean(ruleCode) && editCode !== cell?.currentCode && editCode !== ruleCode;
  // O motivo obrigatório aparece no próprio campo; os demais impeditivos vêm em lista, em linguagem simples.
  const shownIssues = (preview?.issues ?? []).filter((g) => g.code !== JUSTIFICATION_ISSUE);
  const blockedByRule = shownIssues.some((g) => g.severity === "blocking");
  const canSave =
    !saving &&
    Boolean(cell) &&
    editCode !== cell?.currentCode &&
    !blockedByRule &&
    !(needReason && !editReason.trim());

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Escalar</p>
          <h1 className="mt-2 text-2xl font-semibold">Escalas mensais</h1>
          <p className="mt-1 text-sm text-slate-600">
            Geração automática por colaborador, com edição manual célula a célula por cima do
            resultado.
          </p>
        </div>
        <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
          Atualizar
        </Button>
      </div>
      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {notice}
        </div>
      )}
      {can("schedules:approve") && pendingApprovals.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">
            {pendingApprovals.length === 1
              ? "Há 1 escala aguardando a sua decisão."
              : `Há ${pendingApprovals.length} escalas aguardando a sua decisão.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingApprovals.slice(0, 6).map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setUnitTouched(true);
                  setOperationId(text(p.operationId));
                  setSelectedId(p.id);
                  void loadOverrides(p);
                }}
              >
                {text(operations.find((o) => o.id === p.operationId)?.name ?? "Unidade")} · {monthLabel(p.month)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded bg-white p-6 shadow-2xl" role="dialog" aria-label="Reprovar escala">
            <h2 className="font-semibold">Reprovar escala</h2>
            <p className="mt-1 text-sm text-slate-600">
              {monthLabel(rejecting.month)} · Versão {text(rejecting.version)}. O motivo é obrigatório e o RH o verá para
              corrigir e reenviar.
            </p>
            <label className="mt-4 block text-sm">
              Motivo da reprovação
              <textarea
                className="mt-1 w-full rounded border p-2"
                rows={4}
                value={rejectReason}
                maxLength={1000}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">Mínimo de 5 caracteres.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={rejectReason.trim().length < 5}
                onClick={() => void status(rejecting, "REJECTED", rejectReason.trim())}
              >
                Reprovar escala
              </Button>
            </div>
          </div>
        </div>
      )}
      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            Operação
            <select
              className="mt-1 w-full rounded border p-2"
              value={operationId}
              onChange={(e) => {
                setUnitTouched(true);
                setOperationId(e.target.value);
              }}
            >
              {operations.length ? (
                operations.map((o) => (
                  <option value={o.id} key={o.id}>
                    {text(o.name)}
                  </option>
                ))
              ) : (
                <option value={demoOp}>Operação Demonstrativa</option>
              )}
            </select>
          </label>
          <label className="text-sm">
            Mês
            <input
              className="mt-1 w-full rounded border p-2"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            {can("schedules:generate") ? (
              <Button icon={<CalendarDays size={16} />} onClick={() => void generate()}>
                Gerar escala
              </Button>
            ) : (
              <p className="pb-2 text-xs text-slate-500">Seu perfil consulta as escalas, mas não gera novas.</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Última escala gerada · {unitName}
          </h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
            />
            Histórico
            {unitSchedules.length > 1 && (
              <span className="text-xs text-slate-400">({unitSchedules.length} escalas)</span>
            )}
          </label>
        </div>

        {latest && (
          <article className="rounded border border-slate-200 bg-white p-5 shadow-sm" key={latest.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {monthLabel(latest.month)} · Versão {text(latest.version)}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <Badge tone={statusTone[text(latest.status)] ?? "neutral"}>
                    {statusLabel(text(latest.status))}
                  </Badge>
                  <span>Gerada em {generatedAt(latest.createdAt)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {viewButton(latest)}
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download size={14} />}
                  onClick={() => void exportXlsx(latest)}
                >
                  Exportar .xlsx
                </Button>
                {statusActions(latest)}
              </div>
            </div>
            {metricsRow(latest)}
            {decisionNotes(latest)}
            {scheduleViewer(latest)}
          </article>
        )}
        {!latest && (
          <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
            {schedules.length
              ? `Nenhuma escala gerada para ${unitName} ainda.`
              : "Nenhuma escala gerada ainda."}
          </div>
        )}

        {showHistory && (
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Histórico de escalas · {unitName}
            </h2>
            {unitSchedules.length === 0 ? (
              <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Nenhuma escala no histórico desta unidade.
              </div>
            ) : (
              unitSchedules.map((s, index) => (
                <article
                  className="rounded border border-slate-200 bg-white p-4 shadow-sm"
                  key={s.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {monthLabel(s.month)} · Versão {text(s.version)}
                        <Badge tone={statusTone[text(s.status)] ?? "neutral"}>
                          {statusLabel(text(s.status))}
                        </Badge>
                        {index === 0 && <Badge tone="info">Atual</Badge>}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Unidade: {text(operations.find((o) => o.id === s.operationId)?.name ?? "—")}{" "}
                        · Gerada em {generatedAt(s.createdAt)} · Cobertura{" "}
                        {getMetrics(s)?.coverage ?? "—"}%
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* The current one is already open in the card above. */}
                      {index !== 0 && viewButton(s)}
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Download size={14} />}
                        onClick={() => void exportXlsx(s)}
                      >
                        Exportar .xlsx
                      </Button>
                      {statusActions(s)}
                      {can("schedules:archive") && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => void removeSchedule(s)}
                          disabled={deletingId === s.id}
                        >
                          {deletingId === s.id ? "Excluindo..." : "Excluir escala"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {index !== 0 && decisionNotes(s)}
                  {index !== 0 && scheduleViewer(s)}
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {cell && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded bg-white p-5 shadow-2xl"
            role="dialog"
            aria-label="Ajustar dia"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ajustar dia</h3>
              <button type="button" onClick={() => setCell(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {cell.employeeName} · {date(cell.date)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Hoje: <b>{cell.currentCode || "—"}</b>
              {ruleCode && ruleCode !== cell.currentCode ? (
                <>
                  {" "}
                  · Previsto pela regra: <b>{ruleCode}</b>
                </>
              ) : null}
            </p>

            {versionNotice(text(selected.status)) ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                {versionNotice(text(selected.status))}
              </p>
            ) : null}

            {leaveCell ? (
              <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                Este dia é de {scheduleCodeMap[cell.currentCode]?.label.toLowerCase()} e vem do cadastro de
                afastamentos. Para mudar, ajuste o afastamento do colaborador (as datas) e gere a escala de novo.
              </p>
            ) : (
              <>
                <label className="mt-4 block text-sm">
                  Código
                  <select
                    className="mt-1 w-full rounded border p-2"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                  >
                    {scheduleCodes
                      // afastamentos vêm do cadastro de afastamentos, não se lançam à mão aqui
                      .filter((c) => c.category !== "LEAVE")
                      .map((c) => (
                        <option value={c.code} key={c.code}>
                          {c.code} — {c.label}
                        </option>
                      ))}
                  </select>
                </label>
                {ruleCode && ruleCode !== editCode ? (
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
                    onClick={() => setEditCode(ruleCode)}
                  >
                    <RotateCcw size={12} aria-hidden /> Voltar ao previsto pela regra ({ruleCode})
                  </button>
                ) : null}
                <label className="mt-3 block text-sm">
                  Motivo{needReason ? " (obrigatório: foge do rodízio)" : " (opcional)"}
                  <input
                    className="mt-1 w-full rounded border p-2"
                    value={editReason}
                    maxLength={500}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Ex.: cobertura pontual combinada com o supervisor"
                  />
                </label>
              </>
            )}

            {preview?.problem ? (
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{preview.problem}</p>
            ) : null}
            <IssueList
              className="mt-3"
              groups={shownIssues}
              blockingHeading={(n) => `Impedem este ajuste (${n})`}
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCell(null)} disabled={saving}>
                Cancelar
              </Button>
              {!leaveCell && (
                <Button size="sm" onClick={() => void saveEdit()} disabled={!canSave}>
                  {saving ? "Salvando..." : versionNotice(text(selected.status)) ? "Salvar em nova versão" : "Salvar"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
