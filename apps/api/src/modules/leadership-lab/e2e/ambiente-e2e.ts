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
  novoParticipante(opcoes?: { nomeDoColaborador?: string }): Promise<PessoaDoE2e>;
  /** Um usuário RH, que não participa dos testes. */
  curador: PessoaDoE2e;
  /** Cria um usuário de qualquer perfil. `escopoGlobal` dá ao RH acesso a todas as operações. */
  criarPessoa(
    papel: "RH" | "ADMIN" | "COMUM",
    opcoes?: { nome?: string; email?: string; escopoGlobal?: boolean }
  ): Promise<PessoaDoE2e>;
  /** Um colaborador que ainda não é participante, em um cargo novo que ainda não está em molde algum. */
  criarColaboradorComCargo(dados: {
    nome: string;
    matricula: string;
    cargo: string;
  }): Promise<{ colaboradorId: string; cargoId: string }>;
  fechar(): Promise<void>;
};

/**
 * Compila o front (só o Vite) para uma pasta temporária, apontando para a API na mesma origem.
 * `modoDeTeste` liga o modo de teste sem login (o padrão do front); desligado, o login é exigido.
 */
function compilarOFront(destino: string, { modoDeTeste }: { modoDeTeste: boolean }): void {
  const raiz = fileURLToPath(new URL("../../../../../../", import.meta.url));
  const env: NodeJS.ProcessEnv = { ...process.env, VITE_API_BASE_URL: "/api/v1" };
  if (modoDeTeste) delete env.VITE_MODO_TESTE_SEM_LOGIN;
  else env.VITE_MODO_TESTE_SEM_LOGIN = "false";
  execFileSync(
    "pnpm",
    ["--filter", "@my-flux/web", "exec", "vite", "build", "--outDir", destino, "--emptyOutDir"],
    { cwd: raiz, env, stdio: "pipe" }
  );
}

/** O front compilado na mesma origem da API, com o fallback do React Router (como em app.ts). */
async function publicarOFront(app: FastifyInstance, pastaDoFront: string): Promise<string> {
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
  return `http://127.0.0.1:${port}`;
}

