/* This generic CRUD page intentionally synchronizes remote resources in effects. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import { Button, Input } from "../components/ui";
import { request, text, date, type Row } from "../features/my-flux/client";
import { labels, resources, type Field, type Resource } from "../features/my-flux/resources";

export function ResourcePage({ resourceKey }: { resourceKey: string }) {
  const resource = resources[resourceKey];
  if (!resource)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
        Módulo não encontrado.
      </div>
    );
  return <ResourceContent resource={resource} />;
}
function ResourceContent({ resource }: { resource: Resource }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  const [options, setOptions] = useState<Record<string, Row[]>>({});
  const [form, setForm] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(resource.fields.map((f) => [f.key, f.value ?? ""]))
  );
  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await request<Row[]>(resource.endpoint));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }
  // Loading server data is the synchronization boundary for this resource view.
  useEffect(() => {
    void load();
  }, [resource.endpoint]);
  useEffect(() => {
    if (!open) return;
    void Promise.all(
      resource.fields
        .filter((f) => f.source && !options[f.source])
        .map(async (f) => {
          try {
            const data = await request<Row[]>(f.source!);
            setOptions((current) => ({ ...current, [f.source!]: data }));
          } catch {
            /* resource list will explain unavailable lookup */
          }
        })
    );
  }, [open, resource.fields]);
  const filtered = useMemo(
    () => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())),
    [rows, query]
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      const payload = serializeForm(resource.fields, form);
      const data = await request<Row>(
        editingId ? `${resource.endpoint}/${editingId}` : resource.endpoint,
        editingId ? "PATCH" : "POST",
        payload
      );
      setRows((current) =>
        editingId
          ? current.map((row) => (row.id === editingId ? { ...row, ...data } : row))
          : [data, ...current]
      );
      setOpen(false);
      setEditingId(null);
      setNotice(editingId ? "Alteração salva e auditada." : "Registro salvo e auditado.");
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  function resetForm() {
    setForm(Object.fromEntries(resource.fields.map((f) => [f.key, f.value ?? ""])));
  }
  function startCreate() {
    setFormError("");
    setEditingId(null);
    resetForm();
    setOpen(true);
  }
  function startEdit(row: Row) {
    setFormError("");
    setEditingId(row.id);
    setForm(
      Object.fromEntries(
        resource.fields.map((field) => [field.key, formatFieldValue(field, row[field.key])])
      )
    );
    setOpen(true);
  }
  async function archive(row: Row) {
    if (!window.confirm(`Arquivar "${text(row.name ?? row.title ?? row.code)}"?`)) return;
    try {
      await request<Row>(`${resource.endpoint}/${row.id}`, "DELETE");
      setRows((current) => current.filter((item) => item.id !== row.id));
      setNotice("Registro arquivado e auditado.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Não foi possível arquivar.");
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">GESTÃO DA OPERAÇÃO</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{resource.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{resource.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
            Atualizar
          </Button>
          {resource.editable !== false && (
            <Button icon={<Plus size={16} />} onClick={startCreate}>
              Novo registro
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <div
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search size={17} className="text-slate-400" />
          <input
            aria-label={`Buscar em ${resource.title}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar neste módulo..."
            className="w-full bg-transparent text-sm outline-none"
          />
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
            {filtered.length} registros
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Carregando dados do servidor...</div>
        ) : error ? (
          <div className="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <Search className="mx-auto mb-3 text-slate-300" size={28} />
            <p className="font-medium text-slate-700">
              {query ? "Nenhum resultado para esta busca" : "Ainda não há registros por aqui"}
            </p>
            <p className="mt-2 text-xs">
              {query
                ? "Tente outro termo ou limpe o campo de busca."
                : "Os registros disponíveis para o seu acesso aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {resource.columns.map(([key, label]) => (
                    <th className="whitespace-nowrap px-4 py-3 font-semibold" key={key}>
                      {label}
                    </th>
                  ))}
                  {resource.editable !== false && (
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr className="hover:bg-slate-50" key={row.id}>
                    {resource.columns.map(([key]) => (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700" key={key}>
                        {key === "status" ? (
                          <Status value={row[key]} />
                        ) : key.endsWith("At") ||
                          key.includes("Date") ||
                          key === "validFrom" ||
                          key === "validTo" ? (
                          date(row[key])
                        ) : (
                          text(row[key])
                        )}
                      </td>
                    ))}
                    {resource.editable !== false && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => void archive(row)}>
                            Arquivar
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <dialog
          ref={dialog}
          className="flux-dialog"
          aria-labelledby="resource-form-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setOpen(false);
          }}
        >
          <form onSubmit={submit} className="w-full bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  id="resource-form-title"
                  className="text-xl font-semibold tracking-tight text-slate-950"
                >
                  {editingId ? "Editar registro" : "Novo registro"} · {resource.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Confira os dados antes de salvar. Campos com * são obrigatórios.
                </p>
              </div>
              <button
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                type="button"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <fieldset disabled={saving} className="mt-6 grid gap-5 sm:grid-cols-2">
              {resource.fields.map((field) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  options={field.source ? (options[field.source] ?? []) : []}
                  onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </fieldset>
            {formError && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {formError}
              </p>
            )}
            <div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">
              <Button
                variant="ghost"
                disabled={saving}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar registro"}
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}

function formatFieldValue(field: Field, value: unknown): string | number | boolean {
  if (value == null) return field.value ?? "";
  if (field.type === "date") return new Date(String(value)).toISOString().slice(0, 16);
  if (field.type === "checkbox") return value === true;
  if (field.type === "number") return Number(value);
  return typeof value === "object" ? text(value) : String(value);
}

function serializeForm(
  fields: Field[],
  form: Record<string, string | number | boolean>
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = form[field.key];
      if (field.type === "date" && typeof value === "string" && value) {
        return [field.key, new Date(value).toISOString()];
      }
      if (field.key === "configuration" && typeof value === "string" && value) {
        try {
          return [field.key, JSON.parse(value)];
        } catch {
          return [field.key, value];
        }
      }
      return [field.key, value];
    })
  );
}

function Status({ value }: { value: unknown }) {
  const v = text(value);
  const tone = ["ACTIVE", "APPROVED", "PUBLISHED", "GREEN", "COMMITTED"].includes(v)
    ? "bg-emerald-50 text-emerald-700"
    : ["RED", "EXPIRED", "TERMINATED", "REJECTED"].includes(v)
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {labels[v] ?? v}
    </span>
  );
}
function FieldEditor({
  field,
  value,
  options,
  onChange
}: {
  field: Field;
  value: string | number | boolean | undefined;
  options: Row[];
  onChange: (v: string | number | boolean) => void;
}) {
  const common =
    "rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
  if (field.type === "checkbox")
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  if (field.type === "textarea")
    return (
      <label className="sm:col-span-2 text-sm text-slate-700">
        {field.label}
        {!field.optional && <span className="text-red-500"> *</span>}
        <textarea
          className={`${common} mt-1 min-h-24 w-full`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={!field.optional}
        />
      </label>
    );
  if (field.type === "select") {
    const choices: string[] = field.options ?? options.map((o) => o.id);
    return (
      <label className="text-sm text-slate-700">
        {field.label}
        {!field.optional && <span className="text-red-500"> *</span>}
        <select
          className={`${common} mt-1 w-full`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={!field.optional}
        >
          <option value="">Selecione...</option>
          {choices.map((option) => (
            <option key={option} value={option}>
              {text(labels[option] ?? options.find((o) => o.id === option)?.name ?? option)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <Input
      label={field.label}
      helperText={field.optional ? "Opcional" : undefined}
      type={field.type === "date" ? "datetime-local" : (field.type ?? "text")}
      value={String(value ?? "")}
      onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      required={!field.optional}
    />
  );
}
