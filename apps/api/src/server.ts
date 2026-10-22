import "./load-env.js";
import { buildApp } from "./app.js";
import { assertAuthConfiguration } from "./modules/auth/token-service.js";

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";

// Em produção o servidor não sobe sem segredos próprios de assinatura (ver token-service.ts).
const configurationWarnings = assertAuthConfiguration();

const app = await buildApp();
for (const warning of configurationWarnings) app.log.warn(warning);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
