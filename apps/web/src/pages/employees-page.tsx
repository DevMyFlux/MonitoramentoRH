/* Dedicated Colaboradores screen: unit-first browsing, quick actions and a
   tabbed drawer (profissional / unidade e escala / horário / status /
   afastamentos) instead of the generic single-form CRUD in resource-page.tsx. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarPlus,
  Download,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX
} from "lucide-react";
import {
  DEFAULT_PARITY_REFERENCE_MONTH,
  currentMonthInSaoPaulo,
  describeShiftWeekdays,
  effectiveParity,
  isWeekdayOnlyShift,
  shiftHoursText,
  type ParityGroup
} from "@my-flux/shared";
import { Badge, Button, Drawer, Tabs } from "../components/ui";
import { usePermissions } from "../features/auth/session-store";
import { download, request, text, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";
import { LeaveEntry } from "../features/substitutions/leave-entry";

const demoOp = "55555555-5555-4555-8555-555555555555";

const statusOptions = ["ACTIVE", "SCHEDULED_ADMISSION", "ON_LEAVE", "VACATION", "INACTIVE", "TERMINATED"];
const parityOptions = ["ODD", "EVEN"];

/** Which of the two kinds of scale a person is on: 12x36 (Par/Ímpar) or comercial 5x2 (fixed weekdays). */
type ScaleType = "" | "ROTATION" | "FIVE_BY_TWO";
const scaleTypeOptions = [
  { value: "", label: "Selecione o tipo de escala" },
  { value: "ROTATION", label: "12x36 — Par/Ímpar (um dia trabalha, um dia folga)" },
  { value: "FIVE_BY_TWO", label: "Comercial 5x2 — segunda a sexta" }
];
type ShiftConfig = { weekdays?: number[]; startHour?: number; durationHours?: number };
const shiftConfigOf = (parameter: Row | undefined) => parameter?.configuration as ShiftConfig | undefined;

// "Código do turno" is a controlled list, not free text: the stored value is the
// shift parameter's own code (what the schedule engine looks up), shown with a
// readable label. The list comes from the unit's own shift parameters (see
// `rotationShifts` / `weekdayShifts` below); these two are only the fallback when a
// unit has none configured yet.
const shiftOptions = [
  { value: "DIURNO", label: "Diurno" },
  { value: "NOTURNO", label: "Noturno" }
];
const monthNamesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "2026-11" -> "novembro/2026" */
const monthLabelPt = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return `${monthNamesPt[(month ?? 1) - 1] ?? ""}/${year}`;
};
/** "2026-11-10..." -> "10/11/2026" (no timezone shift: it is a calendar date). */
const dateBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Today's calendar day (YYYY-MM-DD) in the user's timezone. */
const currentDay = () => new Date().toLocaleDateString("en-CA");
const parityWord = (group: ParityGroup) => (group === "ODD" ? "Ímpar" : "Par");
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  ACTIVE: "success",
  SCHEDULED_ADMISSION: "info",
  ON_LEAVE: "warning",
  VACATION: "warning",
  INACTIVE: "neutral",
  TERMINATED: "danger"
};

type EmployeeForm = {
  operationId: string;
  functionId: string;
  name: string;
  initials: string;
  council: string;
  identifier: string;
  admissionDate: string;
  /** Last day of work (YYYY-MM-DD) when a desligamento is planned; "" = none. */
  terminationDate: string;
  status: string;
  shift: string;
  scaleType: ScaleType;
  parity: string;
  /** Month (YYYY-MM) in which `parity` is true; Par/Ímpar inverts after every 31-day month. */
  parityReferenceMonth: string;
  team: string;
  notes: string;
};

const emptyForm = (operationId: string): EmployeeForm => ({
  operationId,
  functionId: "",
  name: "",
  initials: "",
  council: "",
  identifier: "",
  admissionDate: "",
  terminationDate: "",
  status: "ACTIVE",
  shift: "",
  scaleType: "",
  parity: "",
  parityReferenceMonth: currentMonthInSaoPaulo(),
  team: "",
  notes: ""
});

