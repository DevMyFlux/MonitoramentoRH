// Auditoria em linha do tempo: quem fez o quê, em qual registro e quando, agrupado por dia. Cada
// evento abre o "antes e depois" campo a campo (marcado com sinal e palavra, não só com cor).
// A API (GET /audit/logs) só responde a DEV e ADMIN; esta tela explica isso quando recebe a recusa.
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  History,
  PencilLine,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  UserCog,
  XCircle,
  type LucideIcon
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, EmptyState, ErrorState, Skeleton, TituloDePagina } from "../components/ui";
import { agruparPorDia, diferencas, rotuloDaAcao } from "../features/auditoria/diferencas";
import { request } from "../features/my-flux/client";
import { cn } from "../lib/cn";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  justification?: string | null;
  origin: string;
  createdAt: string;
  user: { email: string; name: string } | null;
};

const iconeDaAcao: Record<string, LucideIcon> = {
  CREATE: FilePlus2,
  UPDATE: PencilLine,
  ARCHIVE: Archive,
  RESTORE: RotateCcw,
  APPROVE: CheckCircle2,
  REJECT: XCircle,
  PUBLISH: Send,
  UNPUBLISH: RotateCcw,
  OVERRIDE: ShieldAlert,
  ROLE_CHANGE: UserCog,
  PERMISSION_CHANGE: UserCog,
  USER_INVITE: UserCog,
  USER_DISABLE: UserCog
};

const filtrosVazios = { q: "", entity: "", action: "" };

/** "Terça-feira, 24 de novembro de 2026": maiúscula só na primeira letra. */
const dataLonga = (dia: string) => {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${dia}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const hora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(iso));

