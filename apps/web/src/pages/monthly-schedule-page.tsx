/* This page synchronizes the persisted monthly schedule when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Fragment, useMemo, useState, useEffect } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  X
} from "lucide-react";
import { holidaysOfMonth, MODULOS, scheduleCodes } from "@my-flux/shared";
import {
  AvisoTemporario,
  Badge,
  BotaoEstrela,
  Button,
  CampoDeSelecao,
  CampoDeTexto,
  EquipesPorTurno,
  Interruptor,
  ListaDePendencias,
  ProgressoDoFluxo,
  Skeleton,
  TituloDePagina,
  centroDoFoco,
  faisca,
  useSobreposicao
} from "../components/ui";
import { cn } from "../lib/cn";
import { download, request, text, date, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";
import {
  CartoesDeCobertura,
  metricasDaVersao,
  textoDeCobertura
} from "../_hidden/qlp/metricas-de-cobertura";

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
type Pendency = { employeeId: string; employeeName: string; date: string; reasonCodes: string[] };
type SelectedCell = {
  employeeId: string;
  employeeName: string;
  sectionIndex: number;
  rowIndex: number;
  dayIndex: number;
  date: string;
  currentCode: string;
};

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  DRAFT: "neutral",
  IN_REVIEW: "warning",
  APPROVED: "info",
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

const qlpAtivo = MODULOS.qlp?.status === "active";

function getGrid(version: Row | null): Grid | null {
  return ((version?.generatedResult as Row | undefined)?.grid as Grid | undefined) ?? null;
}
function getPendencies(version: Row | null): Pendency[] {
  return (
    ((version?.generatedResult as Row | undefined)?.pendencies as Pendency[] | undefined) ?? []
  );
}
const letrasDaSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
const nomesDaSemana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
/** Dia da semana (0 = domingo) de um dia do mês da escala; o mês vem de 1 a 12. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
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
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [operationId, setOperationId] = useState(demoOp);
  const [unitTouched, setUnitTouched] = useState(false);
  const [month, setMonth] = useState("2026-10");
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overridesIndex, setOverridesIndex] = useState<Map<string, Row>>(new Map());
  const [cell, setCell] = useState<SelectedCell | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selected = schedules.find((s) => s.id === selectedId) ?? null;
  const grid = getGrid(selected);
  const pendencies = getPendencies(selected);

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
  const unitName = text(operations.find((o) => o.id === operationId)?.name ?? "—");

  async function load() {
    setLoadError("");
    try {
      const [s, o] = await Promise.all([
        request<Row[]>("/schedules"),
        request<Row[]>("/operations")
      ]);
      setSchedules(s);
      setOperations(o);
      if (o.length && !o.some((x) => x.id === operationId)) setOperationId(o.at(0)?.id ?? demoOp);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Falha ao carregar escalas.");
    } finally {
      setLoading(false);
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
    const origem = centroDoFoco();
    try {
      const row = await request<Row>("/employee-schedules/generate", "POST", {
        operationId,
        month
      });
      faisca(origem);
      setSchedules((s) => [row, ...s]);
      setSelectedId(row.id);
      void loadOverrides(row);
      setNotice("Escala gerada a partir dos colaboradores ativos desta unidade.");
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Geração bloqueada; verifique os colaboradores desta unidade."
      );
    }
  }

  async function status(id: string, next: string) {
    const origem = centroDoFoco();
    try {
      const row = await request<Row>(`/schedules/${id}/status`, "PATCH", {
        status: next,
        reason: `Fluxo manual: ${next}`
      });
      faisca(origem);
      setSchedules((s) => s.map((x) => (x.id === id ? { ...x, ...row } : x)));
      setNotice(`Escala ${labels[next] ?? next}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Transição não permitida para este perfil.");
    }
  }

  async function exportXlsx(version: Row) {
    try {
      // No explicit name: the server picks it (e.g. "Escala Hetrin - Setembro.xlsx").
      await download(`/employee-schedules/${version.id}/export`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível exportar esta versão.");
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
        `Status: ${labels[text(version.status)] ?? text(version.status)}\n\n` +
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
      setNotice(e instanceof Error ? e.message : "Não foi possível excluir a escala.");
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
  }

  useSobreposicao(cell !== null);

  const existingOverride = cell ? overridesIndex.get(`${cell.employeeId}|${cell.date}`) : undefined;

  async function saveOverride() {
    if (!cell || !selected || saving) return;
    setSaving(true);
    try {
      await request("/schedule-day-overrides", "POST", {
        operationId: selected.operationId,
        employeeId: cell.employeeId,
        date: cell.date,
        code: editCode,
        reason: editReason || null
      });
      // Patch the currently displayed grid immediately (per the flow we agreed on:
      // gerar automaticamente, depois editar célula a célula por cima do resultado).
      setSchedules((current) =>
        current.map((s) => {
          if (s.id !== selected.id) return s;
          const result = s.generatedResult as Row;
          const g = result.grid as Grid;
          const sections = g.sections.map((section, si) =>
            si !== cell.sectionIndex
              ? section
              : {
                  ...section,
                  rows: section.rows.map((row, ri) =>
                    ri !== cell.rowIndex
                      ? row
                      : {
                          ...row,
                          days: row.days.map((d, di) => (di === cell.dayIndex ? editCode : d))
                        }
                  )
                }
          );
          return { ...s, generatedResult: { ...result, grid: { ...g, sections } } };
        })
      );
      setNotice("Ajuste manual salvo. Ele será mantido nas próximas gerações desta unidade/mês.");
      setCell(null);
      void loadOverrides(selected);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível salvar o ajuste manual.");
    } finally {
      setSaving(false);
    }
  }

  async function removeOverride() {
    if (!existingOverride || saving) return;
    setSaving(true);
    try {
      await request(`/schedule-day-overrides/${existingOverride.id}`, "DELETE");
      setNotice("Ajuste manual removido. Gere a escala novamente para recalcular este dia.");
      setCell(null);
      if (selected) void loadOverrides(selected);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível remover o ajuste manual.");
    } finally {
      setSaving(false);
    }
  }

  const codeColors = useMemo(() => new Map(scheduleCodes.map((c) => [c.code, c.color])), []);

  // Workflow buttons — unchanged meaning, identical for the latest card and the
  // history rows.
  function statusActions(s: Row) {
    return (
      <>
        {text(s.status) === "DRAFT" && (
          <Button
            size="sm"
            icon={<Check size={14} />}
            onClick={() => void status(s.id, "IN_REVIEW")}
          >
            Enviar
          </Button>
        )}
        {text(s.status) === "IN_REVIEW" && (
          <Button
            size="sm"
            icon={<CheckCircle2 size={14} />}
            onClick={() => void status(s.id, "APPROVED")}
          >
            Aprovar
          </Button>
        )}
        {text(s.status) === "APPROVED" && (
          <Button size="sm" onClick={() => void status(s.id, "PUBLISHED")}>
            Publicar
          </Button>
        )}
      </>
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
      (grid.holidays ?? holidaysOfMonth(grid.year, grid.month, unitCode)).map((holiday) => [
        holiday.day,
        holiday.name
      ])
    );
    return (
      <div className="mt-5 space-y-4 border-t border-mf-linha pt-4">
        <EquipesPorTurno
          equipes={grid.sections.map((section) => ({
            nome: section.label,
            pessoas: section.rows.length
          }))}
        />
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
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ backgroundColor: "#B4C6E7" }}
              />
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
                {Array.from({ length: grid.sections[0]?.rows[0]?.days.length ?? 0 }, (_, i) => {
                  const semana = weekdayOf(grid.year, grid.month, i + 1);
                  const fimDeSemana = semana === 0 || semana === 6;
                  return (
                    <th
                      className={cn(
                        "px-1 py-1.5 text-center tabular-nums",
                        fimDeSemana && !holidayByDay.has(i + 1) && "bg-slate-100 text-mf-texto-2"
                      )}
                      key={i}
                      abbr={`${i + 1}, ${nomesDaSemana[semana]}`}
                      title={
                        holidayByDay.get(i + 1) ? `Feriado: ${holidayByDay.get(i + 1)}` : undefined
                      }
                      style={
                        holidayByDay.has(i + 1)
                          ? { backgroundColor: "#B4C6E7", color: "#1F3A63" }
                          : undefined
                      }
                    >
                      <span className="block">{i + 1}</span>
                      <span aria-hidden="true" className="block text-[10px] font-normal opacity-70">
                        {letrasDaSemana[semana]}
                      </span>
                    </th>
                  );
                })}
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
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono tabular-nums">
                        {row.hours}
                      </td>
                      {row.days.map((code, dayIndex) => {
                        const color = codeColors.get(code);
                        const hasOverride = overridesIndex.has(
                          `${row.employeeId}|${grid.year}-${pad(grid.month)}-${pad(dayIndex + 1)}`
                        );
                        return (
                          <td
                            key={dayIndex}
                            role="button"
                            tabIndex={0}
                            aria-label={`${row.employeeName}, dia ${dayIndex + 1}: ${code || "vazio"}. Ajustar`}
                            onClick={() => openCell(sectionIndex, rowIndex, dayIndex)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openCell(sectionIndex, rowIndex, dayIndex);
                              }
                            }}
                            className="w-7 cursor-pointer px-0.5 py-1.5 text-center hover:bg-mf-realce-suave focus-visible:relative focus-visible:z-10 [@media(pointer:coarse)]:min-w-11"
                            style={{
                              color: color ? `#${color.font}` : undefined,
                              fontWeight: color?.bold ? 700 : 400,
                              backgroundColor: color?.fill
                                ? `#${color.fill}`
                                : hasOverride
                                  ? "#ECFDF5"
                                  : holidayByDay.has(dayIndex + 1)
                                    ? "#DCE6F5"
                                    : [0, 6].includes(
                                          weekdayOf(grid.year, grid.month, dayIndex + 1)
                                        )
                                      ? "#F1F5F9"
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

        <ListaDePendencias
          itens={pendencies.map((p, i) => ({
            id: `${p.employeeId}-${p.date}-${i}`,
            pessoa: p.employeeName,
            data: p.date,
            motivos: p.reasonCodes
          }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="Escalar"
        titulo="Escalas mensais"
        descricao="Geração automática por colaborador, com edição manual célula a célula por cima do resultado."
        acoes={
          <Button
            variant="ghost"
            icon={
              loading ? (
                <span className="carregador" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <RefreshCw size={16} />
              )
            }
            onClick={() => void load()}
            disabled={loading}
            aria-busy={loading}
          >
            Atualizar
          </Button>
        }
      />
      <AvisoTemporario mensagem={notice} aoFechar={() => setNotice("")} />
      <section
        aria-label="Gerar escala"
        className="vidro rounded-2xl border border-white/70 p-4 shadow-sm ring-1 ring-mf-linha/60 sm:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
          <CampoDeSelecao
            rotulo="Operação"
            valor={operationId}
            aoMudar={(v) => {
              setUnitTouched(true);
              setOperationId(v);
            }}
            opcoes={
              operations.length
                ? operations.map((o) => ({ value: o.id, label: text(o.name) }))
                : [{ value: demoOp, label: "Operação Demonstrativa" }]
            }
          />
          <CampoDeTexto rotulo="Mês" tipo="month" valor={month} aoMudar={setMonth} />
          <BotaoEstrela
            className="h-[3.25rem] w-full"
            icon={<CalendarDays size={16} />}
            onClick={() => void generate()}
          >
            Gerar escala
          </BotaoEstrela>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-mf-texto-2">
            Última escala gerada · {unitName}
          </h2>
          <Interruptor
            rotulo={`Histórico${unitSchedules.length > 1 ? ` (${unitSchedules.length} escalas)` : ""}`}
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />
        </div>

        {latest && (
          <article
            className="rounded-2xl border border-mf-linha bg-mf-cartao p-4 shadow-[0_1px_2px_rgb(var(--mf-tinta)/0.04)] sm:p-5"
            key={latest.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {monthLabel(latest.month)} · Versão {text(latest.version)}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <Badge tone={statusTone[text(latest.status)] ?? "neutral"}>
                    {labels[text(latest.status)] ?? text(latest.status)}
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
            <div className="mt-4">
              <ProgressoDoFluxo status={text(latest.status)} />
            </div>
            {qlpAtivo ? <CartoesDeCobertura metricas={metricasDaVersao(latest)} /> : null}
            {scheduleViewer(latest)}
          </article>
        )}
        {loading && !schedules.length && !loadError && (
          <div
            role="status"
            aria-label="Carregando escalas"
            className="space-y-3 rounded-2xl border border-mf-linha bg-mf-cartao p-5"
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        )}
        {loadError && (
          <div
            role="alert"
            className="rounded-2xl border border-mf-perigo/20 bg-mf-perigo-suave p-4 text-sm text-mf-perigo"
          >
            <p className="font-medium">Não foi possível carregar as escalas.</p>
            <p className="mt-1">{loadError}</p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {!latest && !loading && !loadError && (
          <div className="rounded-2xl border border-dashed border-mf-linha bg-mf-cartao px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mf-realce-suave text-mf-primaria"
            >
              <CalendarDays size={22} />
            </span>
            <p className="mt-4 font-display text-lg font-bold text-mf-tinta">
              {schedules.length
                ? `Nenhuma escala de ${unitName} ainda`
                : "Nenhuma escala por aqui ainda"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-mf-texto-2">
              Escolha a operação e o mês acima e toque em “Gerar escala”: ela nasce como rascunho, e
              você ajusta o que precisar.
            </p>
          </div>
        )}

        {showHistory && (
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Histórico de escalas · {unitName}
            </h2>
            {unitSchedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-mf-linha bg-mf-cartao p-6 text-center text-sm text-mf-texto-2">
                Nenhuma escala no histórico desta unidade.
              </div>
            ) : (
              unitSchedules.map((s, index) => (
                <article
                  className="rounded-2xl border border-mf-linha bg-mf-cartao p-4 shadow-[0_1px_2px_rgb(var(--mf-tinta)/0.04)]"
                  key={s.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {monthLabel(s.month)} · Versão {text(s.version)}
                        <Badge tone={statusTone[text(s.status)] ?? "neutral"}>
                          {labels[text(s.status)] ?? text(s.status)}
                        </Badge>
                        {index === 0 && <Badge tone="info">Atual</Badge>}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Unidade: {text(operations.find((o) => o.id === s.operationId)?.name ?? "—")}{" "}
                        · Gerada em {generatedAt(s.createdAt)}
                        {qlpAtivo ? textoDeCobertura(s) : null}
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
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        onClick={() => void removeSchedule(s)}
                        disabled={deletingId === s.id}
                      >
                        {deletingId === s.id ? "Excluindo..." : "Excluir escala"}
                      </Button>
                    </div>
                  </div>
                  {index !== 0 && scheduleViewer(s)}
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {cell && (
        <div
          className="gaveta-fundo fixed inset-0 z-50 flex items-center justify-center bg-mf-tinta/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCell(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ajustar dia"
            className="gaveta-painel w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-mf-tinta">Ajustar dia</h3>
              <button
                type="button"
                onClick={() => setCell(null)}
                aria-label="Fechar"
                className="grid h-11 w-11 place-items-center rounded-lg text-mf-texto-3 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-sm text-mf-texto-2">
              {cell.employeeName} · {date(cell.date)}
            </p>
            <div className="mt-4 space-y-3">
              <CampoDeSelecao
                rotulo="Código"
                valor={editCode}
                aoMudar={setEditCode}
                opcoes={scheduleCodes.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${c.label}`
                }))}
              />
              <CampoDeTexto
                rotulo="Motivo (opcional)"
                valor={editReason}
                aoMudar={setEditReason}
                ajuda="Ex.: cobertura pontual combinada com o supervisor"
              />
            </div>
            <div className="mt-5 flex justify-between gap-2">
              {existingOverride ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void removeOverride()}
                  disabled={saving}
                >
                  Remover ajuste
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCell(null)} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => void saveOverride()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
