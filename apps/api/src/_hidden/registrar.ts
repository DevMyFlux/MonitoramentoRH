// Módulos OCULTOS da API (QLP e Recrutamento). O código fica no repositório, compila e é testado no
// CI, mas as rotas só são registradas quando o módulo está "active" em packages/shared/src/modules.ts.
// Rota não registrada = o mesmo 404 de rota inexistente, para todos os perfis (e para quem nem tem
// sessão). Para religar: trocar `status` do módulo no registro (veja docs/modulos-ocultos.md).
import { MODULOS, type ModuloDef } from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { UserRepository } from "../modules/users/user-repository.js";
import { registerQlpRoutes } from "./qlp/qlp-routes.js";
import { QlpRepository } from "./qlp/qlp-repository.js";
import { registerPositionAssignRoutes } from "./qlp/position-assign-routes.js";
import { registerRecruitmentRoutes } from "./recruitment/recruitment-routes.js";

export type ContextoDosOcultos = {
  users: UserRepository;
  prisma: PrismaClient;
  apiPrefix: string;
  /** Só os testes passam outro registro (para provar que religar traz as rotas de volta). */
  registro?: Readonly<Record<string, ModuloDef>>;
};

/** Os módulos que este registro deixa ligados, entre os que moram em `_hidden/`. */
export function modulosDeApiLigados(
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): string[] {
  return ["qlp", "recrutamento"].filter((id) => registro[id]?.status === "active");
}

export async function registrarModulosOcultos(
  app: FastifyInstance,
  { users, prisma, apiPrefix, registro = MODULOS }: ContextoDosOcultos
): Promise<string[]> {
  const ligados = modulosDeApiLigados(registro);
  if (ligados.includes("qlp")) {
    const qlp = new QlpRepository(prisma);
    await app.register(async (a) => registerQlpRoutes(a, users, qlp), { prefix: apiPrefix });
    await app.register(async (a) => registerPositionAssignRoutes(a, users, prisma), {
      prefix: apiPrefix
    });
  }
  if (ligados.includes("recrutamento")) {
    await app.register(async (a) => registerRecruitmentRoutes(a, users, prisma), {
      prefix: apiPrefix
    });
  }
  return ligados;
}
