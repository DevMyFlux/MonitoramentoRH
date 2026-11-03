// Infraestrutura dos testes de integração do Leadership Lab.
//
// Cada suíte cria um banco novo e descartável num servidor PostgreSQL apontado por
// LAB_TEST_DATABASE_URL (qualquer banco do servidor serve; o usuário precisa poder
// criar bancos). As migrações são lidas de prisma/migrations e executadas na ordem,
// com o driver `pg`, porque o Prisma não executa arquivos com vários comandos.
//
// Sem LAB_TEST_DATABASE_URL as suítes são ignoradas. Como subir um servidor local:
//   node scripts/local-db.mjs   (banco embutido, porta 55432)
//   LAB_TEST_DATABASE_URL=postgresql://my_flux:my_flux_local@127.0.0.1:55432/postgres pnpm --filter @my-flux/api test
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const adminDatabaseUrl = process.env.LAB_TEST_DATABASE_URL;
export const integrationEnabled = Boolean(adminDatabaseUrl);

const migrationsDir = fileURLToPath(new URL("../../../../prisma/migrations/", import.meta.url));

export type Migration = { name: string; up: string; down: string | null };

export function readMigrations(): Migration[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      name,
      up: readFileSync(`${migrationsDir}${name}/migration.sql`, "utf8"),
      down: readOptional(`${migrationsDir}${name}/down.sql`)
    }));
}

function readOptional(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export type TestDatabase = {
  /** Cliente conectado ao banco descartável. */
  client: pg.Client;
  /** URL do banco descartável, para o Prisma. */
  url: string;
  /** Servidor inteiro (banco de manutenção), para criar papéis. */
  admin: pg.Client;
  drop(): Promise<void>;
};

/** Cria um banco vazio. Não aplica migrações: veja applyMigrations. */
export async function createTestDatabase(): Promise<TestDatabase> {
  if (!adminDatabaseUrl) throw new Error("LAB_TEST_DATABASE_URL não definido.");
  const name = `lab_test_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: adminDatabaseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);

  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();

  return {
    client,
    url: url.toString(),
    admin,
    async drop() {
      await client.end().catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    }
  };
}

/** Aplica as migrações em ordem; `until` (inclusivo) permite parar antes das do Lab. */
export async function applyMigrations(client: pg.Client, until?: string): Promise<void> {
  for (const migration of readMigrations()) {
    await client.query(migration.up);
    if (migration.name === until) return;
  }
}

/** Pares "schema.tabela" (tabelas e views), ordenados, para comparar estados do banco. */
export async function listRelations(client: pg.Client, schema: string): Promise<string[]> {
  const { rows } = await client.query<{ relation: string }>(
    `SELECT table_schema || '.' || table_name AS relation
       FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`,
    [schema]
  );
  return rows.map((row) => row.relation);
}

/** Códigos SQLSTATE usados pelos testes de integridade. */
export const sqlState = {
  uniqueViolation: "23505",
  /** Inserir referência a linha inexistente. */
  foreignKeyViolation: "23503",
  /** Apagar linha que ainda é referenciada (ON DELETE RESTRICT). */
  restrictViolation: "23001",
  checkViolation: "23514",
  insufficientPrivilege: "42501"
} as const;

/**
 * Executa um comando que deve falhar e devolve o erro do Postgres (código e restrição).
 * Os testes usam autocommit: um comando que falha não deixa nada para trás.
 */
export async function expectDbError(
  client: pg.Client,
  sql: string,
  params: unknown[] = []
): Promise<{ code: string; constraint: string | undefined; message: string }> {
  try {
    await client.query(sql, params);
  } catch (error) {
    const dbError = error as pg.DatabaseError;
    return { code: dbError.code ?? "", constraint: dbError.constraint, message: dbError.message };
  }
  throw new Error(`Era esperado erro do banco, mas o comando passou: ${sql}`);
}
