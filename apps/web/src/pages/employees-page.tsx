/* Dedicated Colaboradores screen: unit-first browsing, quick actions and a
   tabbed drawer (profissional / unidade e escala / horário / status /
   afastamentos) instead of the generic single-form CRUD in resource-page.tsx. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Clock,
  Download,
  Moon,
  Palmtree,
  Plus,
  RefreshCw,
  Search,
  Sun,
  UserCheck,
  UserPlus,
  UserX,
  Users
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
import {
  Avatar,
  AvisoTemporario,
  Badge,
  BotaoEstrela,
  Button,
  CampoDeSelecao,
  CampoDeTexto,
  CartaoDePerfil,
  CartaoSpotlight,
  Contador,
  Dica,
  Drawer,
  Etapas,
  Interruptor,
  LinhaDoTempo,
  PastaDeDocumentos,
  Skeleton,
  Tabs,
  TituloDePagina,
  type DocumentoDaPasta,
  type MomentoDaLinha,
  type TomDoAvatar
} from "../components/ui";
import { cn } from "../lib/cn";
import { download, request, text, date, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";

const demoOp = "55555555-5555-4555-8555-555555555555";

const statusOptions = [
  "ACTIVE",
  "SCHEDULED_ADMISSION",
  "ON_LEAVE",
  "VACATION",
  "INACTIVE",
  "TERMINATED"
];
const parityOptions = ["ODD", "EVEN"];

/** Which of the two kinds of scale a person is on: 12x36 (Par/Ímpar) or comercial 5x2 (fixed weekdays). */
type ScaleType = "" | "ROTATION" | "FIVE_BY_TWO";
const scaleTypeOptions = [
  { value: "", label: "Selecione o tipo de escala" },
  { value: "ROTATION", label: "12x36 — Par/Ímpar (um dia trabalha, um dia folga)" },
  { value: "FIVE_BY_TWO", label: "Comercial 5x2 — segunda a sexta" }
];
type ShiftConfig = { weekdays?: number[]; startHour?: number; durationHours?: number };
const shiftConfigOf = (parameter: Row | undefined) =>
  parameter?.configuration as ShiftConfig | undefined;

// "Código do turno" is a controlled list, not free text: the stored value is the
// shift parameter's own code (what the schedule engine looks up), shown with a
// readable label. The list comes from the unit's own shift parameters (see
// `rotationShifts` / `weekdayShifts` below); these two are only the fallback when a
// unit has none configured yet.
const shiftOptions = [
  { value: "DIURNO", label: "Diurno" },
  { value: "NOTURNO", label: "Noturno" }
];
const monthNamesPt = [
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

// ---- Apresentação da lista (só visual: nenhuma regra de dados mora aqui) -------------------------

/** Três pontos que sobem em sequência: o "carregando" do botão Atualizar. */
function Carregador() {
  return (
    <span className="carregador" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

const tomDoAvatar = (row: Row): TomDoAvatar => {
  const status = text(row.status);
  if (status === "ACTIVE") return "ativo";
  if (status === "ON_LEAVE" || status === "VACATION") return "atencao";
  if (status === "TERMINATED") return "perigo";
  return "neutro";
};

/** ☀ Diurno · ☾ Noturno · relógio para os demais turnos (Comercial, Administrativo...). */
function PilulaDeTurno({ rotulo }: { rotulo: string }) {
  if (!rotulo || rotulo === "—") return <span className="text-mf-texto-3">—</span>;
  const normal = rotulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const noturno = normal.includes("noturn");
  const diurno = normal.includes("diurn") || normal.includes("manha");
  const Icone = noturno ? Moon : diurno ? Sun : Clock;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        noturno
          ? "bg-mf-azul-suave text-mf-azul ring-mf-azul/20"
          : "bg-mf-realce-suave text-mf-primaria ring-mf-brilho/25"
      )}
    >
      <Icone size={13} aria-hidden="true" />
      {rotulo}
    </span>
  );
}

/** A situação: o status ativo ganha um ponto que pulsa; os demais seguem o selo de sempre. */
function Situacao({ row }: { row: Row }) {
  const status = text(row.status);
  return (
    <span className="inline-flex items-center gap-2">
      {status === "ACTIVE" ? <span className="ponto-vivo" aria-hidden="true" /> : null}
      <Badge tone={statusTone[status] ?? "neutral"}>{labels[status] ?? status}</Badge>
    </span>
  );
}