export async function subirAmbienteE2e(): Promise<AmbienteE2e> {
  const pastaDoFront = mkdtempSync(join(tmpdir(), "lab-e2e-web-"));
  compilarOFront(pastaDoFront, { modoDeTeste: false });

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

  const url = await publicarOFront(app, pastaDoFront);

  const passwordHash = hashPassword(SENHA);
  let contador = 0;
  const novoParticipante: AmbienteE2e["novoParticipante"] = async (opcoes = {}) => {
    contador += 1;
    const email = `participante${contador}@e2e.local`;
    const funcao = await criarCargoComMolde(banco.db.client, "supervisor");
    await criarParticipante(banco.db.client, banco.base, {
      usuario: { email, name: `Participante ${contador}`, passwordHash },
      colaborador: {
        functionId: funcao,
        ...(opcoes.nomeDoColaborador ? { name: opcoes.nomeDoColaborador } : {})
      }
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

  const roles: Record<string, string> = { RH: roleRh, COMUM: banco.base.roleId };
  const criarPessoa: AmbienteE2e["criarPessoa"] = async (papel, opcoes = {}) => {
    contador += 1;
    if (!roles[papel]) {
      roles[papel] = await inserir(banco.db.client, '"Role"', {
        id: crypto.randomUUID(),
        name: papel,
        level: papel === "ADMIN" ? 3 : 1,
        description: papel,
        updatedAt: new Date().toISOString()
      });
    }
    const email = opcoes.email ?? `${papel.toLowerCase()}${contador}@e2e.local`;
    const id = await criarUsuario(banco.db.client, banco.base, {
      email,
      name: opcoes.nome ?? `${papel} ${contador}`,
      passwordHash,
      roleId: roles[papel]
    });
    if (opcoes.escopoGlobal) {
      await inserir(banco.db.client, '"UserScope"', {
        id: crypto.randomUUID(),
        userId: id,
        isGlobal: true,
        updatedAt: new Date().toISOString()
      });
    }
    return { email, senha: SENHA };
  };

  const criarColaboradorComCargo: AmbienteE2e["criarColaboradorComCargo"] = async (dados) => {
    const cargoId = await inserir(banco.db.client, '"JobFunction"', {
      id: crypto.randomUUID(),
      name: dados.cargo,
      updatedAt: new Date().toISOString()
    });
    const colaboradorId = await criarColaborador(banco.db.client, banco.base, {
      name: dados.nome,
      identifier: dados.matricula,
      functionId: cargoId
    });
    return { colaboradorId, cargoId };
  };

  return {
    url,
    ia,
    banco,
    participante: await novoParticipante(),
    novoParticipante,
    curador: { email: emailDoCurador, senha: SENHA },
    criarPessoa,
    criarColaboradorComCargo,
    fechar: async () => {
      await app.close();
      await servico.fechar();
      await prisma.$disconnect();
      await encerrarBanco(banco);
      rmSync(pastaDoFront, { recursive: true, force: true });
    }
  };
}

// ---------------------------------------------------------------------------
// O modo demonstração, como roda em produção
// ---------------------------------------------------------------------------

/** A senha que o seed do repositório dá às contas de demonstração. */
const SENHA_DO_SEED = "ChangeMe!2026";

export type AmbienteDeDemonstracao = {
  url: string;
  /** A conta COMUM do seed, que o modo demonstração transforma em participante. */
  participante: PessoaDoE2e;
  /** A conta DEV do seed: é quem entra sozinho no modo de teste sem login. */
  dev: PessoaDoE2e;
  fechar(): Promise<void>;
};

/**
 * Sobe o servidor como em produção com LAB_MODO_DEMO=true e SEM serviço de IA: nenhuma injeção, o
 * módulo se monta pelo ambiente e prepara o participante sozinho. O front sai com o modo de teste
 * sem login ligado (o padrão), como o que está publicado.
 */
export async function subirAmbienteDeDemonstracao(): Promise<AmbienteDeDemonstracao> {
  const pastaDoFront = mkdtempSync(join(tmpdir(), "lab-e2e-demo-web-"));
  compilarOFront(pastaDoFront, { modoDeTeste: true });

  const banco = await prepararBanco();
  const passwordHash = hashPassword(SENHA_DO_SEED);
  // Os usuários do seed existem ANTES de o servidor subir: é na subida que o participante é preparado.
  const roleDev = await inserir(banco.db.client, '"Role"', {
    id: crypto.randomUUID(),
    name: "DEV",
    level: 4,
    description: "DEV",
    updatedAt: new Date().toISOString()
  });
  await criarUsuario(banco.db.client, banco.base, {
    email: "comum@myflux.local",
    name: "Comum",
    passwordHash
  });
  await criarUsuario(banco.db.client, banco.base, {
    email: "dev@myflux.local",
    name: "Dev",
    passwordHash,
    roleId: roleDev
  });

  process.env.DATABASE_URL = banco.db.url;
  process.env.LAB_MODO_DEMO = "true";
  delete process.env.LAB_IA_URL;
  const { buildApp } = await import("../../../app.js");
  const { prisma } = await import("../../../lib/prisma.js");
  const app = await buildApp();
  const url = await publicarOFront(app, pastaDoFront);

  return {
    url,
    participante: { email: "comum@myflux.local", senha: SENHA_DO_SEED },
    dev: { email: "dev@myflux.local", senha: SENHA_DO_SEED },
    fechar: async () => {
      await app.close();
      await prisma.$disconnect();
      await encerrarBanco(banco);
      delete process.env.LAB_MODO_DEMO;
      rmSync(pastaDoFront, { recursive: true, force: true });
    }
  };
}
