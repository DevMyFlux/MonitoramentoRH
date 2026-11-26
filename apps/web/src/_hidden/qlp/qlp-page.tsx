/* These pages synchronize persisted operational snapshots when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import {
  AvisoTemporario,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../../components/ui";
import { LinhaDeEtapas } from "../../components/ui/linha-de-etapas";
import { request, date, text, type Row } from "../../features/my-flux/client";
import { labels } from "../../features/my-flux/resources";

const demoOp = "55555555-5555-4555-8555-555555555555";
const demoFunctions = [
  { id: "77777777-7777-4777-8777-777777777777", name: "Técnico operacional" },
  { id: "88888888-8888-4888-8888-888888888888", name: "Auxiliar operacional" }
];
const iso = (value: string) => new Date(value).toISOString();
// Etapas de uma versão do QLP. Aprovar materializa as posições (a API decide quem pode).
const versionSteps = [
  { id: "DRAFT", rotulo: "Rascunho" },
  { id: "IN_REVIEW", rotulo: "Em aprovação" },
  { id: "APPROVED", rotulo: "Aprovado", dica: "Ao aprovar, as posições são criadas" }
];
const campo =
  "mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3 text-sm font-normal";
const campoDaLinha = "h-11 rounded-mf-controle border border-mf-linha bg-white px-3 text-sm";
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  async function load() {
    setLoading(true);
    setLoadError("");
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
      setLoadError(e instanceof Error ? e.message : "Não foi possível carregar o QLP.");
    } finally {
      setLoading(false);
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
      <TituloDePagina
        etiqueta="MY FLUX · Dimensionar"
        titulo="QLP e posições"
        descricao="O QLP aprovado gera as posições operacionais automaticamente: rascunho, aprovação e, ao aprovar, as posições."
        acoes={
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
            Atualizar
          </Button>
        }
      />
      <AvisoTemporario mensagem={notice} aoFechar={() => setNotice("")} />
      <form
        onSubmit={create}
        aria-label="Novo QLP"
        className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
      >
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm font-medium text-mf-texto">
            Operação
            <select
              className={campo}
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
          <label className="text-sm font-medium text-mf-texto">
            Tipo
            <select className={campo} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option>OPERATIONAL</option>
              <option>CONTRACTUAL</option>
            </select>
          </label>
          <label className="text-sm font-medium text-mf-texto">
            Vigência
            <input
              className={campo}
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-mf-texto">
            Motivo
            <input
              className={campo}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-mf-tinta">Requisitos do quadro</h2>
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
                className={campoDaLinha}
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
                className={campoDaLinha}
                value={r.shift}
                placeholder="Turno"
                onChange={(e) =>
                  setRequirements((x) =>
                    x.map((a, j) => (j === i ? { ...a, shift: e.target.value } : a))
                  )
                }
              />
              <input
                className={campoDaLinha}
                value={r.team}
                placeholder="Equipe"
                onChange={(e) =>
                  setRequirements((x) =>
                    x.map((a, j) => (j === i ? { ...a, team: e.target.value } : a))
                  )
                }
              />
              <input
                className={campoDaLinha}
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
      {loading ? (
        <div role="status" aria-label="Carregando QLP" className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-mf-cartao" />
          <Skeleton className="h-48 rounded-mf-cartao" />
        </div>
      ) : loadError ? (
        <ErrorState
          title="Não foi possível carregar o QLP"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          <List title="Versões do QLP" rows={versions} version onTransition={transition} />
          <List title="Posições materializadas" rows={positions} />
        </section>
      )}
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
    <section
      aria-label={title}
      className="overflow-hidden rounded-mf-cartao border border-mf-linha bg-mf-cartao shadow-mf-1"
    >
      <h2 className="flex items-center gap-2 border-b border-mf-linha p-4 font-display text-lg font-bold text-mf-tinta">
        {title}{" "}
        <span className="rounded-full bg-mf-fundo px-2 py-0.5 text-xs font-medium tabular-nums text-mf-texto-2">
          {rows.length}
        </span>
      </h2>
      <div className="divide-y divide-mf-linha">
        {rows.length ? (
          rows.map((r) => (
            <div className="space-y-3 p-4 text-sm" key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-mf-tinta">
                    {version
                      ? `Versão ${text(r.version)} · ${labels[text(r.kind)] ?? text(r.kind)}`
                      : text(r.function ?? r.functionId)}
                  </p>
                  <p className="text-xs text-mf-texto-3">
                    {version
                      ? `Vigência ${date(r.validFrom)}`
                      : `${text(r.shift)} · Equipe ${text(r.team)}`}
                  </p>
                </div>
                {version && (
                  <div className="flex gap-2">
                    <span className="h-fit rounded-full bg-mf-fundo px-2.5 py-1 text-xs font-medium text-mf-texto-2">
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
              {version ? (
                <LinhaDeEtapas
                  rotulo={`Etapas da versão ${text(r.version)}`}
                  etapas={versionSteps}
                  atual={
                    text(r.status) === "APPROVED"
                      ? versionSteps.length
                      : versionSteps.findIndex((s) => s.id === text(r.status))
                  }
                />
              ) : null}
            </div>
          ))
        ) : (
          <div className="p-4">
            <EmptyState
              title={version ? "Nenhuma versão do QLP" : "Nenhuma posição ainda"}
              description={
                version
                  ? "Crie a primeira versão no formulário acima; ela nasce como rascunho."
                  : "As posições aparecem aqui quando uma versão do QLP é aprovada."
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