function AvisoDeDesligamento({ row }: { row: Row }) {
  if (!row.terminationDate || text(row.status) === "TERMINATED") return null;
  const dia = String(row.terminationDate);
  return (
    <div className="mt-1 text-xs text-mf-alerta">
      Desliga em {dateBr(dia)}
      {dia.slice(0, 10) < currentDay() ? " (já passou — marque Desligar)" : ""}
    </div>
  );
}

/** Desligar (vermelho) ou Reativar. No celular o alvo é grande; ele nunca fica escondido. */
function AcaoDeDesligar({
  row,
  onToggle,
  grande = false
}: {
  row: Row;
  onToggle: () => void;
  grande?: boolean;
}) {
  const desligado = text(row.status) === "TERMINATED";
  return (
    <Button
      size={grande ? "md" : "sm"}
      variant={desligado ? "secondary" : "danger"}
      icon={desligado ? <UserCheck size={14} /> : <UserX size={14} />}
      onClick={onToggle}
    >
      {desligado ? "Reativar" : "Desligar"}
    </Button>
  );
}

export function EmployeesPage() {
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

  const [stepNotice, setStepNotice] = useState("");
  const [docs, setDocs] = useState<Row[] | null>(null);
  const [docsErro, setDocsErro] = useState("");

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

  // A aba Documentos lê (só leitura) os documentos da pessoa quando é aberta; trocar de pessoa limpa.
  useEffect(() => {
    setDocs(null);
    setDocsErro("");
  }, [editingId, open]);
  useEffect(() => {
    if (!open || !editingId || activeTab !== "documentos" || docs !== null || docsErro) return;
    let vivo = true;
    request<Row[]>(`/documents?employeeId=${editingId}`)
      .then((lista) => vivo && setDocs(lista))
      .catch(
        (e) =>
          vivo &&
          setDocsErro(e instanceof Error ? e.message : "Não foi possível carregar os documentos.")
      );
    return () => {
      vivo = false;
    };
  }, [open, editingId, activeTab, docs, docsErro]);
  useEffect(() => {
    setStepNotice("");
  }, [open]);

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
      .filter(
        (p) => p.operationId === unitId && text(p.kind) === "SHIFT" && text(p.status) === "ACTIVE"
      )
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
    if (shift && parameter)
      return isWeekdayOnlyShift(shiftConfigOf(parameter)) ? "FIVE_BY_TWO" : "ROTATION";
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
        shift:
          next === "FIVE_BY_TWO" && weekdayOptions.length === 1 ? weekdayOptions[0]!.value : "",
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
            fn.operationId === form.operationId ||
            fn.operationId == null ||
            fn.id === form.functionId
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
      scaleType: deriveScaleType(
        text(row.operationId),
        text(row.shift ?? ""),
        text(row.parity ?? "")
      ),
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
        admissionDate: form.admissionDate
          ? new Date(`${form.admissionDate}T00:00:00`).toISOString()
          : null,
        terminationDate: form.terminationDate
          ? new Date(`${form.terminationDate}T00:00:00`).toISOString()
          : null,
        status: form.status,
        shift: form.shift || null,
        parity: form.scaleType === "FIVE_BY_TWO" ? null : form.parity || null,
        parityReferenceMonth:
          form.scaleType !== "FIVE_BY_TWO" && form.parity
            ? form.parityReferenceMonth || null
            : null,
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
      setLeaveTypeId("");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveNotes("");
    } catch (err) {
      setLeaveError(
        err instanceof Error ? err.message : "Não foi possível registrar o afastamento."
      );
    } finally {
      setLeaveSaving(false);
    }
  }

  async function removeLeave(id: string) {
    if (!window.confirm("Remover este afastamento?")) return;
    try {
      await request<Row>(`/calendar/events/${id}`, "DELETE");
      setEvents((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível remover o afastamento.");
    }
  }

  const hoje = currentDay();
  const momentosDoColaborador: MomentoDaLinha[] = [...employeeEvents]
    .sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)))
    .map((event) => {
      const inicio = String(event.startsAt).slice(0, 10);
      const fim = String(event.endsAt).slice(0, 10);
      return {
        id: event.id,
        titulo: text(event.title),
        inicio: date(event.startsAt),
        fim: date(event.endsAt),
        fase: inicio > hoje ? "programado" : fim < hoje ? "encerrado" : "em-curso",
        duracaoEmDias: Math.max(
          1,
          Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1
        )
      };
    });

  const documentosDaPasta: DocumentoDaPasta[] = (docs ?? []).map((d) => {
    const exigencia = (d.requirement ?? {}) as Row;
    const vencimento = d.expiresAt ? String(d.expiresAt).slice(0, 10) : null;
    const aviso = Number(exigencia.warningDays ?? 30);
    const limite = new Date(Date.now() + aviso * 86_400_000).toLocaleDateString("en-CA");
    const situacao: DocumentoDaPasta["situacao"] = !vencimento
      ? "sem-validade"
      : vencimento < hoje
        ? "vencido"
        : vencimento <= limite
          ? "vence-logo"
          : "em-dia";
    const nome = text(exigencia.name ?? "Documento");
    const codigo = text(exigencia.code ?? "—");
    return {
      id: d.id,
      nome,
      codigo,
      validade: vencimento,
      situacao,
      critico: /(^|[^A-Za-z])(ASO|NR[-\s]?\d*)([^A-Za-z]|$)/i.test(`${codigo} ${nome}`),
      detalhe: vencimento
        ? situacao === "vencido"
          ? `venceu em ${dateBr(vencimento)}`
          : `válido até ${dateBr(vencimento)}`
        : "sem data de validade"
    };
  });

  const abas = [
    {
      id: "profissional",
      label: "Profissional",
      content: (
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
                {newFunctionError && <p className="text-xs text-red-700">{newFunctionError}</p>}
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
      content: (
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
                  {matchedShiftParameter &&
                  isWeekdayOnlyShift(shiftConfigOf(matchedShiftParameter)) ? (
                    <>
                      Trabalha de{" "}
                      <b>{describeShiftWeekdays(shiftConfigOf(matchedShiftParameter))}</b>
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
                  . Depois de um mês de 31 dias a escala inverte (Ímpar ↔ Par); depois de um mês de
                  30 dias ela se mantém. O sistema aplica isso sozinho ao gerar cada mês.
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
      content: (
        <div className="space-y-2 text-sm">
          {form.shift ? (
            matchedShiftParameter ? (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                Turno <strong>{text(matchedShiftParameter.name)}</strong> configurado nesta unidade.
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
              Selecione o turno na aba "Unidade e escala" para ver o horário configurado.
            </p>
          )}
        </div>
      )
    },
    {
      id: "status",
      label: "Status",
      content: (
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
              className="mt-1 min-h-24 w-full rounded-xl border border-mf-linha bg-white p-3 text-sm outline-none transition-[border-color,box-shadow] hover:border-mf-texto-3/50 focus:border-mf-brilho focus:shadow-[0_0_0_3px_rgb(var(--mf-brilho)/0.22)]"
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
              <TextField
                label="Início"
                type="date"
                value={leaveStart}
                onChange={setLeaveStart}
                required
              />
              <TextField label="Fim" type="date" value={leaveEnd} onChange={setLeaveEnd} required />
            </div>
            <TextField label="Observação (opcional)" value={leaveNotes} onChange={setLeaveNotes} />
            {leaveError && <p className="text-xs text-red-700">{leaveError}</p>}
            <Button
              size="sm"
              type="submit"
              disabled={leaveSaving}
              icon={<CalendarPlus size={14} />}
            >
              {leaveSaving ? "Registrando..." : "Registrar afastamento"}
            </Button>
          </form>
          <LinhaDoTempo momentos={momentosDoColaborador} aoRemover={(id) => void removeLeave(id)} />
        </div>
      )
    },
    {
      id: "documentos",
      label: "Documentos",
      content: !editingId ? (
        <p className="text-sm text-mf-texto-2">
          Salve o colaborador primeiro: depois, os documentos dele aparecem aqui.
        </p>
      ) : docsErro ? (
        <div
          role="alert"
          className="rounded-xl border border-mf-perigo/20 bg-mf-perigo-suave p-3 text-sm text-mf-perigo"
        >
          {docsErro}
        </div>
      ) : docs === null ? (
        <div role="status" aria-label="Carregando documentos" className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <PastaDeDocumentos documentos={documentosDaPasta} />
      )
    }
  ];

  // ---- Cadastro: etapas, linha do tempo e pasta de documentos (só apresentação) ------------------
  const idsDasEtapas = ["profissional", "unidade", "status"];
  const etapaAtual =
    activeTab === "profissional" ? 0 : activeTab === "unidade" || activeTab === "horario" ? 1 : 2;
  const passosDoCadastro = [
    {
      id: "profissional",
      rotulo: "Dados",
      conteudo: abas[0]!.content,
      validar: () =>
        !form.name.trim() || !form.initials.trim() || !form.identifier.trim()
          ? "Preencha nome, iniciais e matrícula para continuar."
          : null
    },
    {
      id: "unidade",
      rotulo: "Contrato",
      conteudo: (
        <div className="space-y-4">
          {abas[1]!.content}
          {abas[2]!.content}
        </div>
      ),
      // As mesmas exigências de escala do salvamento: quem entra na escala precisa dela completa.
      validar: () => {
        if (form.status !== "ACTIVE" && form.status !== "SCHEDULED_ADMISSION") return null;
        if (!form.scaleType) return "Escolha o tipo de escala (12x36 Par/Ímpar ou Comercial 5x2).";
        if (!form.shift)
          return form.scaleType === "FIVE_BY_TWO"
            ? "Escolha o horário comercial (5x2)."
            : "Escolha o turno (Diurno ou Noturno).";
        if (form.scaleType === "ROTATION" && !form.parity)
          return "Escolha o rodízio: Ímpar ou Par.";
        return null;
      }
    },
    { id: "status", rotulo: "Situação", conteudo: abas[3]!.content }
  ];

  // Os quatro indicadores do topo: a unidade escolhida, sem a busca e sem o filtro de desligados.
  const daUnidade = employees.filter((e) => e.operationId === operationId);
  const contar = (teste: (e: Row) => boolean) => daUnidade.filter(teste).length;
  const indicadores = [
    {
      rotulo: "Ativos",
      valor: contar((e) => text(e.status) === "ACTIVE"),
      dica: "Trabalhando normalmente",
      icone: Users,
      tom: "verde"
    },
    {
      rotulo: "Afastados e férias",
      valor: contar((e) => ["ON_LEAVE", "VACATION"].includes(text(e.status))),
      dica: "Fora da escala por ora",
      icone: Palmtree,
      tom: "alerta"
    },
    {
      rotulo: "Admissões agendadas",
      valor: contar((e) => text(e.status) === "SCHEDULED_ADMISSION"),
      dica: "Começam em breve",
      icone: UserPlus,
      tom: "azul"
    },
    {
      rotulo: "Desligamentos previstos",
      valor: contar((e) => Boolean(e.terminationDate) && text(e.status) !== "TERMINATED"),
      dica: "Com data de saída marcada",
      icone: CalendarClock,
      tom: "alerta"
    }
  ];
  const ativa = (row: Row) => open && editingId === row.id;

  /** Rodízio: Par/Ímpar (com a dica de quando foi cadastrado), 5x2 comercial ou traço. */
  function rodizio(row: Row) {
    if (row.parity) {
      return (
        <Dica
          texto={`Cadastrado como ${labels[text(row.parity)] ?? text(row.parity)} em ${monthLabelPt(text(row.parityReferenceMonth ?? "") || DEFAULT_PARITY_REFERENCE_MONTH)}`}
        >
          {parityWord(
            effectiveParity(
              text(row.parity) as ParityGroup,
              text(row.parityReferenceMonth ?? "") || null,
              currentMonthInSaoPaulo()
            )
          )}
        </Dica>
      );
    }
    if (deriveScaleType(text(row.operationId), text(row.shift ?? ""), "") === "FIVE_BY_TWO") {
      return <Dica texto="Escala comercial: trabalha de segunda a sexta, sem Par/Ímpar">5x2</Dica>;
    }
    return "—";
  }

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Pessoas"
        titulo="Colaboradores"
        descricao="Cadastro único por unidade, com histórico, afastamentos e situação sempre preservados — nada é apagado ao desligar alguém."
        acoes={
          <>
            <Button
              variant="ghost"
              icon={loading ? <Carregador /> : <RefreshCw size={16} />}
              onClick={() => void load()}
              disabled={loading}
              aria-busy={loading}
            >
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
            <BotaoEstrela
              envoltorio="order-first col-span-2 sm:order-none sm:col-span-1"
              className="w-full"
              icon={<Plus size={16} />}
              onClick={openCreate}
              disabled={!operations.length}
            >
              Novo colaborador
            </BotaoEstrela>
          </>
        }
      />

      <AvisoTemporario mensagem={notice} aoFechar={() => setNotice("")} />

      <section aria-label="Resumo da unidade" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((i) => (
          <CartaoSpotlight key={i.rotulo} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-mf-texto-2 sm:text-sm">{i.rotulo}</p>
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  i.tom === "alerta"
                    ? "bg-mf-alerta-suave text-mf-alerta"
                    : i.tom === "azul"
                      ? "bg-mf-azul-suave text-mf-azul"
                      : "bg-mf-realce-suave text-mf-primaria"
                )}
              >
                <i.icone size={16} />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold leading-none tracking-tight text-mf-tinta sm:text-4xl">
              {loading ? "—" : <Contador valor={i.valor} formatar={(n) => String(Math.round(n))} />}
            </p>
            <p className="mt-2 text-xs text-mf-texto-3">{i.dica}</p>
          </CartaoSpotlight>
        ))}
      </section>

      <div className="vidro flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-white/70 p-4 shadow-sm ring-1 ring-mf-linha/60">
        <label className="w-full text-sm font-medium text-mf-texto sm:w-56">
          Unidade
          <select
            className="mt-1 block h-11 w-full rounded-xl border border-mf-linha bg-white/80 px-3 text-sm font-normal"
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
        <label className="min-w-0 flex-1 basis-56 text-sm font-medium text-mf-texto">
          Buscar
          <div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-mf-linha bg-white/80 px-3 focus-within:ring-[3px] focus-within:ring-mf-azul">
            <Search size={15} className="shrink-0 text-mf-texto-3" aria-hidden="true" />
            <input
              className="h-11 w-full min-w-0 bg-transparent text-sm font-normal outline-none"
              placeholder="Nome, iniciais, matrícula, função..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </label>
        <Interruptor
          rotulo="Mostrar desligados"
          checked={showTerminated}
          onChange={(e) => setShowTerminated(e.target.checked)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-mf-linha bg-mf-cartao shadow-[0_1px_2px_rgb(var(--mf-tinta)/0.04)]">
        {loading ? (
          <div role="status" aria-label="Carregando colaboradores" className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="hidden h-6 w-20 sm:block" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="m-4 rounded-xl border border-mf-perigo/20 bg-mf-perigo-suave p-4 text-sm text-mf-perigo"
          >
            <p className="font-medium">Não foi possível carregar os colaboradores.</p>
            <p className="mt-1">{loadError}</p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mf-realce-suave text-mf-primaria"
            >
              <Users size={22} />
            </span>
            {employees.some((e) => e.operationId === operationId) ? (
              <>
                <p className="mt-4 font-display text-lg font-bold text-mf-tinta">
                  Ninguém encontrado com essa busca
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-mf-texto-2">
                  Confira a grafia, tente a matrícula ou ative “Mostrar desligados”.
                </p>
                {query ? (
                  <Button className="mt-4" variant="secondary" onClick={() => setQuery("")}>
                    Limpar busca
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-4 font-display text-lg font-bold text-mf-tinta">
                  Ainda não tem ninguém por aqui
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-mf-texto-2">
                  Cadastre o primeiro colaborador desta unidade para ele entrar na escala.
                </p>
                <Button
                  className="mt-4"
                  icon={<Plus size={16} />}
                  onClick={openCreate}
                  disabled={!operations.length}
                >
                  Cadastrar primeiro colaborador
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-mf-linha md:hidden">
              {visible.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "p-4",
                    ativa(row) &&
                      "bg-mf-realce-suave/60 shadow-[inset_3px_0_0_rgb(var(--mf-brilho))]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar nome={text(row.name)} tom={tomDoAvatar(row)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-mf-tinta">{text(row.name)}</p>
                      <p className="mt-0.5 text-xs text-mf-texto-2">
                        <span className="font-mono">{text(row.identifier)}</span>
                        {" · "}
                        {text((row.function as Row | undefined)?.name ?? "—")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <PilulaDeTurno rotulo={shiftLabel(row)} />
                        <span className="text-xs text-mf-texto-2">{rodizio(row)}</span>
                        <Situacao row={row} />
                      </div>
                      <AvisoDeDesligamento row={row} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => openEdit(row)}>
                      Editar
                    </Button>
                    <AcaoDeDesligar row={row} grande onToggle={() => void toggleTermination(row)} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-mf-texto-3">
                  <tr>
                    <th className="whitespace-nowrap px-2.5 py-3">Colaborador</th>
                    <th className="whitespace-nowrap px-2.5 py-3">Matrícula</th>
                    <th className="whitespace-nowrap px-2.5 py-3">Função</th>
                    <th className="whitespace-nowrap px-2.5 py-3">Turno</th>
                    <th className="whitespace-nowrap px-2.5 py-3">Rodízio</th>
                    <th className="whitespace-nowrap px-2.5 py-3">Situação</th>
                    <th className="whitespace-nowrap px-2.5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mf-linha">
                  {visible.map((row) => (
                    <tr
                      className={cn(
                        "linha-brilho",
                        ativa(row) &&
                          "bg-mf-realce-suave/60 shadow-[inset_3px_0_0_rgb(var(--mf-brilho))]"
                      )}
                      key={row.id}
                    >
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar nome={text(row.name)} tom={tomDoAvatar(row)} compacto />
                          <div>
                            <div className="font-semibold text-mf-tinta">{text(row.name)}</div>
                            <div className="text-xs text-mf-texto-3">
                              <Dica texto="Iniciais exibidas na grade da escala">
                                {text(row.initials ?? "—")}
                              </Dica>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 font-mono text-[13px] text-mf-texto-2">
                        {text(row.identifier)}
                      </td>
                      <td className="px-2.5 py-3 text-mf-texto-2">
                        {text((row.function as Row | undefined)?.name ?? "—")}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <PilulaDeTurno rotulo={shiftLabel(row)} />
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-mf-texto-2">
                        {rodizio(row)}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <Situacao row={row} />
                        <AvisoDeDesligamento row={row} />
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                            Editar
                          </Button>
                          <AcaoDeDesligar row={row} onToggle={() => void toggleTermination(row)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar colaborador" : "Novo colaborador"}
      >
        <div className="space-y-4">
          {editingId ? (
            <CartaoDePerfil
              nome={form.name}
              matricula={form.identifier}
              funcao={text(functionOptions.find((fn) => fn.id === form.functionId)?.name ?? "")}
              tom={tomDoAvatar({ id: "", status: form.status })}
              situacao={<Situacao row={{ id: "", status: form.status }} />}
              etiquetas={
                form.shift ? (
                  <PilulaDeTurno
                    rotulo={shiftLabel({
                      id: "",
                      operationId: form.operationId,
                      shift: form.shift
                    })}
                  />
                ) : undefined
              }
            />
          ) : null}
          {editingId ? (
            <Tabs activeId={activeTab} onChange={setActiveTab} items={abas} />
          ) : (
            <Etapas
              passos={passosDoCadastro}
              atual={etapaAtual}
              aoMudar={(i) => setActiveTab(idsDasEtapas[i] ?? "profissional")}
              aviso={stepNotice}
              aoAvisar={setStepNotice}
              acaoFinal={
                <Button type="button" onClick={() => void saveEmployee()} disabled={saving}>
                  {saving ? "Salvando..." : "Cadastrar colaborador"}
                </Button>
              }
            />
          )}
          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-mf-perigo/20 bg-mf-perigo-suave p-3 text-sm text-mf-perigo"
            >
              {formError}
            </p>
          )}
          {editingId ? (
            <div className="flex justify-end gap-2 border-t border-mf-linha pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Fechar
              </Button>
              <Button type="button" onClick={() => void saveEmployee()} disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}

/** Campo de texto do cadastro (rótulo flutuante). Mantém a assinatura de antes. */
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
    <CampoDeTexto
      rotulo={label}
      valor={value}
      aoMudar={onChange}
      tipo={type}
      obrigatorio={required ?? false}
      ajuda={helper}
      {...(maxLength !== undefined ? { tamanhoMaximo: maxLength } : {})}
    />
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
    <CampoDeSelecao
      rotulo={label}
      valor={value}
      aoMudar={onChange}
      opcoes={options}
      obrigatorio={required ?? false}
    />
  );
}
