import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// A configuração dos testes fica à parte do vite.config.ts: este arquivo não entra no `tsc -b` do
// build (o vite.config.ts continua sendo a configuração do app, sem o bloco `test`).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // As animações do Motion pulam para o fim nos testes (veja o arquivo).
      setupFiles: ["./src/test/setup.ts"]
    }
  })
);
