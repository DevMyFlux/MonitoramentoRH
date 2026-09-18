/* These pages synchronize persisted operational snapshots when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "../components/ui";
import { request, text, date, type Row } from "../features/my-flux/client";
import { labels } from "../features/my-flux/resources";

const nextStage: Record<string, string> = {
  REQUESTED: "RECRUITING",
  RECRUITING: "SELECTED",
  SELECTED: "DOCUMENTATION",
  DOCUMENTATION: "MEDICAL_EXAM",
  MEDICAL_EXAM: "ADMISSION_SCHEDULED",
  ADMISSION_SCHEDULED: "ADMITTED"
};
export function RecruitmentPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [positions, setPositions] = useState<Row[]>([]);
  const [positionId, setPositionId] = useState("");
  const [reason, setReason] = useState("Reposição de posição");
  const [desiredDate, setDesiredDate] = useState("2026-10-01T00:00");
  const [candidateName, setCandidateName] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    try {
      const [r, p] = await Promise.all([
        request<Row[]>("/recruitment/requests"),
        request<Row[]>("/positions")
      ]);
      setRequests(r);
      setPositions(p);
      if (p.length && !p.some((x) => x.id === positionId)) setPositionId(p.at(0)?.id ?? "");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao carregar recrutamento.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function createRequest(e: FormEvent) {
    e.preventDefault();
    try {
      const row = await request<Row>("/recruitment/requests", "POST", {
        positionId,
        reason,
        desiredDate: new Date(desiredDate).toISOString()
      });
      setRequests((r) => [row, ...r]);
      setNotice("Requisição criada e vinculada à posição.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível abrir a requisição.");
    }
  }
  async function createCandidate(e: FormEvent) {
    e.preventDefault();
    try {
      const row = await request<Row>("/recruitment/candidates", "POST", {
        requestId: selectedRequest,
        name: candidateName
      });
      setRequests((rs) =>
        rs.map((r) =>
          r.id === selectedRequest
            ? { ...r, applications: [...((r.applications as Row[] | undefined) ?? []), row] }
            : r
        )
      );
      setCandidateName("");
      setNotice("Candidato registrado.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível registrar o candidato.");
    }
  }
  async function advance(candidate: Row) {
    const stage = nextStage[text(candidate.stage)];
    if (!stage) return;
    const extra: Record<string, unknown> = {
      stage,
      revision: Number(candidate.revision),
      reason: `Avanço para ${labels[stage] ?? stage}`
    };
    if (stage === "ADMISSION_SCHEDULED") {
      extra.documentsChecked = true;
      extra.medicalCleared = true;
      extra.admissionDate = "2026-01-01T00:00:00.000Z";
    }
    if (stage === "MEDICAL_EXAM") {
      extra.documentsChecked = true;
    }
    if (stage === "ADMITTED") {
      extra.documentsChecked = true;
      extra.medicalCleared = true;
      extra.admissionDate = "2026-01-01T00:00:00.000Z";
      extra.identifier = `ADM-${candidate.id.slice(0, 6)}`;
    }
    try {
      const row = await request<Row>(
        `/recruitment/candidates/${candidate.id}/transition`,
        "POST",
        extra
      );
      setRequests((rs) =>
        rs.map((r) => ({
          ...r,
          applications: ((r.applications as Row[] | undefined) ?? []).map((c) =>
            c.id === candidate.id ? { ...c, ...row } : c
          )
        }))
      );
      setNotice(`Candidato avançou para ${labels[stage] ?? stage}.`);
      if (stage === "ADMITTED") await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Transição bloqueada; verifique os requisitos.");
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Prover</p>
          <h1 className="mt-2 text-2xl font-semibold">Recrutamento e admissão</h1>
          <p className="mt-1 text-sm text-slate-600">
            Toda requisição nasce de uma posição do QLP aprovado.
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
      <section className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={createRequest}
          className="rounded border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-semibold">Nova requisição</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              Posição
              <select
                className="mt-1 w-full rounded border p-2"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {text(p.function ?? p.functionId)} · {text(p.shift)} · {text(p.team)}
                  </option>
                ))}
              </select>
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
            <label className="text-sm">
              Data desejada
              <input
                className="mt-1 w-full rounded border p-2"
                type="datetime-local"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                required
              />
            </label>
            <Button type="submit" icon={<UserPlus size={16} />}>
              Abrir requisição
            </Button>
          </div>
        </form>
        <form
          onSubmit={createCandidate}
          className="rounded border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-semibold">Novo candidato</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              Requisição
              <select
                className="mt-1 w-full rounded border p-2"
                value={selectedRequest}
                onChange={(e) => setSelectedRequest(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {requests
                  .filter((r) => ["REQUESTED", "RECRUITING"].includes(text(r.status)))
                  .map((r) => (
                    <option value={r.id} key={r.id}>
                      #{r.id.slice(0, 8)} · {labels[text(r.status)] ?? text(r.status)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Nome
              <input
                className="mt-1 w-full rounded border p-2"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                required
              />
            </label>
            <Button type="submit" icon={<UserPlus size={16} />}>
              Cadastrar candidato
            </Button>
          </div>
        </form>
      </section>
      <section className="space-y-4">
        {requests.map((r) => (
          <article className="rounded border border-slate-200 bg-white p-5 shadow-sm" key={r.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h2 className="font-semibold">Requisição #{r.id.slice(0, 8)}</h2>
                <p className="text-sm text-slate-500">
                  {text(r.position)} · desejada em {date(r.desiredDate)}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                {labels[text(r.status)] ?? text(r.status)}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {((r.applications as Row[] | undefined) ?? []).map((c) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-100 p-3"
                  key={c.id}
                >
                  <div>
                    <p className="font-medium">{text(c.name)}</p>
                    <p className="text-xs text-slate-500">
                      {labels[text(c.stage)] ?? text(c.stage)} · revisão {text(c.revision)}
                    </p>
                  </div>
                  {nextStage[text(c.stage)] && (
                    <Button
                      size="sm"
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => void advance(c)}
                    >
                      Avançar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
        {requests.length === 0 && (
          <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Aprove um QLP e materialize posições para iniciar o recrutamento.
          </div>
        )}
      </section>
    </div>
  );
}
