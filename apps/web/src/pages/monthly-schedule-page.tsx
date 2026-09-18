/* This page synchronizes the persisted monthly schedule when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { CalendarDays, Check, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "../components/ui";
import { request, text, date, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";

const demoOp = "55555555-5555-4555-8555-555555555555";
export function MonthlySchedulePage() {
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [operationId, setOperationId] = useState(demoOp);
  const [month, setMonth] = useState("2026-10");
  const [notice, setNotice] = useState("");
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
      setNotice(e instanceof Error ? e.message : "Falha ao carregar escalas.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function generate() {
    try {
      const row = await request<Row>("/schedules/generate", "POST", { operationId, month });
      setSchedules((s) => [row, ...s]);
      setNotice("Escala gerada com snapshot do servidor.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Geração bloqueada; verifique QLP e parâmetros.");
    }
  }
  async function status(id: string, next: string) {
    try {
      const row = await request<Row>(`/schedules/${id}/status`, "PATCH", {
        status: next,
        reason: `Fluxo manual: ${next}`
      });
      setSchedules((s) => s.map((x) => (x.id === id ? { ...x, ...row } : x)));
      setNotice(`Escala ${labels[next] ?? next}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Transição não permitida para este perfil.");
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Escalar</p>
          <h1 className="mt-2 text-2xl font-semibold">Escalas mensais</h1>
          <p className="mt-1 text-sm text-slate-600">
            Geração determinística, conflitos explicáveis e publicação versionada.
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
      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            Operação
            <select
              className="mt-1 w-full rounded border p-2"
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
            <Button icon={<CalendarDays size={16} />} onClick={() => void generate()}>
              Gerar escala
            </Button>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        {schedules.map((s) => (
          <article className="rounded border border-slate-200 bg-white p-5 shadow-sm" key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  Versão {text(s.version)} · {date(s.month)}
                </h2>
                <p className="text-sm text-slate-500">
                  Status: {labels[text(s.status)] ?? text(s.status)}
                </p>
              </div>
              <div className="flex gap-2">
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
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(() => {
                const result = s.generatedResult as Row | undefined;
                const metrics = result?.metrics as Row | undefined;
                return (
                  <>
                    <div className="rounded bg-slate-50 p-3 text-sm">
                      Necessário
                      <br />
                      <b>{text(metrics?.required)}</b>
                    </div>
                    <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">
                      Coberto
                      <br />
                      <b>{text(metrics?.covered)}</b>
                    </div>
                    <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">
                      Cobertura
                      <br />
                      <b>{text(metrics?.coverage)}%</b>
                    </div>
                  </>
                );
              })()}
            </div>
          </article>
        ))}
        {schedules.length === 0 && (
          <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Nenhuma escala gerada ainda.
          </div>
        )}
      </section>
    </div>
  );
}
