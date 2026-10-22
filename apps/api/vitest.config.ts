import { defineConfig } from "vitest/config";

// Testes de INTEGRAÇÃO (`*.integration.test.ts`) usam um Postgres de verdade e só rodam quando TEST_DATABASE_URL está
// definida (ex.: postgresql://usuario:senha@127.0.0.1:5432/my_flux_test). Sem ela eles são pulados e `pnpm test`
// continua não precisando de banco. O banco de teste NUNCA deve ser o de desenvolvimento: os testes criam dados.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    ...(testDatabaseUrl
      ? {
          env: { DATABASE_URL: testDatabaseUrl },
          globalSetup: ["./src/test/global-setup.ts"],
          // os arquivos de integração compartilham o mesmo banco: rodam um de cada vez
          fileParallelism: false
        }
      : {})
  }
});
