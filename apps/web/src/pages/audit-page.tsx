import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "../components/ui";
import { apiGet } from "../services/api-client";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  origin: string;
  createdAt: string;
  user: { email: string; name: string } | null;
};

type AuditResponse = {
  data: AuditLog[];
};

const actionOptions = [
  { label: "Todas", value: "" },
  { label: "CREATE", value: "CREATE" },
  { label: "UPDATE", value: "UPDATE" },
  { label: "ARCHIVE", value: "ARCHIVE" },
  { label: "APPROVE", value: "APPROVE" },
  { label: "PUBLISH", value: "PUBLISH" },
  { label: "OVERRIDE", value: "OVERRIDE" }
];

export function AuditPage() {
  const [filters, setFilters] = useState({ q: "", entity: "", action: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.entity) query.set("entity", filters.entity);
  if (filters.action) query.set("action", filters.action);

  const logs = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => apiGet<AuditResponse>(`/audit/logs?${query.toString()}`)
  });
  const selected = logs.data?.data.find((item) => item.id === selectedId) ?? logs.data?.data[0];

  return (
    <div className="space-y-6">
      <section>
        <Badge tone="info">ETAPA 15</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">Auditoria</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Historico consultado da API, com filtros e visualizacao de antes/depois.
        </p>
      </section>

      <section className="grid gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_180px_auto] md:items-end">
        <Input
          label="Busca"
          value={filters.q}
          onChange={(event) => setFilters({ ...filters, q: event.target.value })}
        />
        <Input
          label="Entidade"
          value={filters.entity}
          onChange={(event) => setFilters({ ...filters, entity: event.target.value })}
        />
        <Select
          label="Acao"
          options={actionOptions}
          value={filters.action}
          onChange={(event) => setFilters({ ...filters, action: event.target.value })}
        />
        <Button icon={<Search size={16} />} variant="secondary">
          Filtrar
        </Button>
      </section>

      {logs.isLoading ? <LoadingState /> : null}
      {logs.isError ? (
        <ErrorState
          description="A auditoria exige usuario DEV ou ADMIN autenticado."
          title="Nao foi possivel carregar auditoria"
        />
      ) : null}

      {logs.data ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Data</TableHeaderCell>
                <TableHeaderCell>Acao</TableHeaderCell>
                <TableHeaderCell>Entidade</TableHeaderCell>
                <TableHeaderCell>Usuario</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.data.data.map((log) => (
                <TableRow key={log.id} onClick={() => setSelectedId(log.id)}>
                  <TableCell>{new Date(log.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge tone="neutral">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.entity}</TableCell>
                  <TableCell>{log.user?.email ?? "sistema"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Diferencas</h2>
            {selected ? (
              <div className="mt-4 grid gap-3">
                <DiffBlock label="Antes" value={selected.before} />
                <DiffBlock label="Depois" value={selected.after} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Nenhum registro selecionado.</p>
            )}
          </section>
        </section>
      ) : null}
    </div>
  );
}

function DiffBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</div>
      <pre className="max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs leading-5 text-slate-50">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
