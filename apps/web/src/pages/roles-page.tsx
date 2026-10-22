/* Matriz de permissões por perfil. A API valida tudo de novo: aqui só se evita oferecer o que não é permitido. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Lock, RefreshCw, Save } from "lucide-react";
import {
  canEditRolePermissions,
  protectedPermissions,
  type PermissionDefinition,
  type Role
} from "@my-flux/shared";
import { Button } from "../components/ui";
import { usePermissions } from "../features/auth/session-store";
import { errorText, request } from "../features/my-flux/client";

type RoleRow = {
  name: Role;
  label: string;
  description: string;
  permissions: string[];
  activeUsers: number;
};
type RolesResponse = { roles: RoleRow[]; catalog: PermissionDefinition[] };

const sameSet = (a: Iterable<string>, b: Iterable<string>) => {
  const x = [...a].sort().join("|");
  const y = [...b].sort().join("|");
  return x === y;
};

export function RolesPage() {
  const { user } = usePermissions();
  const [data, setData] = useState<RolesResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [justification, setJustification] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const result = await request<RolesResponse>("/roles");
      setData(result);
      setDraft(
        Object.fromEntries(result.roles.map((role) => [role.name, new Set(role.permissions)]))
      );
      setJustification({});
    } catch (e) {
      setError(errorText(e, "Não foi possível carregar os perfis."));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(() => {
    const byGroup = new Map<string, PermissionDefinition[]>();
    for (const permission of data?.catalog ?? []) {
      byGroup.set(permission.group, [...(byGroup.get(permission.group) ?? []), permission]);
    }
    return [...byGroup.entries()];
  }, [data]);

  const myPermissions = new Set(user?.permissions ?? []);

  function toggle(role: RoleRow, code: string) {
    setDraft((current) => {
      const next = new Set(current[role.name]);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...current, [role.name]: next };
    });
  }

  async function save(role: RoleRow) {
    setSaving(role.name);
    setNotice("");
    setError("");
    try {
      const reason = justification[role.name]?.trim();
      await request(`/roles/${role.name}/permissions`, "PUT", {
        permissions: [...(draft[role.name] ?? [])],
        ...(reason ? { justification: reason } : {})
      });
      setNotice(
        `Permissões do perfil ${role.label} salvas. Valem já na próxima ação de cada usuário.`
      );
      await load();
    } catch (e) {
      setError(errorText(e, "Não foi possível salvar as permissões."));
    } finally {
      setSaving(null);
    }
  }

  const roles = data?.roles ?? [];
  const dirtyRoles = roles.filter(
    (role) => draft[role.name] && !sameSet(draft[role.name]!, role.permissions)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            MY FLUX · Acesso
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Perfis e permissões</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Defina o que cada perfil pode fazer. A mudança vale na próxima ação de cada usuário, sem
            precisar entrar de novo. Você só altera perfis abaixo do seu e só concede o que o seu
            próprio perfil possui.
          </p>
        </div>
        <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      {notice && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Permissão</th>
                {roles.map((role) => (
                  <th key={role.name} className="px-3 py-3 text-center">
                    <div>{role.label}</div>
                    <div className="mt-0.5 text-[10px] font-normal normal-case text-slate-400">
                      {role.activeUsers} usuário(s)
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map(([group, permissions]) => (
                <GroupRows key={group} group={group} permissions={permissions}>
                  {(permission) =>
                    roles.map((role) => {
                      const checked = draft[role.name]?.has(permission.code) ?? false;
                      const protectedHere = (protectedPermissions[role.name] ?? []).includes(
                        permission.code as never
                      );
                      const editable = user ? canEditRolePermissions(user.role, role.name) : false;
                      const notMine =
                        !role.permissions.includes(permission.code) &&
                        !myPermissions.has(permission.code);
                      const disabled = !editable || protectedHere || (notMine && !checked);
                      const title = !editable
                        ? "Você não pode alterar este perfil."
                        : protectedHere
                          ? "Esta permissão não pode ser retirada deste perfil."
                          : notMine && !checked
                            ? "Você não pode conceder uma permissão que o seu perfil não possui."
                            : undefined;
                      return (
                        <td key={role.name} className="px-3 py-2 text-center" title={title}>
                          {protectedHere ? (
                            <Lock
                              size={14}
                              className="mx-auto text-slate-400"
                              aria-label="Permissão protegida"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggle(role, permission.code)}
                              aria-label={`${permission.label} — ${role.label}`}
                              className="h-4 w-4 accent-emerald-600 disabled:opacity-40"
                            />
                          )}
                        </td>
                      );
                    })
                  }
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dirtyRoles.map((role) => (
        <div key={role.name} className="rounded border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Alterações pendentes no perfil {role.label}
          </p>
          <label className="mt-2 block text-xs text-amber-900">
            Justificativa (opcional, fica na auditoria)
            <input
              className="mt-1 w-full rounded border border-amber-200 bg-white p-2 text-sm"
              value={justification[role.name] ?? ""}
              maxLength={500}
              onChange={(e) =>
                setJustification((current) => ({ ...current, [role.name]: e.target.value }))
              }
            />
          </label>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              icon={<Save size={14} />}
              disabled={saving === role.name}
              onClick={() => void save(role)}
            >
              {saving === role.name ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setDraft((current) => ({ ...current, [role.name]: new Set(role.permissions) }))
              }
            >
              Descartar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupRows({
  group,
  permissions,
  children
}: {
  group: string;
  permissions: PermissionDefinition[];
  children: (permission: PermissionDefinition) => React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <td
          colSpan={99}
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {group}
        </td>
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.code}>
          <td className="px-4 py-2">
            <div className="font-medium text-slate-800">{permission.label}</div>
            <div className="text-xs text-slate-500">{permission.description}</div>
          </td>
          {children(permission)}
        </tr>
      ))}
    </>
  );
}
