/* These pages synchronize persisted operational snapshots when mounted. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, RefreshCw, UserPlus } from "lucide-react";
import {
  AvisoTemporario,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TituloDePagina
} from "../components/ui";
import { LinhaDeEtapas } from "../components/ui/linha-de-etapas";
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
/** As etapas do candidato, na ordem do fluxo (recruitment-workflow.ts decide o que pode avançar). */
const stages = [
  "REQUESTED",
  "RECRUITING",
  "SELECTED",
  "DOCUMENTATION",
  "MEDICAL_EXAM",
  "ADMISSION_SCHEDULED",
  "ADMITTED"
] as const;
const stageSteps = stages.map((id) => ({ id, rotulo: labels[id] ?? id }));

const campo =
  "mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3 text-sm font-normal";

/** "Técnico de enfermagem · DIURNO · equipe A", a partir da posição da requisição. */
function positionLabel(position: unknown): string {
  if (!position || typeof position !== "object") return "Posição";
  const p = position as Row;
  const fn = (p.function as Row | undefined)?.name ?? p.functionId;
  return [text(fn), text(p.shift), p.team ? `equipe ${text(p.team)}` : ""]
    .filter((part) => part && part !== "—")
    .join(" · ");
}

export function RecruitmentPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [positions, setPositions] = useState<Row[]>([]);
  const [positionId, setPositionId] = useState("");
  const [reason, setReason] = useState("Reposição de posição");
  const [desiredDate, setDesiredDate] = useState("2026-10-01T00:00");
  const [candidateName, setCandidateName] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [r, p] = await Promise.all([
        request<Row[]>("/recruitment/requests"),
        request<Row[]>("/positions")
      ]);
      setRequests(r);
      setPositions(p);
      if (p.length && !p.some((x) => x.id === positionId)) setPositionId(p.at(0)?.id ?? "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Falha ao carregar recrutamento.");
    } finally {
      setLoading(false);
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
  async function advance(candidate: Row, requestRow: Row) {
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
      // Admitir cria registros de verdade: mostra o resumo antes (o que a API vai criar).
      const resumo =
        `Admitir ${text(candidate.name)}?\n\n` +
        `Será criado:\n` +
        `• o colaborador, com a matrícula ${String(extra.identifier)};\n` +
        `• a alocação na posição ${positionLabel(requestRow.position)};\n` +
        `• o registro "Admitido" no histórico do colaborador.\n\n` +
        `A requisição passa a "preenchida" e a ação fica na auditoria.`;
      if (!window.confirm(resumo)) return;
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

  // Quadro por etapa: quantos candidatos há em cada fase, somando todas as requisições.
  const candidates = requests.flatMap((r) => (r.applications as Row[] | undefined) ?? []);
  const board = stages.map((stage) => ({
    stage,
    total: candidates.filter((c) => text(c.stage) === stage).length
  }));

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Prover"
        titulo="Recrutamento e admissão"
        descricao="Toda requisição nasce de uma posição do QLP aprovado. O candidato avança etapa por etapa até a admissão."
        acoes={
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
            Atualizar
          </Button>
        }
      />
      <AvisoTemporario mensagem={notice} aoFechar={() => setNotice("")} />

      <section aria-label="Candidatos por etapa">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {board.map((column) => (
            <li
              key={column.stage}
              className="rounded-mf-controle border border-mf-linha bg-mf-cartao p-3 shadow-mf-1"
            >
              <p className="text-xs text-mf-texto-2">{labels[column.stage] ?? column.stage}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-mf-tinta">
                {column.total}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={createRequest}
          className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
        >
          <h2 className="font-display text-lg font-bold text-mf-tinta">Nova requisição</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-mf-texto">
              Posição
              <select
                className={campo}
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
            <label className="text-sm font-medium text-mf-texto">
              Motivo
              <input
                className={campo}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium text-mf-texto">
              Data desejada
              <input
                className={campo}
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
          className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
        >
          <h2 className="font-display text-lg font-bold text-mf-tinta">Novo candidato</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-mf-texto">
              Requisição
              <select
                className={campo}
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
            <label className="text-sm font-medium text-mf-texto">
              Nome
              <input
                className={campo}
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

      <section aria-label="Requisições" className="space-y-4">
        {loading ? (
          <div role="status" aria-label="Carregando requisições" className="space-y-3">
            {[0, 1].map((n) => (
              <Skeleton key={n} className="h-28 rounded-mf-cartao" />
            ))}
          </div>
        ) : loadError ? (
          <ErrorState
            title="Não foi possível carregar o recrutamento"
            description={loadError}
            onRetry={() => void load()}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            title="Nenhuma requisição aberta"
            description="Aprove um QLP para gerar as posições e abra a primeira requisição no formulário acima."
          />
        ) : (
          requests.map((r) => (
            <article
              className="rounded-mf-cartao border border-mf-linha bg-mf-cartao p-5 shadow-mf-1"
              key={r.id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-mf-tinta">
                    Requisição <span className="font-mono">#{r.id.slice(0, 8)}</span>
                  </h2>
                  <p className="text-sm text-mf-texto-2">
                    {positionLabel(r.position)} · desejada em {date(r.desiredDate)}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-mf-fundo px-2.5 py-1 text-xs font-medium text-mf-texto-2">
                  {labels[text(r.status)] ?? text(r.status)}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {((r.applications as Row[] | undefined) ?? []).length === 0 ? (
                  <p className="text-sm text-mf-texto-3">
                    Ainda sem candidatos. Cadastre o primeiro no formulário "Novo candidato".
                  </p>
                ) : null}
                {((r.applications as Row[] | undefined) ?? []).map((c) => (
                  <div className="rounded-mf-controle border border-mf-linha p-3" key={c.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-mf-tinta">{text(c.name)}</p>
                        <p className="text-xs text-mf-texto-3">
                          {labels[text(c.stage)] ?? text(c.stage)} · revisão{" "}
                          <span className="tabular-nums">{text(c.revision)}</span>
                        </p>
                      </div>
                      {nextStage[text(c.stage)] && (
                        <Button
                          size="sm"
                          icon={<CheckCircle2 size={14} />}
                          onClick={() => void advance(c, r)}
                        >
                          {nextStage[text(c.stage)] === "ADMITTED"
                            ? "Admitir"
                            : `Avançar para ${labels[nextStage[text(c.stage)]!] ?? ""}`}
                        </Button>
                      )}
                    </div>
                    <div className="mt-3">
                      <LinhaDeEtapas
                        rotulo={`Etapas de ${text(c.name)}`}
                        etapas={stageSteps}
                        atual={
                          text(c.stage) === "ADMITTED"
                            ? stages.length
                            : stages.indexOf(text(c.stage) as (typeof stages)[number])
                        }
                        soAtual
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
