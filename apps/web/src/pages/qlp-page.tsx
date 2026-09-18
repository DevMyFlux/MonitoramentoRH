/* These pages synchronize persisted operational snapshots when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui";
import { request, date, text, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";

const demoOp = "55555555-5555-4555-8555-555555555555";
const demoFunctions = [
  { id: "77777777-7777-4777-8777-777777777777", name: "Técnico operacional" },
  { id: "88888888-8888-4888-8888-888888888888", name: "Auxiliar operacional" }
];
const iso = (value: string) => new Date(value).toISOString();
export function QlpPage() {
  const [versions, setVersions] = useState<Row[]>([]);
  const [positions, setPositions] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [functions, setFunctions] = useState<Row[]>(demoFunctions);
  const [operationId, setOperationId] = useState(demoOp);
  const [kind, setKind] = useState("OPERATIONAL");
  const [validFrom, setValidFrom] = useState("2026-01-01T00:00");
  const [reason, setReason] = useState("Dimensionamento operacional");
  const [requirements, setRequirements] = useState([
    { functionId: demoFunctions[0]!.id, shift: "DIURNO", team: "A", quantity: 2 },
    { functionId: demoFunctions[1]!.id, shift: "DIURNO", team: "A", quantity: 1 }
  ]);
  const [notice, setNotice] = useState("");
  async function load() {
    try {
      const [v, p, o, f] = await Promise.all([
        request<Row[]>("/qlp/versions"),
        request<Row[]>("/positions"),
        request<Row[]>("/operations"),
        request<Row[]>("/functions")
      ]);
      setVersions(v);
      setPositions(p);
      setOperations(o);
      if (f.length) setFunctions(f);
      if (o.length && !o.some((x) => x.id === operationId)) setOperationId(o.at(0)?.id ?? demoOp);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível carregar o QLP.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const row = await request<Row>("/qlp/versions", "POST", {
        operationId,
        kind,
        validFrom: iso(validFrom),
        reason,
        requirements
      });
      setVersions((v) => [row, ...v]);
      setNotice("QLP criado como rascunho.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao criar QLP.");
    }
  }
  async function transition(id: string, status: string) {
    try {
      const row = await request<Row>(`/qlp/versions/${id}/status`, "PATCH", { status });
      setVersions((v) => v.map((x) => (x.id === id ? { ...x, ...row } : x)));
      setNotice(
        status === "APPROVED"
          ? "QLP aprovado e posições materializadas."
          : "QLP enviado para revisão."
      );
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Transição não permitida.");
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Dimensionar</p>
          <h1 className="mt-2 text-2xl font-semibold">QLP e posições</h1>
          <p className="mt-1 text-sm text-slate-600">
            O QLP aprovado gera as posições operacionais automaticamente.
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
      <form onSubmit={create} className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
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
            Tipo
            <select
              className="mt-1 w-full rounded border p-2"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option>OPERATIONAL</option>
              <option>CONTRACTUAL</option>
            </select>
          </label>
          <label className="text-sm">
            Vigência
            <input
              className="mt-1 w-full rounded border p-2"
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            Motivo
            <input
              className="mt-1 w-full rounded border p-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Requisitos do quadro</h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<Plus size={15} />}
              onClick={() =>
                setRequirements((r) => [
                  ...r,
                  {
                    functionId: functions.at(0)?.id ?? demoFunctions[0]!.id,
                    shift: "DIURNO",
                    team: "A",
                    quantity: 1
                  }
                ])
              }
            >
              Adicionar linha
            </Button>
          </div>
          {requirements.map((r, i) => (
            <div className="grid gap-2 md:grid-cols-4" key={i}>
              <select
                className="rounded border p-2 text-sm"
                value={r.functionId}
                onChange={(e) =>
                  setRequirements((x) =>
                    x.map((a, j) => (j === i ? { ...a, functionId: e.target.value } : a))
                  )
                }
              >
                {functions.map((f) => (
                  <option value={f.id} key={f.id}>
                    {text(f.name)}
                  </option>
                ))}
              </select>
              <input
                className="rounded border p-2 text-sm"
                value={r.shift}
                placeholder="Turno"
                onChange={(e) =>
                  setRequirements((x) =>
                    x.map((a, j) => (j === i ? { ...a, shift: e.target.value } : a))
                  )
                }
              />
              <input
                className="rounded border p-2 text-sm"
                value={r.team}
                placeholder="Equipe"
                onChange={(e) =>
                  setRequirements((x) =>
                    x.map((a, j) => (j === i ? { ...a, team: e.target.value } : a))
                  )
                }
              />
              <input
                className="rounded border p-2 text-sm"
                type="number"
                min="1"
                value={r.quantity}
                onChange={(e) =>
                  setRequirements((x) =>
                    x.map((a, j) => (j === i ? { ...a, quantity: Number(e.target.value) } : a))
                  )
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Button icon={<Plus size={16} />} type="submit">
            Criar QLP
          </Button>
        </div>
      </form>
      <section className="grid gap-6 lg:grid-cols-2">
        <List title="Versões do QLP" rows={versions} version onTransition={transition} />
        <List title="Posições materializadas" rows={positions} />
      </section>
    </div>
  );
}
function List({
  title,
  rows,
  version,
  onTransition
}: {
  title: string;
  rows: Row[];
  version?: boolean;
  onTransition?: (id: string, status: string) => void;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b p-4 font-semibold">
        {title} <span className="text-xs font-normal text-slate-500">{rows.length}</span>
      </h2>
      <div className="divide-y">
        {rows.length ? (
          rows.map((r) => (
            <div className="flex items-center justify-between gap-3 p-4 text-sm" key={r.id}>
              <div>
                <p className="font-medium">
                  {version
                    ? `Versão ${text(r.version)} · ${labels[text(r.kind)] ?? text(r.kind)}`
                    : text(r.function ?? r.functionId)}
                </p>
                <p className="text-xs text-slate-500">
                  {text(r.shift)} · Equipe {text(r.team)} · {date(r.validFrom)}
                </p>
              </div>
              {version && (
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                    {labels[text(r.status)] ?? text(r.status)}
                  </span>
                  {text(r.status) === "DRAFT" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Send size={14} />}
                      onClick={() => onTransition?.(r.id, "IN_REVIEW")}
                    >
                      Enviar
                    </Button>
                  )}
                  {text(r.status) === "IN_REVIEW" && (
                    <Button
                      size="sm"
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => onTransition?.(r.id, "APPROVED")}
                    >
                      Aprovar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="p-6 text-sm text-slate-500">Nenhum registro neste escopo.</p>
        )}
      </div>
    </div>
  );
}
