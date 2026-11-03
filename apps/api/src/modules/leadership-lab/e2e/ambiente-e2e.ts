// Leadership Lab — o ambiente do teste de ponta a ponta no navegador. SÓ para testes.
//
// Sobe, de verdade: um PostgreSQL descartável com as migrações, o servidor da API (buildApp) com o
// front compilado servido pela mesma origem (como em produção), e o serviço de IA falso por HTTP,
// com o cliente HTTP real entre a API e ele. O navegador (Playwright) só enxerga o endereço.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { hashPassword } from "../../auth/password-service.js";
import {
  criarCargoComMolde,
  criarColaborador,
  criarParticipante,
  criarUsuario,
  inserir
} from "../db/test-fixtures.js";
import {
  type Banco,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { ClienteIaHttp } from "../motor/cliente-ia-http.js";
import { IaFalsa } from "../motor/ia-falsa.js";
import { type ServicoIaFalso, subirServicoIaFalso } from "../motor/servico-ia-falso.js";

export const SENHA = "Senha-de-teste-1!";
const TOKEN_DO_SERVICO = "token-de-servico-do-e2e";

export type PessoaDoE2e = { email: string; senha: string };

export type AmbienteE2e = {
  /** A origem única: o front e a API, como em produção. */
  url: string;
  ia: IaFalsa;
  banco: Banco;
  /** Um participante (COMUM) ligado a um colaborador de cargo de supervisor, com o termo por aceitar. */
  participante: PessoaDoE2e;
  /** Cria outro participante (COMUM) com o seu cargo, para testes independentes. */
  novoParticipante(): Promise<PessoaDoE2e>;
  /** Um usuário RH, que não participa dos testes. */
  curador: PessoaDoE2e;
  fechar(): Promise<void>;
};

/** Compila o front (só o Vite) para uma pasta temporária, apontando para a API na mesma origem. */
function compilarOFront(destino: string): void {
  const raiz = fileURLToPath(new URL("../../../../../../", import.meta.url));
  execFileSync(
    "pnpm",
    ["--filter", "@my-flux/web", "exec", "vite", "build", "--outDir", destino, "--emptyOutDir"],
    {
      cwd: raiz,
      env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_MODO_TESTE_SEM_LOGIN: "false" },
      stdio: "pipe"
    }
  );
}

export async function subirAmbienteE2e(): Promise<AmbienteE2e> {
  const pastaDoFront = mkdtempSync(join(tmpdir(), "lab-e2e-web-"));
  compilarOFront(pastaDoFront);

  const banco = await prepararBanco();
  // A conexão do app (lib/prisma) é criada na primeira importação, lendo DATABASE_URL.
  process.env.DATABASE_URL = banco.db.url;
  const { buildApp } = await import("../../../app.js");
  const { prisma } = await import("../../../lib/prisma.js");

  const ia = new IaFalsa();
  const servico: ServicoIaFalso = await subirServicoIaFalso(ia, TOKEN_DO_SERVICO);
  const app: FastifyInstance = await buildApp({
    lab: {
      ia: new ClienteIaHttp({ baseUrl: servico.url, token: TOKEN_DO_SERVICO, timeoutMs: 5000 }),
      config: configDeTeste()
    }
  });

  // O front compilado na mesma origem, com o fallback das rotas do React Router (como em app.ts).
  await app.register(fastifyStatic, { root: pastaDoFront });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api")) {
      return reply
        .status(404)
        .send({ code: "NOT_FOUND", message: "Rota nao encontrada.", details: {} });
    }
    return reply.sendFile("index.html");
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;

  const passwordHash = hashPassword(SENHA);
  let contador = 0;
  const novoParticipante = async (): Promise<PessoaDoE2e> => {
    contador += 1;
    const email = `participante${contador}@e2e.local`;
    const funcao = await criarCargoComMolde(banco.db.client, "supervisor");
    await criarParticipante(banco.db.client, banco.base, {
      usuario: { email, name: `Participante ${contador}`, passwordHash },
      colaborador: { functionId: funcao }
    });
    return { email, senha: SENHA };
  };

  const roleRh = await inserir(banco.db.client, '"Role"', {
    id: crypto.randomUUID(),
    name: "RH",
    level: 2,
    description: "RH",
    updatedAt: new Date().toISOString()
  });
  const emailDoCurador = "curador@e2e.local";
  await criarUsuario(banco.db.client, banco.base, {
    email: emailDoCurador,
    name: "Curador",
    passwordHash,
    roleId: roleRh
  });
  // O curador não precisa de colaborador, mas o fixture é reaproveitado por quem quiser um.
  void criarColaborador;

  return {
    url: `http://127.0.0.1:${port}`,
    ia,
    banco,
    participante: await novoParticipante(),
    novoParticipante,
    curador: { email: emailDoCurador, senha: SENHA },
    fechar: async () => {
      await app.close();
      await servico.fechar();
      await prisma.$disconnect();
      await encerrarBanco(banco);
      rmSync(pastaDoFront, { recursive: true, force: true });
    }
  };
}
