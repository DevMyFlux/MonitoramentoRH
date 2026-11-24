/* IDM local: criação, escopo e bloqueio de usuários respeitando a hierarquia. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, CircleCheck, Plus, RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { AvisoTemporario, Button, EmptyState, ErrorState, TituloDePagina } from "../components/ui";
import { request, text, type Row } from "../features/my-flux/client";

const demoOperation = "55555555-5555-4555-8555-555555555555";
const rank: Record<string, number> = { DEV: 4, ADMIN: 3, RH: 2, COMUM: 1 };
const allRoles = ["DEV", "ADMIN", "RH", "COMUM"];
const rankOf = (role: string) => rank[role] ?? 0;

type CurrentUser = { id: string; name: string; role: string };

export function UsersPage() {
  const [actor, setActor] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [operationId, setOperationId] = useState(demoOperation);
  const [role, setRole] = useState("COMUM");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("ChangeMe!2026");
  const [global, setGlobal] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const roles = useMemo(
    () =>
      allRoles.filter(
        (candidate) => actor?.role === "DEV" || rankOf(actor?.role ?? "") > rankOf(candidate)
      ),
    [actor?.role]
  );

  async function load() {
    setError("");
    try {
      const [me, list, ops] = await Promise.all([
        request<{ user: CurrentUser }>("/auth/me"),
        request<Row[]>("/users"),
        request<Row[]>("/operations")
      ]);
      setActor(me.user);
      setUsers(list);
      setOperations(ops);
      if (ops.length && !ops.some((op) => op.id === operationId)) setOperationId(ops[0]!.id);
      const available = allRoles.filter(
        (candidate) => me.user.role === "DEV" || rankOf(me.user.role) > rankOf(candidate)
      );
      if (available.length && !available.includes(role)) setRole(available.at(-1) ?? "COMUM");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o IDM.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // A janela de criação fecha com Esc, como as demais do sistema.
  useEffect(() => {
    if (!open) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [open]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    try {
      const scopes =
        role === "DEV" && global
          ? [{ isGlobal: true, companyId: null, operationId: null, unitId: null }]
          : [{ isGlobal: false, companyId: null, operationId, unitId: null }];
      const result = await request<{ user: Row }>("/users", "POST", {
        name,
        email,
        password,
        role,
        scopes
      });
      setUsers((current) => [result.user, ...current]);
      setName("");
      setEmail("");
      setPassword("ChangeMe!2026");
      setOpen(false);
      setNotice("Usuário criado com escopo e registro de auditoria.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    }
  }

  async function toggle(user: Row) {
    try {
      const result = await request<{ id: string; isActive: boolean }>(
        `/users/${user.id}/status`,
        "PATCH",
        { isActive: user.isActive !== true }
      );
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, isActive: result.isActive } : item))
      );
      setNotice(result.isActive ? "Usuário reativado." : "Usuário bloqueado e sessões revogadas.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível alterar o status.");
    }
  }

  return (
    <div className="space-y-6">
      <TituloDePagina
        etiqueta="MY FLUX · Gestão"
        titulo="Usuários e perfis"
        descricao={`${actor ? `Você está conectado como ${actor.role}.` : "Carregando seu perfil..."} A hierarquia e o escopo são validados pela API.`}
        acoes={
          <>
            <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
              Atualizar
            </Button>
            <Button
              icon={<Plus size={16} />}
              onClick={() => setOpen(true)}
              disabled={!roles.length}
            >
              Novo usuário
            </Button>
          </>
        }
      />
      <AvisoTemporario mensagem={notice} aoFechar={() => setNotice("")} />
      {error && (
        <ErrorState
          title="Não foi possível carregar os usuários"
          description={error}
          onRetry={() => void load()}
        />
      )}
      <div className="overflow-hidden rounded-mf-cartao border border-mf-linha bg-mf-cartao shadow-mf-1">
        <div className="flex items-center gap-3 border-b border-mf-linha p-4">
          <ShieldCheck size={17} aria-hidden="true" className="text-mf-primaria" />
          <span className="text-sm text-mf-texto-2">
            Hierarquia: DEV &gt; ADMIN &gt; RH &gt; COMUM
          </span>
          <span className="ml-auto text-xs tabular-nums text-mf-texto-3">
            {users.length} {users.length === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        {users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-mf-fundo text-xs uppercase tracking-wide text-mf-texto-3">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Escopo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mf-linha">
                {users.map((user) => {
                  const scope = (user.scopes as Row[] | undefined)?.[0];
                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-mf-tinta">{text(user.name)}</div>
                        <div className="text-xs text-mf-texto-2">{text(user.email)}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {text((user.role as Row | undefined)?.name ?? user.role)}
                      </td>
                      <td className="px-4 py-3 text-xs text-mf-texto-2">
                        {scope?.isGlobal ? "Global" : text(scope?.operationId ?? "Sem escopo")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${user.isActive === true ? "bg-mf-realce-suave text-mf-primaria" : "bg-mf-perigo-suave text-mf-perigo"}`}
                        >
                          {user.isActive === true ? (
                            <CircleCheck size={12} aria-hidden="true" />
                          ) : (
                            <Ban size={12} aria-hidden="true" />
                          )}
                          {user.isActive === true ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => void toggle(user)}>
                          {user.isActive === true ? "Bloquear" : "Reativar"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : error ? null : (
          <div className="p-4">
            <EmptyState
              title="Nenhum usuário neste escopo"
              description="Os usuários que você pode administrar aparecem aqui. Crie o primeiro com Novo usuário."
            />
          </div>
        )}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-mf-tinta/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            onSubmit={createUser}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-criar-usuario"
            className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-mf-conteiner bg-mf-cartao p-6 shadow-mf-3"
          >
            <div className="flex items-center gap-3">
              <UserCog aria-hidden="true" className="text-mf-primaria" />
              <div>
                <h2
                  id="titulo-criar-usuario"
                  className="font-display text-lg font-bold text-mf-tinta"
                >
                  Criar usuário
                </h2>
                <p className="text-sm text-mf-texto-2">A API impede elevação de perfil e escopo.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-mf-texto">
                Nome
                <input
                  className="mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label className="text-sm font-medium text-mf-texto">
                E-mail
                <input
                  className="mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium text-mf-texto">
                Perfil
                <select
                  className="mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setGlobal(e.target.value === "DEV");
                  }}
                  required
                >
                  {roles.map((candidate) => (
                    <option key={candidate}>{candidate}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-mf-texto">
                Senha inicial
                <input
                  className="mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              {role === "DEV" ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={global}
                    onChange={(e) => setGlobal(e.target.checked)}
                  />{" "}
                  Escopo global de DEV
                </label>
              ) : (
                <label className="text-sm font-medium text-mf-texto sm:col-span-2">
                  Operação
                  <select
                    className="mt-1 block h-11 w-full rounded-mf-controle border border-mf-linha bg-white px-3"
                    value={operationId}
                    onChange={(e) => setOperationId(e.target.value)}
                    required
                  >
                    {operations.map((operation) => (
                      <option value={operation.id} key={operation.id}>
                        {text(operation.name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar e auditar</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