export function AuditPage() {
  const [rascunho, setRascunho] = useState(filtrosVazios);
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [aberto, setAberto] = useState<string | null>(null);

  const parametros = new URLSearchParams();
  if (filtros.q) parametros.set("q", filtros.q);
  if (filtros.entity) parametros.set("entity", filtros.entity);
  if (filtros.action) parametros.set("action", filtros.action);

  const logs = useQuery({
    queryKey: ["auditoria", filtros],
    queryFn: () => request<AuditLog[]>(`/audit/logs?${parametros.toString()}`),
    retry: false
  });
  const registros = Array.isArray(logs.data) ? logs.data : [];

  function filtrar(evento: FormEvent) {
    evento.preventDefault();
    setFiltros({ ...rascunho, q: rascunho.q.trim(), entity: rascunho.entity.trim() });
  }

  const campo =
    "mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white/80 px-3 text-sm font-normal";

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Gestão"
        titulo="Auditoria"
        descricao="Quem mudou o quê e quando. Nada é apagado: cada mudança crítica fica registrada com o antes e o depois."
      />

      <form
        role="search"
        aria-label="Filtrar auditoria"
        onSubmit={filtrar}
        className="vidro flex flex-wrap items-end gap-x-4 gap-y-3 rounded-mf-cartao border border-white/70 p-4 shadow-mf-1 ring-1 ring-mf-linha/60"
      >
        <label className="min-w-0 flex-1 basis-56 text-sm font-medium text-mf-texto">
          Busca
          <input
            className={campo}
            placeholder="Entidade, registro ou origem"
            value={rascunho.q}
            onChange={(e) => setRascunho({ ...rascunho, q: e.target.value })}
          />
        </label>
        <label className="w-full text-sm font-medium text-mf-texto sm:w-48">
          Entidade
          <input
            className={campo}
            placeholder="Ex.: Employee"
            value={rascunho.entity}
            onChange={(e) => setRascunho({ ...rascunho, entity: e.target.value })}
          />
        </label>
        <label className="w-full text-sm font-medium text-mf-texto sm:w-52">
          Ação
          <select
            className={campo}
            value={rascunho.action}
            onChange={(e) => setRascunho({ ...rascunho, action: e.target.value })}
          >
            <option value="">Todas as ações</option>
            {Object.entries(rotuloDaAcao).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" icon={<Search size={16} />}>
          Filtrar
        </Button>
      </form>

      {logs.isPending ? (
        <div role="status" aria-label="Carregando auditoria" className="space-y-3">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16 rounded-mf-cartao" />
          ))}
        </div>
      ) : logs.isError ? (
        <ErrorState
          title="Não foi possível carregar a auditoria"
          description={
            /permiss/i.test(logs.error.message)
              ? "A auditoria é restrita a Dev e Admin. Peça acesso a quem administra o sistema."
              : logs.error.message
          }
          onRetry={() => void logs.refetch()}
        />
      ) : registros.length === 0 ? (
        <EmptyState
          title={
            filtros.q || filtros.entity || filtros.action
              ? "Nenhum registro com esses filtros"
              : "Ainda não há registros de auditoria"
          }
          description="As mudanças em cadastros, escalas, permissões e importações aparecem aqui assim que acontecem."
          action={
            filtros.q || filtros.entity || filtros.action ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setRascunho(filtrosVazios);
                  setFiltros(filtrosVazios);
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <p className="text-xs text-mf-texto-3" aria-live="polite">
            <span className="tabular-nums">{registros.length}</span>{" "}
            {registros.length === 1 ? "registro" : "registros"}
            {registros.length >= 200 ? " (os 200 mais recentes; refine os filtros)" : ""}
          </p>
          {agruparPorDia(registros).map((grupo) => (
            <section key={grupo.dia} aria-label={dataLonga(grupo.dia)}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-mf-texto-2">
                <History size={15} aria-hidden="true" />
                {dataLonga(grupo.dia)}
              </h2>
              <ol className="relative space-y-3 border-l-2 border-mf-linha pl-6">
                {grupo.registros.map((log) => (
                  <EventoDaAuditoria
                    key={log.id}
                    log={log}
                    aberto={aberto === log.id}
                    aoAlternar={() => setAberto(aberto === log.id ? null : log.id)}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EventoDaAuditoria({
  log,
  aberto,
  aoAlternar
}: {
  log: AuditLog;
  aberto: boolean;
  aoAlternar: () => void;
}) {
  const Icone = iconeDaAcao[log.action] ?? PencilLine;
  const acao = rotuloDaAcao[log.action] ?? log.action;
  const mudancas = aberto ? diferencas(log.before, log.after) : [];
  const idDoDetalhe = `auditoria-${log.id}`;
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[37px] top-3 grid h-7 w-7 place-items-center rounded-full bg-mf-cartao text-mf-primaria shadow-mf-1"
      >
        <Icone size={14} />
      </span>
      <div className="rounded-mf-cartao border border-mf-linha bg-mf-cartao shadow-mf-1">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={idDoDetalhe}
          onClick={aoAlternar}
          className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-mf-cartao px-4 py-3 text-left hover:bg-mf-fundo"
        >
          <span className="font-mono text-xs tabular-nums text-mf-texto-3">
            {hora(log.createdAt)}
          </span>
          <span className="font-semibold text-mf-tinta">{acao}</span>
          <span className="text-sm text-mf-texto-2">
            {log.entity}
            {log.entityId ? (
              <span className="ml-1 font-mono text-xs text-mf-texto-3">
                #{log.entityId.slice(0, 8)}
              </span>
            ) : null}
          </span>
          <span className="ml-auto flex items-center gap-2 text-xs text-mf-texto-2">
            {log.user?.name ?? log.user?.email ?? "Sistema"}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={cn(
                "transition-transform motion-reduce:transition-none",
                aberto && "rotate-180"
              )}
            />
          </span>
        </button>
        {aberto ? (
          <div id={idDoDetalhe} className="border-t border-mf-linha px-4 py-3">
            {log.justification ? (
              <p className="mb-3 text-sm text-mf-texto-2">
                <strong className="font-semibold text-mf-texto">Justificativa:</strong>{" "}
                {log.justification}
              </p>
            ) : null}
            {mudancas.length === 0 ? (
              <p className="text-sm text-mf-texto-3">
                Este registro não guardou diferenças de campos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Antes e depois de {acao}</caption>
                  <thead className="text-xs uppercase tracking-wide text-mf-texto-3">
                    <tr>
                      <th className="py-2 pr-4">Campo</th>
                      <th className="py-2 pr-4">Antes</th>
                      <th className="py-2">Depois</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mf-linha">
                    {mudancas.map((m) => (
                      <tr key={m.campo}>
                        <td className="py-2 pr-4 align-top font-mono text-xs text-mf-texto-2">
                          {m.campo}
                        </td>
                        <td className="py-2 pr-4 align-top">
                          {m.antes === undefined ? (
                            <span className="text-mf-texto-3">—</span>
                          ) : (
                            <span className="break-all rounded bg-mf-perigo-suave px-1.5 py-0.5 text-mf-perigo">
                              <span aria-hidden="true">− </span>
                              <span className="sr-only">Antes: </span>
                              {m.antes}
                            </span>
                          )}
                        </td>
                        <td className="py-2 align-top">
                          {m.depois === undefined ? (
                            <span className="text-mf-texto-3">removido</span>
                          ) : (
                            <span className="break-all rounded bg-mf-realce-suave px-1.5 py-0.5 text-mf-primaria">
                              <span aria-hidden="true">+ </span>
                              <span className="sr-only">Depois: </span>
                              {m.depois}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-mf-texto-3">Origem: {log.origin}</p>
          </div>
        ) : null}
      </div>
    </li>
  );
}
