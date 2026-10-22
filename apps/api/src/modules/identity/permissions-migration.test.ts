import { readFileSync } from "node:fs";
import { defaultRolePermissions, permissionCatalog, type Role } from "@my-flux/shared";
import { describe, expect, it } from "vitest";

/**
 * O catálogo de permissões existe em dois lugares: o código (packages/shared/src/permissions.ts) e a migração que
 * popula o banco. Se um mudar sem o outro, o sistema liberaria ou negaria acesso por engano — este teste impede.
 */
const sql = readFileSync(
  new URL(
    "../../../prisma/migrations/0016_permissions_and_approver/migration.sql",
    import.meta.url
  ),
  "utf8"
);

describe("migração 0016 × catálogo de permissões", () => {
  it("cria exatamente as permissões do catálogo", () => {
    const block = sql.split('INSERT INTO "Permission"')[1]!.split("ON CONFLICT")[0]!;
    const codes = [...block.matchAll(/gen_random_uuid\(\), '([a-z]+:[a-z]+)'/g)].map((m) => m[1]!);
    expect(codes.sort()).toEqual(permissionCatalog.map((p) => p.code).sort());
  });

  it("concede a cada perfil exatamente a matriz padrão", () => {
    const block = sql.split('JOIN "Permission" p ON')[1]!.split("ON CONFLICT")[0]!;
    const pairs = [...block.matchAll(/\('([A-Z]+)', '([a-z]+:[a-z]+)'\)/g)].map(
      (m) => `${m[1]}|${m[2]}`
    );
    const expected = (Object.keys(defaultRolePermissions) as Role[]).flatMap((role) =>
      defaultRolePermissions[role].map((code) => `${role}|${code}`)
    );
    expect(pairs.sort()).toEqual(expected.sort());
  });

  it("a migração é idempotente (todo INSERT tem ON CONFLICT ou NOT EXISTS)", () => {
    const inserts = sql.split("INSERT INTO").slice(1);
    expect(inserts.length).toBeGreaterThanOrEqual(4);
    for (const insert of inserts) expect(insert).toMatch(/ON CONFLICT|NOT EXISTS/);
  });
});