export function EmployeesPage() {
  // Só a interface: a API valida cada permissão no servidor. Aqui se evita oferecer o que o perfil não pode fazer.
  const { can } = usePermissions();
  const canManage = can("employees:manage");
  const canLeaves = can("leaves:manage");
  const canSubstitute = can("substitutions:manage");
  const guarded = (node: ReactNode) => (
    <fieldset disabled={!canManage} className="contents">
      {node}
    </fieldset>
  );
  const [operations, setOperations] = useState<Row[]>([]);
  const [functions, setFunctions] = useState<Row[]>([]);
  const [eventTypes, setEventTypes] = useState<Row[]>([]);
  const [parameters, setParameters] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [operationId, setOperationId] = useState(demoOp);
  const [query, setQuery] = useState("");
  const [showTerminated, setShowTerminated] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profissional");
  const [form, setForm] = useState<EmployeeForm>(() => emptyForm(demoOp));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [newLeaveId, setNewLeaveId] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [newFunctionOpen, setNewFunctionOpen] = useState(false);
  const [newFunctionName, setNewFunctionName] = useState("");
  const [newFunctionSaving, setNewFunctionSaving] = useState(false);
  const [newFunctionError, setNewFunctionError] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [ops, fns, types, params, emps, evts] = await Promise.all([
        request<Row[]>("/operations"),
        request<Row[]>("/functions"),
        request<Row[]>("/event-types"),
        request<Row[]>("/parameters"),
        request<Row[]>("/employees"),
        request<Row[]>("/calendar/events")
      ]);
      setOperations(ops);
      setFunctions(fns);
      setEventTypes(types);
      setParameters(params);
      setEmployees(emps);
      setEvents(evts);
      if (ops.length && !ops.some((o) => o.id === operationId)) setOperationId(ops[0]!.id);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Não foi possível carregar os colaboradores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return employees
      .filter((e) => e.operationId === operationId)
      .filter((e) => showTerminated || text(e.status) !== "TERMINATED")
      .filter((e) => !q || JSON.stringify(e).toLowerCase().includes(q));
  }, [employees, operationId, query, showTerminated]);

  const employeeEvents = useMemo(
    () => (editingId ? events.filter((e) => e.employeeId === editingId) : []),
    [events, editingId]
  );

  const matchedShiftParameter = useMemo(
    () =>
      parameters.find(
        (p) => p.operationId === form.operationId && text(p.code) === form.shift && form.shift
      ),
    [parameters, form.operationId, form.shift]
  );

  // Shifts of a unit, split by what they drive: 12x36 rotation (Diurno/Noturno — every weekday)
  // vs comercial 5x2 (Comercial/Administrativo — Mon-Fri only). Read from each shift's own
  // configuration, so a unit's own commercial shifts show up without any code change.
  function shiftsFor(unitId: string) {
    const unitShifts = parameters
      .filter((p) => p.operationId === unitId && text(p.kind) === "SHIFT" && text(p.status) === "ACTIVE")
      .sort((a, b) => (shiftConfigOf(a)?.startHour ?? 0) - (shiftConfigOf(b)?.startHour ?? 0));
    const weekday = unitShifts.filter((p) => isWeekdayOnlyShift(shiftConfigOf(p)));
    const rotation = unitShifts.filter((p) => !isWeekdayOnlyShift(shiftConfigOf(p)));
    return {
      weekdayOptions: weekday.map((p) => {
        const hours = shiftHoursText(shiftConfigOf(p));
        return { value: text(p.code), label: hours ? `${text(p.name)} · ${hours}` : text(p.name) };
      }),
      rotationOptions: rotation.length
        ? rotation.map((p) => ({ value: text(p.code), label: text(p.name) }))
        : shiftOptions
    };
  }
  const unitShifts = shiftsFor(form.operationId);

  function deriveScaleType(unitId: string, shift: string, parity: string): ScaleType {
    const parameter = parameters.find(
      (p) => p.operationId === unitId && text(p.code) === shift && text(p.kind) === "SHIFT"
    );
    if (shift && parameter) return isWeekdayOnlyShift(shiftConfigOf(parameter)) ? "FIVE_BY_TWO" : "ROTATION";
    return parity ? "ROTATION" : "";
  }

  function changeScaleType(next: ScaleType) {
    setForm((f) => {
      if (next === f.scaleType) return f;
      const { weekdayOptions } = shiftsFor(f.operationId);
      return {
        ...f,
        scaleType: next,
        // A 5x2 person has no Par/Ímpar; with a single commercial shift in the unit, pick it.
        shift: next === "FIVE_BY_TWO" && weekdayOptions.length === 1 ? weekdayOptions[0]!.value : "",
        parity: next === "FIVE_BY_TWO" ? "" : f.parity
      };
    });
  }

  // Funções belong to a unit (JobFunction.operationId) — offer only the ones of
  // the unit being edited, which also removes the same-name duplicates the
  // other unit's list used to add to the dropdown.
  const functionOptions = useMemo(
    () =>
      functions
        .filter(
          (fn) =>
            fn.operationId === form.operationId || fn.operationId == null || fn.id === form.functionId
        )
        .sort((a, b) => text(a.name).localeCompare(text(b.name), "pt-BR")),
    [functions, form.operationId, form.functionId]
  );

  // The shift parameter's own name when the unit has one ("Comercial"), so the
  // list never shows a raw upper-case code.
  function shiftLabel(row: Row): string {
    const code = text(row.shift ?? "");
    if (!code || code === "—") return "—";
    const parameter = parameters.find(
      (p) => p.operationId === row.operationId && text(p.code) === code
    );
    return parameter ? text(parameter.name) : titleCase(code);
  }

  function openCreate() {
    setFormError("");
    setEditingId(null);
    setForm(emptyForm(operationId));
    setActiveTab("profissional");
    resetNewFunction();
    setOpen(true);
  }

  function openEdit(row: Row) {
    setFormError("");
    setEditingId(row.id);
    setForm({
      operationId: text(row.operationId),
      functionId: text(row.functionId ?? ""),
      name: text(row.name),
      initials: text(row.initials ?? ""),
      council: text(row.council ?? ""),
      identifier: text(row.identifier),
      admissionDate: row.admissionDate ? String(row.admissionDate).slice(0, 10) : "",
      terminationDate: row.terminationDate ? String(row.terminationDate).slice(0, 10) : "",
      status: text(row.status),
      shift: text(row.shift ?? ""),
      scaleType: deriveScaleType(text(row.operationId), text(row.shift ?? ""), text(row.parity ?? "")),
      parity: text(row.parity ?? ""),
      parityReferenceMonth: text(row.parityReferenceMonth ?? "") || DEFAULT_PARITY_REFERENCE_MONTH,
      team: text(row.team ?? ""),
      notes: text(row.notes ?? "")
    });
    setActiveTab("profissional");
    resetNewFunction();
    setOpen(true);
  }

  function resetNewFunction() {
    setNewFunctionOpen(false);
    setNewFunctionName("");
    setNewFunctionError("");
  }

  async function createFunction() {
    const name = newFunctionName.trim();
    if (!name || newFunctionSaving) return;
    setNewFunctionError("");
    // Same name already in this unit: just select it instead of duplicating.
    const existing = functionOptions.find(
      (fn) => text(fn.name).trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setForm((f) => ({ ...f, functionId: existing.id }));
      resetNewFunction();
      return;
    }
    setNewFunctionSaving(true);
    try {
      const created = await request<Row>("/functions", "POST", {
        operationId: form.operationId,
        name
      });
      setFunctions((current) => [...current, created]);
      setForm((f) => ({ ...f, functionId: created.id }));
      resetNewFunction();
      setNotice(`Função "${name}" cadastrada nesta unidade.`);
    } catch (e) {
      setNewFunctionError(e instanceof Error ? e.message : "Não foi possível cadastrar a função.");
    } finally {
      setNewFunctionSaving(false);
    }
  }

  async function exportXlsx() {
    if (exporting) return;
    setExporting(true);
    try {
      // File name comes from the server (Content-Disposition), e.g. "Colaboradores - HMB.xlsx".
      await download(`/employees/export?operationId=${operationId}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível extrair o XLSX.");
    } finally {
      setExporting(false);
    }
  }

  // Not a native <form onSubmit>: this drawer also hosts the afastamento form
  // (Afastamentos tab) and HTML forms cannot be nested, so the "Salvar
  // alterações" button below calls this directly instead.
  async function saveEmployee() {
    if (saving) return;
    if (form.terminationDate && form.admissionDate && form.terminationDate < form.admissionDate) {
      setFormError("O desligamento não pode ser anterior à data de admissão.");
      setActiveTab("status");
      return;
    }
    // Anyone who enters the schedule needs a complete scale, otherwise the schedule would
    // leave them blank (no turno) or on duty every day (12x36 without Par/Ímpar).
    if (form.status === "ACTIVE" || form.status === "SCHEDULED_ADMISSION") {
      const message = !form.scaleType
        ? "Escolha o tipo de escala (12x36 Par/Ímpar ou Comercial 5x2)."
        : !form.shift
          ? form.scaleType === "FIVE_BY_TWO"
            ? "Escolha o horário comercial (5x2)."
            : "Escolha o turno (Diurno ou Noturno)."
          : form.scaleType === "ROTATION" && !form.parity
            ? "Escolha o rodízio: Ímpar ou Par."
            : "";
      if (message) {
        setFormError(message);
        setActiveTab("unidade");
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        operationId: form.operationId,
        functionId: form.functionId || null,
        name: form.name,
        initials: form.initials,
        council: form.council || null,
        identifier: form.identifier,
        admissionDate: form.admissionDate ? new Date(`${form.admissionDate}T00:00:00`).toISOString() : null,
        terminationDate: form.terminationDate ? new Date(`${form.terminationDate}T00:00:00`).toISOString() : null,
        status: form.status,
        shift: form.shift || null,
        parity: form.scaleType === "FIVE_BY_TWO" ? null : form.parity || null,
        parityReferenceMonth:
          form.scaleType !== "FIVE_BY_TWO" && form.parity ? form.parityReferenceMonth || null : null,
        team: form.team || null,
        notes: form.notes || null
      };
      const row = await request<Row>(
        editingId ? `/employees/${editingId}` : "/employees",
        editingId ? "PATCH" : "POST",
        payload
      );
      setEmployees((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? { ...item, ...row } : item))
          : [row, ...current]
      );
      setNotice(editingId ? "Colaborador atualizado." : "Colaborador cadastrado.");
      if (!editingId) {
        setEditingId(row.id);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar o colaborador.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTermination(row: Row) {
    const willTerminate = text(row.status) !== "TERMINATED";
    if (
      !window.confirm(
        willTerminate
          ? `Desligar "${text(row.name)}"? O cadastro e o histórico continuam disponíveis.`
          : `Reativar "${text(row.name)}"?`
      )
    )
      return;
    try {
      const nextStatus = willTerminate ? "TERMINATED" : "ACTIVE";
      const updated = await request<Row>(`/employees/${row.id}`, "PATCH", { status: nextStatus });
      setEmployees((current) =>
        current.map((item) => (item.id === row.id ? { ...item, ...updated } : item))
      );
      setNotice(willTerminate ? "Colaborador desligado." : "Colaborador reativado.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível alterar o status.");
    }
  }

  async function addLeave(e: FormEvent) {
    e.preventDefault();
    if (!editingId || leaveSaving) return;
    setLeaveSaving(true);
    setLeaveError("");
    try {
      const type = eventTypes.find((t) => t.id === leaveTypeId);
      const created = await request<Row>("/calendar/events", "POST", {
        typeId: leaveTypeId,
        employeeId: editingId,
        title: type ? text(type.name) : "Afastamento",
        // The engine and the sheets compare UTC calendar days. Building these from
        // the browser's local midnight (UTC-3 here) pushed the end into the next
        // UTC day and blocked one day too many.
        startsAt: `${leaveStart}T00:00:00.000Z`,
        endsAt: `${leaveEnd}T23:59:59.000Z`,
        allDay: true,
        notes: leaveNotes || null
      });
      setEvents((current) => [created, ...current]);
      setNewLeaveId(created.id);
      setLeaveTypeId("");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveNotes("");
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : "Não foi possível registrar o afastamento.");
    } finally {
      setLeaveSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            MY FLUX · Pessoas
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Colaboradores</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Cadastro único por unidade, com histórico, afastamentos e situação sempre
            preservados — nada é apagado ao desligar alguém.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
            Atualizar
          </Button>
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            onClick={() => void exportXlsx()}
            disabled={exporting || !operations.length}
          >
            {exporting ? "Gerando..." : "Extrair XLSX"}
          </Button>
          {canManage && (
            <Button icon={<Plus size={16} />} onClick={openCreate} disabled={!operations.length}>
              Novo colaborador
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          Unidade
          <select
            className="mt-1 block w-56 rounded border p-2"
            value={operationId}
            onChange={(e) => setOperationId(e.target.value)}
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
        <label className="flex-1 text-sm">
          Buscar
          <div className="mt-1 flex items-center gap-2 rounded border border-slate-200 px-3">
            <Search size={15} className="text-slate-400" />
            <input
              className="h-10 w-full min-w-0 bg-transparent text-sm outline-none"
              placeholder="Nome, iniciais, matrícula, função..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showTerminated}
            onChange={(e) => setShowTerminated(e.target.checked)}
          />
          Mostrar desligados
        </label>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Carregando colaboradores...</div>
        ) : loadError ? (
          <div className="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">
              {employees.some((e) => e.operationId === operationId)
                ? "Nenhum colaborador para esta busca."
                : "Nenhum colaborador cadastrado nesta unidade ainda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Colaborador</th>
                  <th className="whitespace-nowrap px-4 py-3">Matrícula</th>
                  <th className="whitespace-nowrap px-4 py-3">Função</th>
                  <th className="whitespace-nowrap px-4 py-3">Turno</th>
                  <th className="whitespace-nowrap px-4 py-3">Rodízio</th>
                  <th className="whitespace-nowrap px-4 py-3">Situação</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => (
                  <tr className="hover:bg-slate-50" key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="font-medium text-slate-800">{text(row.name)}</div>
                      <div className="text-xs text-slate-500">{text(row.initials ?? "—")}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{text(row.identifier)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {text((row.function as Row | undefined)?.name ?? "—")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{shiftLabel(row)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.parity ? (
                        <span
                          title={`Cadastrado como ${labels[text(row.parity)] ?? text(row.parity)} em ${monthLabelPt(text(row.parityReferenceMonth ?? "") || DEFAULT_PARITY_REFERENCE_MONTH)}`}
                        >
                          {parityWord(
                            effectiveParity(
                              text(row.parity) as ParityGroup,
                              text(row.parityReferenceMonth ?? "") || null,
                              currentMonthInSaoPaulo()
                            )
                          )}
                        </span>
                      ) : deriveScaleType(text(row.operationId), text(row.shift ?? ""), "") === "FIVE_BY_TWO" ? (
                        <span title="Escala comercial: trabalha de segunda a sexta, sem Par/Ímpar">5x2</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={statusTone[text(row.status)] ?? "neutral"}>
                        {labels[text(row.status)] ?? text(row.status)}
                      </Badge>
                      {Boolean(row.terminationDate) && text(row.status) !== "TERMINATED" && (
                        <div className="mt-1 text-xs text-amber-700">
                          Desliga em {dateBr(String(row.terminationDate))}
                          {String(row.terminationDate).slice(0, 10) < currentDay() ? " (já passou — marque Desligar)" : ""}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          {canManage ? "Editar" : "Ver"}
                        </Button>
                        {canManage && (
                          <Button
                            size="sm"
                            variant={text(row.status) === "TERMINATED" ? "secondary" : "danger"}
                            icon={
                              text(row.status) === "TERMINATED" ? (
                                <UserCheck size={14} />
                              ) : (
                                <UserX size={14} />
                              )
                            }
                            onClick={() => void toggleTermination(row)}
                          >
                            {text(row.status) === "TERMINATED" ? "Reativar" : "Desligar"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar colaborador" : "Novo colaborador"}
      >
        <div className="space-y-4">
          <Tabs
            activeId={activeTab}
            onChange={setActiveTab}
            items={[
              {
                id: "profissional",
                label: "Profissional",
                content: guarded(
                  <div className="space-y-3">
                    <TextField
                      label="Nome"
                      value={form.name}
                      onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label="Iniciais"
                        value={form.initials}
                        onChange={(v) => setForm((f) => ({ ...f, initials: v }))}
                        required
                        maxLength={12}
                      />
                      <TextField
                        label="Matrícula"
                        value={form.identifier}
                        onChange={(v) => setForm((f) => ({ ...f, identifier: v }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <SelectField
                        label="Função"
                        value={form.functionId}
                        onChange={(v) => setForm((f) => ({ ...f, functionId: v }))}
                        options={[
                          { value: "", label: "Sem função definida" },
                          ...functionOptions.map((fn) => ({ value: fn.id, label: text(fn.name) }))
                        ]}
                      />
                      {newFunctionOpen ? (
                        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                          <TextField
                            label="Nova função"
                            helper="Fica cadastrada nesta unidade e já é selecionada para o colaborador."
                            value={newFunctionName}
                            onChange={setNewFunctionName}
                          />
                          {newFunctionError && (
                            <p className="text-xs text-red-700">{newFunctionError}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => void createFunction()}
                              disabled={newFunctionSaving || !newFunctionName.trim()}
                            >
                              {newFunctionSaving ? "Cadastrando..." : "Cadastrar função"}
                            </Button>
                            <Button size="sm" type="button" variant="ghost" onClick={resetNewFunction}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          icon={<Plus size={14} />}
                          onClick={() => setNewFunctionOpen(true)}
                        >
                          Nova função
                        </Button>
                      )}
                    </div>
                    <TextField
                      label="Conselho profissional (opcional)"
                      helper="Ex.: CREA, CRM — quando a função exigir registro."
                      value={form.council}
                      onChange={(v) => setForm((f) => ({ ...f, council: v }))}
                    />
                  </div>
                )
              },
              {
                id: "unidade",
                label: "Unidade e escala",
                content: guarded(
                  <div className="space-y-3">
                    <SelectField
                      label="Unidade"
                      value={form.operationId}
                      onChange={(v) => setForm((f) => ({ ...f, operationId: v, shift: "" }))}
                      options={operations.map((o) => ({ value: o.id, label: text(o.name) }))}
                      required
                    />
                    <SelectField
                      label="Tipo de escala"
                      value={form.scaleType}
                      onChange={(v) => changeScaleType(v as ScaleType)}
                      options={scaleTypeOptions}
                      required
                    />
                    {form.scaleType === "ROTATION" && (
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField
                          label="Turno"
                          value={form.shift}
                          onChange={(v) => setForm((f) => ({ ...f, shift: v }))}
                          options={[
                            { value: "", label: "Selecione o turno" },
                            ...unitShifts.rotationOptions,
                            // A turno stored under another code is kept as-is so opening
                            // someone's cadastro never silently rewrites it.
                            ...(form.shift && !unitShifts.rotationOptions.some((o) => o.value === form.shift)
                              ? [
                                  {
                                    value: form.shift,
                                    label: `${matchedShiftParameter ? text(matchedShiftParameter.name) : titleCase(form.shift)} (já cadastrado)`
                                  }
                                ]
                              : [])
                          ]}
                          required
                        />
                        <SelectField
                          label="Rodízio"
                          value={form.parity}
                          onChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              parity: v,
                              // A new Par/Ímpar choice is true for the month it is made in.
                              parityReferenceMonth: currentMonthInSaoPaulo()
                            }))
                          }
                          options={[
                            { value: "", label: "Selecione o rodízio" },
                            ...parityOptions.map((p) => ({ value: p, label: labels[p] ?? p }))
                          ]}
                          required
                        />
                      </div>
                    )}
                    {form.scaleType === "FIVE_BY_TWO" &&
                      (unitShifts.weekdayOptions.length ? (
                        <>
                          <SelectField
                            label="Horário comercial"
                            value={form.shift}
                            onChange={(v) => setForm((f) => ({ ...f, shift: v }))}
                            options={[
                              { value: "", label: "Selecione o horário" },
                              ...unitShifts.weekdayOptions
                            ]}
                            required
                          />
                          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                            {matchedShiftParameter && isWeekdayOnlyShift(shiftConfigOf(matchedShiftParameter)) ? (
                              <>
                                Trabalha de <b>{describeShiftWeekdays(shiftConfigOf(matchedShiftParameter))}</b>
                                {shiftHoursText(shiftConfigOf(matchedShiftParameter))
                                  ? `, das ${shiftHoursText(shiftConfigOf(matchedShiftParameter)).replace("–", " às ")}`
                                  : ""}
                                . Sábados e domingos aparecem como folga (F) na escala.
                              </>
                            ) : (
                              <>Escolha o horário: a escala mostrará o trabalho de segunda a sexta.</>
                            )}{" "}
                            Não há Par/Ímpar para a escala comercial.
                          </div>
                        </>
                      ) : (
                        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          Esta unidade ainda não tem um horário comercial (5x2) cadastrado em Parâmetros.
                        </div>
                      ))}
                    {form.scaleType === "ROTATION" && form.parity && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                        <TextField
                          label="Rodízio válido para o mês de"
                          type="month"
                          value={form.parityReferenceMonth}
                          onChange={(v) => setForm((f) => ({ ...f, parityReferenceMonth: v }))}
                        />
                        {form.parityReferenceMonth && (
                          <p className="mt-2 text-xs text-slate-600">
                            Em <b>{monthLabelPt(currentMonthInSaoPaulo())}</b> esta pessoa segue a escala{" "}
                            <b>
                              {parityWord(
                                effectiveParity(
                                  form.parity as ParityGroup,
                                  form.parityReferenceMonth,
                                  currentMonthInSaoPaulo()
                                )
                              )}
                            </b>
                            . Depois de um mês de 31 dias a escala inverte (Ímpar ↔ Par); depois de um mês de 30
                            dias ela se mantém. O sistema aplica isso sozinho ao gerar cada mês.
                          </p>
                        )}
                      </div>
                    )}
                    <TextField
                      label="Equipe (opcional)"
                      value={form.team}
                      onChange={(v) => setForm((f) => ({ ...f, team: v }))}
                    />
                  </div>
                )
              },
              {
                id: "horario",
                label: "Horário",
                content: guarded(
                  <div className="space-y-2 text-sm">
                    {form.shift ? (
                      matchedShiftParameter ? (
                        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                          Turno <strong>{text(matchedShiftParameter.name)}</strong> configurado
                          nesta unidade.
                          <br />
                          {isWeekdayOnlyShift(shiftConfigOf(matchedShiftParameter))
                            ? `Escala comercial 5x2: ${describeShiftWeekdays(shiftConfigOf(matchedShiftParameter))}, ${shiftHoursText(shiftConfigOf(matchedShiftParameter))}.`
                            : `Escala 12x36: ${shiftHoursText(shiftConfigOf(matchedShiftParameter))}, um dia de trabalho e um de folga (Par/Ímpar).`}
                        </div>
                      ) : (
                        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
                          Esta unidade ainda não tem o turno <strong>{titleCase(form.shift)}</strong>{" "}
                          configurado em Parâmetros — a escala não reconhecerá o horário dele.
                        </div>
                      )
                    ) : (
                      <p className="text-slate-500">
                        Selecione o turno na aba "Unidade e escala" para ver o horário
                        configurado.
                      </p>
                    )}
                  </div>
                )
              },
              {
                id: "status",
                label: "Status",
                content: guarded(
                  <div className="space-y-3">
                    <SelectField
                      label="Situação"
                      value={form.status}
                      onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                      options={statusOptions.map((s) => ({ value: s, label: labels[s] ?? s }))}
                      required
                    />
                    <TextField
                      label="Admissão"
                      type="date"
                      value={form.admissionDate}
                      onChange={(v) => setForm((f) => ({ ...f, admissionDate: v }))}
                    />
                    <TextField
                      label="Desligamento programado (último dia de trabalho)"
                      type="date"
                      value={form.terminationDate}
                      onChange={(v) => setForm((f) => ({ ...f, terminationDate: v }))}
                      helper="Até esta data a pessoa aparece normalmente na escala; depois, os dias ficam em branco. Deixe vazio se não há desligamento previsto."
                    />
                    <label className="block text-sm">
                      Observações
                      <textarea
                        className="mt-1 min-h-20 w-full rounded border border-slate-200 p-2 text-sm"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </label>
                  </div>
                )
              },
              {
                id: "afastamentos",
                label: "Afastamentos",
                content: !editingId ? (
                  <p className="text-sm text-slate-500">
                    Salve o colaborador primeiro para registrar férias, licenças ou atestados.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {canLeaves ? (
                    <form onSubmit={addLeave} className="space-y-2 rounded border border-slate-200 p-3">
                      <SelectField
                        label="Tipo"
                        value={leaveTypeId}
                        onChange={setLeaveTypeId}
                        options={[
                          { value: "", label: "Selecione..." },
                          ...eventTypes.map((t) => ({ value: t.id, label: text(t.name) }))
                        ]}
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <TextField label="Início" type="date" value={leaveStart} onChange={setLeaveStart} required />
                        <TextField label="Fim" type="date" value={leaveEnd} onChange={setLeaveEnd} required />
                      </div>
                      <TextField label="Observação (opcional)" value={leaveNotes} onChange={setLeaveNotes} />
                      {leaveError && <p className="text-xs text-red-700">{leaveError}</p>}
                      <Button size="sm" type="submit" disabled={leaveSaving} icon={<CalendarPlus size={14} />}>
                        {leaveSaving ? "Registrando..." : "Registrar afastamento"}
                      </Button>
                    </form>
                    ) : (
                      <p className="text-xs text-slate-500">Seu perfil consulta os afastamentos, mas não registra novos.</p>
                    )}
                    <div className="space-y-2">
                      {employeeEvents.length ? (
                        employeeEvents.map((event) => (
                          <LeaveEntry
                            key={event.id}
                            event={event}
                            titular={employees.find((e) => e.id === editingId)}
                            employees={employees}
                            canLeaves={canLeaves}
                            canSubstitute={canSubstitute}
                            autoOpenSubstitution={event.id === newLeaveId}
                            onUpdated={(row) =>
                              setEvents((current) =>
                                current.map((item) => (item.id === row.id ? { ...item, ...row } : item))
                              )
                            }
                            onRemoved={(id) => setEvents((current) => current.filter((item) => item.id !== id))}
                            notify={setNotice}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Nenhum afastamento registrado.</p>
                      )}
                    </div>
                  </div>
                )
              }
            ]}
          />
          {formError && (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Fechar
            </Button>
            {canManage && (
              <Button type="button" onClick={() => void saveEmployee()} disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar colaborador"}
              </Button>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  helper,
  maxLength
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  helper?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <input
        className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {helper && <span className="mt-1 block text-xs text-slate-500">{helper}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <select
        className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
