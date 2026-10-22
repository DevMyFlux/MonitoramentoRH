/* Usuários: criação, perfil, escopo, desativação e desbloqueio, respeitando a hierarquia. A API valida tudo no servidor. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Plus, RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { roleLabels, roleRank, type Role } from "@my-flux/shared";
import { Button } from "../components/ui";
import { usePermissions } from "../features/auth/session-store";
import { errorText, request, text, type Row } from "../features/my-flux/client";

const demoOperation = "55555555-5555-4555-8555-555555555555";
const allRoles = Object.keys(roleRank) as Role[];

/** Senha aleatória forte (16 caracteres), mostrada uma única vez ao administrador — não existe senha inicial fixa. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function UsersPage() {
  const { user: actor, can } = usePermissions();
  const [users, setUsers] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [operationId, setOperationId] = useState(demoOperation);
  const [role, setRole] = useState<Role>("COMUM");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [global, setGlobal] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Perfis que este usuário pode atribuir: só abaixo do seu (o DEV, qualquer um). A API repete a regra.
  const assignable = useMemo(
    () => allRoles.filter((candidate) => actor?.role === "DEV" || (actor ? roleRank[actor.role] > roleRank[candidate] : false)),
    [actor?.role]
  );
  const canManage = (target: Row) => {
    const targetRole = text((target.role as Row | undefined)?.name ?? target.role) as Role;
    return Boolean(actor) && target.id !== actor?.id && (actor?.role === "DEV" || roleRank[actor!.role] > (roleRank[targetRole] ?? 99));
  };

  async function load() {
    setError("");
    try {
      const [list, ops] = await Promise.all([request<Row[]>("/users"), request<Row[]>("/operations")]);
      setUsers(list);
      setOperations(ops);
      if (ops.length && !ops.some((op) => op.id === operationId)) setOperationId(ops[0]!.id);
    } catch (e) {
      setError(errorText(e, "Não foi possível carregar os usuários."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (assignable.length && !assignable.includes(role)) setRole(assignable.at(-1) ?? "COMUM");
  }, [assignable]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    try {
      const scopes =
        role === "DEV" && global
          ? [{ isGlobal: true, companyId: null, operationId: null, unitId: null }]
          : [{ isGlobal: false, companyId: null, operationId, unitId: null }];
      await request<{ user: Row }>("/users", "POST", { name, email, password, role, scopes });
      setName("");
      setEmail("");
      setPassword("");
      setOpen(false);
      setNotice("Usuário criado. Repasse a senha inicial por um canal seguro e peça que a pessoa a troque.");
      await load();
    } catch (e) {
      setNotice(errorText(e, "Não foi possível criar o usuário."));
    }
  }

  async function toggle(user: Row) {
    try {
      const result = await request<{ id: string; isActive: boolean }>(`/users/${user.id}/status`, "PATCH", {
        isActive: user.isActive !== true
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, isActive: result.isActive } : item)));
      setNotice(result.isActive ? "Usuário reativado." : "Usuário desativado e sessões revogadas.");
    } catch (e) {
      setNotice(errorText(e, "Não foi possível alterar a situação."));
    }
  }

  async function changeRole(user: Row, next: Role) {
    const current = text((user.role as Row | undefined)?.name ?? user.role) as Role;
    if (next === current) return;
    if (!window.confirm(`Mudar o perfil de ${text(user.name)} de ${roleLabels[current]} para ${roleLabels[next]}? A pessoa precisará entrar novamente.`)) return;
    try {
      await request(`/users/${user.id}/role`, "PATCH", { role: next });
      setNotice(`Perfil de ${text(user.name)} alterado para ${roleLabels[next]}.`);
      await load();
    } catch (e) {
      setNotice(errorText(e, "Não foi possível alterar o perfil."));
    }
  }

  async function unlock(user: Row) {
    try {
      await request(`/users/${user.id}/unlock`, "POST");
      setNotice(`Conta de ${text(user.name)} desbloqueada.`);
      await load();
    } catch (e) {
      setNotice(errorText(e, "Não foi possível desbloquear a conta."));
    }
  }

  const situation = (user: Row) => {
    if (user.isActive !== true) return { label: "Desativado", tone: "bg-red-50 text-red-700" };
    if (user.isLocked === true) {
      const until = new Date(String(user.lockedUntil)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return { label: `Bloqueado até ${until}`, tone: "bg-amber-50 text-amber-800" };
    }
    return { label: "Ativo", tone: "bg-emerald-50 text-emerald-700" };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">MY FLUX · Acesso</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Usuários e perfis</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {actor ? `Você está conectado como ${roleLabels[actor.role]}.` : "Carregando seu perfil..."} A hierarquia, as
            permissões e o escopo são validados pela API.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
            Atualizar
          </Button>
          {can("users:create") && (
            <Button icon={<Plus size={16} />} onClick={() => setOpen(true)} disabled={!assignable.length}>
              Novo usuário
            </Button>
          )}
        </div>
      </div>
      {notice && <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <ShieldCheck size={17} className="text-emerald-600" />
          <span className="text-sm text-slate-600">Desenvolvedor &gt; Administrador &gt; RH = Aprovador &gt; Comum</span>
          <span className="ml-auto text-xs text-slate-400">{users.length} usuários</span>
        </div>
        {users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Escopo</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const scope = (user.scopes as Row[] | undefined)?.[0];
                  const current = text((user.role as Row | undefined)?.name ?? user.role) as Role;
                  const state = situation(user);
                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{text(user.name)}</div>
                        <div className="text-xs text-slate-500">{text(user.email)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {canManage(user) && can("users:manage") ? (
                          <select
                            aria-label={`Perfil de ${text(user.name)}`}
                            className="rounded border border-slate-200 bg-white p-1.5 text-sm font-semibold"
                            value={current}
                            onChange={(e) => void changeRole(user, e.target.value as Role)}
                          >
                            {[...new Set([current, ...assignable])].map((candidate) => (
                              <option key={candidate} value={candidate} disabled={!assignable.includes(candidate)}>
                                {roleLabels[candidate]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-semibold">{roleLabels[current] ?? current}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {scope?.isGlobal ? "Global" : text(scope?.operationId ?? "Sem escopo")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs ${state.tone}`}>{state.label}</span>
                      </td>
                      <td className="space-x-1 px-4 py-3 text-right">
                        {user.isLocked === true && canManage(user) && (
                          <Button size="sm" variant="ghost" icon={<KeyRound size={14} />} onClick={() => void unlock(user)}>
                            Desbloquear
                          </Button>
                        )}
                        {canManage(user) && (
                          <Button size="sm" variant="ghost" onClick={() => void toggle(user)}>
                            {user.isActive === true ? "Desativar" : "Reativar"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-sm text-slate-500">Nenhum usuário disponível neste escopo.</div>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={createUser} className="w-full max-w-xl rounded bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <UserCog className="text-emerald-600" />
              <div>
                <h2 className="font-semibold">Criar usuário</h2>
                <p className="text-sm text-slate-500">A API impede elevação de perfil e de escopo.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Nome
                <input className="mt-1 w-full rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </label>
              <label className="text-sm">
                E-mail
                <input className="mt-1 w-full rounded border p-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="text-sm">
                Perfil
                <select
                  className="mt-1 w-full rounded border p-2"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as Role);
                    setGlobal(e.target.value === "DEV");
                  }}
                  required
                >
                  {assignable.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {roleLabels[candidate]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <label htmlFor="new-user-password">Senha inicial (mín. 12 caracteres)</label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="new-user-password"
                    className="w-full rounded border p-2 font-mono text-xs"
                    type="text"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPassword(generatePassword())}>
                    Gerar
                  </Button>
                </div>
              </div>
              {role === "DEV" ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} /> Acesso a todas as unidades (escopo global)
                </label>
              ) : (
                <label className="text-sm sm:col-span-2">
                  Operação
                  <select className="mt-1 w-full rounded border p-2" value={operationId} onChange={(e) => setOperationId(e.target.value)} required>
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
