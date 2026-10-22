import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Prepara o banco de teste uma vez por execução: aplica TODAS as migrações (isso já valida o SQL de verdade) e roda a
 * seed base (perfis, permissões e usuários de demonstração). Os dois passos são idempotentes.
 */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const cwd = fileURLToPath(new URL("../../", import.meta.url)); // apps/api
  const env = { ...process.env, DATABASE_URL: url };
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd,
    env,
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
    cwd,
    env,
    stdio: "pipe"
  });
}
