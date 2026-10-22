import { readdirSync, readFileSync } from "node:fs";
import { defaultRolePermissions, permissionCatalog, type Role } from "@my-flux/shared";
import { describe, expect, it } from "vitest";

/**
 * O catálogo de permissões existe em dois lugares: o código (packages/shared/src/permissions.ts) e as migrações que
 * populam o banco. Se um mudar sem o outro, o sistema liberaria ou negaria acesso por engano — estes testes impedem.
 *
 * As permissões chegam em mais de uma migração (0016 e as seguintes que só ACRESCENTAM). O catálogo completo é a
 * soma de todas elas; por isso cada migração é lida e as somas são comparadas com o código.
 */
const migrationsDir = new URL("../../../prisma/migrations/", import.meta.url);
const migrationFolders = [
  "0016_permissions_and_approver",
  ...readdirSync(migrationsDir).filter((name) => /^00(2\d|[3-9]\d)_.*permission/.test(name))
].sort();

function sqlOf(folder: string): string {
  return readFileSync(new URL(`${folder}/migration.sql`, migrationsDir), "utf8");
}

function permissionCodesIn(sql: string): string[] {
  if (!sql.includes('INSERT INTO "Permission"')) return [];
  const block = sql.split('INSERT INTO "Permission"')[1]!.split("ON CONFLICT")[0]!;
  return [...block.matchAll(/gen_random_uuid\(\), '([a-z_]+:[a-z_]+)'/g)].map((m) => m[1]!);
}

function rolePairsIn(sql: string): string[] {
  if (!sql.includes('JOIN "Permission" p ON')) return [];
  const block = sql.split('JOIN "Permission" p ON')[1]!.split("ON CONFLICT")[0]!;
  return [...block.matchAll(/\('([A-Z]+)', '([a-z_]+:[a-z_]+)'\)/g)].map((m) => `${m[1]}|${m[2]}`);
}

describe("migrações de permissões × catálogo", () => {
  it("as migrações de permissões existentes são as esperadas (0016 e 0020 em diante)", () => {
    expect(migrationFolders).toContain("0016_permissions_and_approver");
    expect(migrationFolders).toContain("0020_legacy_modules_permissions");
  });

  it("juntas, criam exatamente as permissões do catálogo, sem repetir nenhuma", () => {
    const codes = migrationFolders.flatMap((folder) => permissionCodesIn(sqlOf(folder)));
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual(permissionCatalog.map((p) => p.code).sort());
  });

  it("juntas, concedem a cada perfil exatamente a matriz padrão", () => {
    const pairs = migrationFolders.flatMap((folder) => rolePairsIn(sqlOf(folder)));
    expect(new Set(pairs).size).toBe(pairs.length);
    const expected = (Object.keys(defaultRolePermissions) as Role[]).flatMap((role) =>
      defaultRolePermissions[role].map((code) => `${role}|${code}`)
    );
    expect([...pairs].sort()).toEqual(expected.sort());
  });

  it("cada migração é idempotente (todo INSERT tem ON CONFLICT ou NOT EXISTS)", () => {
    for (const folder of migrationFolders) {
      const inserts = sqlOf(folder).split("INSERT INTO").slice(1);
      expect(inserts.length).toBeGreaterThanOrEqual(2);
      for (const insert of inserts) expect(insert, folder).toMatch(/ON CONFLICT|NOT EXISTS/);
    }
  });

  it("a 0020 é aditiva: não remove nem altera nada", () => {
    const sql = sqlOf("0020_legacy_modules_permissions");
    expect(sql).not.toMatch(/\b(DELETE|DROP|TRUNCATE|UPDATE|ALTER)\b/i);
  });
});
