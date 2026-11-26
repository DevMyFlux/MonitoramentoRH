// O teste do Lab por cenários, de ponta a ponta no navegador (Chromium, via Playwright): uma pessoa
// COMUM entra, faz a trilha de 3 cenários PELO TECLADO (abertura, 5 perguntas dentro do quadro, tela
// cheia, desfecho de cada cenário), recarrega no meio e retoma na pergunta certa, e chega ao resultado.
// Também confere que o menu do COMUM tem só o Leadership Lab e que /treinamentos o leva para o Lab.
//
// Sobe a API de verdade, o PostgreSQL de verdade (banco descartável) e o front compilado na mesma
// origem, com login exigido. Só roda quando pedido:
//
//   LAB_E2E=1 LAB_TEST_DATABASE_URL=postgresql://... pnpm --filter @my-flux/api test:e2e
//
// LAB_E2E_SHOTS=<pasta> salva capturas; LAB_E2E_CHROMIUM=<exe> usa esse Chromium.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../auth/password-service.js";
import { createAccessToken } from "../../auth/token-service.js";
import { integrationEnabled } from "../db/test-database.js";
import { criarParticipante, inserir } from "../db/test-fixtures.js";
import {
  type Banco,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { IaFalsa } from "../motor/ia-falsa.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;
const pastaDeCapturas = process.env.LAB_E2E_SHOTS;
const SENHA = "Senha-de-teste-1!";
const raiz = fileURLToPath(new URL("../../../../../../", import.meta.url));
const pastaDosCenarios = join(raiz, "docs/cenarios-lab");

type Bruto = {
  id: string;
  title: string;
  publico: string;
  questions: { id: string; alternatives: { taken: boolean }[] }[];
  [chave: string]: unknown;
};
const cenarios = readdirSync(pastaDosCenarios)
  .filter((n) => n.endsWith(".json") && n !== "_indice.json")
  .map((n) => JSON.parse(readFileSync(join(pastaDosCenarios, n), "utf8")) as Bruto);
const porTitulo = new Map(cenarios.map((c) => [c.title, c]));
const doPublico = cenarios.filter((c) => c.publico === "supervisor-manutencao-adm");

/** Compila o front com o Vite chamado pelo Node (não depende de pnpm no PATH), login exigido. */
function compilarOFront(destino: string): void {
  const vite = join(raiz, "apps/web/node_modules/vite/bin/vite.js");
  execFileSync(process.execPath, [vite, "build", "--outDir", destino, "--emptyOutDir"], {
    cwd: join(raiz, "apps/web"),
    env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_MODO_TESTE_SEM_LOGIN: "false" },
    stdio: "pipe"
  });
}

describe.skipIf(!ligado)("o teste do Lab por cenários no navegador", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let url: string;
  let navegador: Browser;
  let pastaDoFront: string;
  let desligarPrisma: () => Promise<void>;
  let email: string;

  async function capturar(page: Page, nome: string) {
    if (pastaDeCapturas)
      await page.screenshot({ path: join(pastaDeCapturas, `trilha-${nome}.png`) });
  }

  async function entrar(page: Page) {
    await page.goto(`${url}/login`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: /Entrar no MyFlux/ }).click();
    await page.waitForURL((endereco) => !endereco.pathname.startsWith("/login"));
  }

  /** Foca o botão e aperta Enter: o caminho do teclado (sem mouse). */
  async function apertar(page: Page, nome: string | RegExp) {
    const botao = page.getByRole(
      "button",
      typeof nome === "string" ? { name: nome, exact: true } : { name: nome }
    );
    await botao.waitFor({ timeout: 20_000 });
    await botao.focus();
    await page.keyboard.press("Enter");
  }

  /** Responde a pergunta aberta pelo teclado: Tab até as alternativas, o número e Enter. */
  async function responder(page: Page, numero: number, alternativa: number) {
    await page.getByText(`Pergunta ${numero} de 5`).waitFor({ timeout: 20_000 });
    await page.keyboard.press("Tab");
    await page.keyboard.press(String(alternativa + 1));
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /Próxima pergunta|Seguir para o desfecho/ }).waitFor();
  }

  /** Joga as perguntas de `de` a 5 do cenário que está na tela, cumprindo todas as decisões. */
  async function jogarPerguntas(page: Page, cenario: Bruto, de: number) {
    for (let numero = de; numero <= 5; numero++) {
      const alternativas = cenario.questions[numero - 1]!.alternatives;
      await responder(
        page,
        numero,
        alternativas.findIndex((a) => a.taken)
      );
      await apertar(page, numero < 5 ? "Próxima pergunta" : "Seguir para o desfecho");
    }
    await apertar(page, "Ver o desfecho");
  }

  beforeAll(async () => {
    if (pastaDeCapturas) mkdirSync(pastaDeCapturas, { recursive: true });
    pastaDoFront = mkdtempSync(join(tmpdir(), "trilha-e2e-web-"));
    compilarOFront(pastaDoFront);
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../../app.js");
    const { prisma } = await import("../../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    app = await buildApp({
      lab: {
        ia: new IaFalsa(),
        config: configDeTeste({ modoDoTeste: "cenarios", cenariosPorTeste: 3 })
      },
      treinamentos: { config: { limiteTentativasDia: null } }
    });
    await app.register(fastifyStatic, { root: pastaDoFront });
    app.setNotFoundHandler((request, reply) =>
      request.raw.url?.startsWith("/api")
        ? reply
            .status(404)
            .send({ code: "NOT_FOUND", message: "Rota nao encontrada.", details: {} })
        : reply.sendFile("index.html")
    );
    await app.listen({ port: 0, host: "127.0.0.1" });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

    // O ADMIN importa os 40 cenários e aprova os 10 do público de supervisores.
    const adminRole = await inserir(banco.db.client, '"Role"', {
      id: crypto.randomUUID(),
      name: "ADMIN",
      level: 3,
      description: "ADMIN",
      updatedAt: new Date().toISOString()
    });
    const adminId = await inserir(banco.db.client, '"User"', {
      id: crypto.randomUUID(),
      email: "admin@e2e.local",
      name: "Admin",
      passwordHash: "x",
      roleId: adminRole,
      updatedAt: new Date().toISOString()
    });
    const token = createAccessToken({
      id: adminId,
      email: "admin@e2e.local",
      name: "Admin",
      role: "ADMIN",
      scopes: []
    });
    const chamar = (metodo: "GET" | "POST", caminho: string, payload?: object) =>
      app.inject({
        method: metodo,
        url: `/api/v1/treinamentos${caminho}`,
        headers: { authorization: `Bearer ${token}` },
        ...(payload ? { payload } : {})
      });
    expect((await chamar("POST", "/cenarios/importar", { cenarios })).statusCode).toBe(200);
    const lista = (await chamar("GET", "/cenarios")).json().data as {
      id: string;
      slug: string;
      versoes: { id: string }[];
    }[];
    for (const c of doPublico) {
      const e = lista.find((x) => x.slug === c.id)!;
      expect(
        (await chamar("POST", `/cenarios/${e.id}/aprovar`, { versaoId: e.versoes[0]!.id }))
          .statusCode
      ).toBe(200);
    }

    // A pessoa COMUM: supervisor de manutenção, termo aceito.
    email = "participante@e2e.local";
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { email, passwordHash: hashPassword(SENHA), name: "Participante" },
      colaborador: { name: "Colaborador" }
    });
    await banco.db.client.query(
      `UPDATE "User" SET "cargo" = 'Supervisor de manutenção', "nivelGovernanca" = 'supervisor'::"NivelGovernanca",
              "areaId" = (SELECT id FROM "Area" WHERE slug = 'manutencao') WHERE id = $1`,
      [ctx.userId]
    );
    await banco.db.client.query(
      `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2026-1')`,
      [ctx.participanteId]
    );

    const caminho = process.env.LAB_E2E_CHROMIUM;
    navegador = await chromium.launch(caminho ? { executablePath: caminho } : {});
  }, 300_000);

  afterAll(async () => {
    await navegador?.close();
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
    if (pastaDoFront) rmSync(pastaDoFront, { recursive: true, force: true });
  });

  it("o menu do COMUM tem só o Leadership Lab, e o endereço antigo de Treinamentos o leva para o Lab", async () => {
    const contexto = await navegador.newContext();
    const page = await contexto.newPage();
    await entrar(page);
    await page.waitForURL(/\/lab/);
    for (const nome of ["Colaboradores", "Escalas", "Treinamentos", "QLP", "Recrutamento"])
      expect(await page.getByRole("link", { name: nome, exact: true }).count(), nome).toBe(0);
    await page.goto(`${url}/treinamentos`);
    await page.waitForURL(/\/lab$/);
    await contexto.close();
  }, 120_000);

  it("faz a trilha de 3 cenários pelo teclado, recarrega no meio e retoma, e chega ao resultado", async () => {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await contexto.newPage();
    await entrar(page);
    await page.goto(`${url}/lab/teste`);

    // Antes de começar: o público da conta e quantos cenários; o clique é que inicia.
    await page.getByText("3 cenários").waitFor({ timeout: 30_000 });
    await capturar(page, "1-antes-de-comecar");
    await apertar(page, "Começar o teste");

    const vistos: string[] = [];
    for (let ordem = 1; ordem <= 3; ordem++) {
      await page
        .getByText(`Teste do Leadership Lab · cenário ${ordem} de 3`)
        .waitFor({ timeout: 30_000 });
      const titulo = (await page.locator("#abertura-titulo").innerText()).trim();
      vistos.push(titulo);
      const cenario = porTitulo.get(titulo)!;
      expect(cenario, titulo).toBeDefined();
      await capturar(page, `${ordem}-abertura`);

      await apertar(page, "Iniciar");
      await apertar(page, /Pular cena/);

      if (ordem === 1) {
        // Tela cheia pelo teclado: o botão troca de rótulo e o Esc sai.
        const tela = page.getByRole("button", { name: "Tela cheia" });
        await tela.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("button", { name: "Sair da tela cheia" }).waitFor();
        await capturar(page, "1-tela-cheia");
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Tela cheia" }).waitFor();

        // 2 perguntas, recarrega e retoma na terceira (sem a abertura).
        for (let n = 1; n <= 2; n++) {
          await responder(
            page,
            n,
            cenario.questions[n - 1]!.alternatives.findIndex((a) => a.taken)
          );
          await apertar(page, "Próxima pergunta");
        }
        await page.getByText("Pergunta 3 de 5").waitFor();
        await page.reload();
        await page.getByText("Pergunta 3 de 5").waitFor({ timeout: 30_000 });
        expect(await page.getByRole("button", { name: "Iniciar", exact: true }).count()).toBe(0);
        await jogarPerguntas(page, cenario, 3);
      } else {
        await jogarPerguntas(page, cenario, 1);
      }

      if (ordem < 3) {
        await page
          .getByRole("heading", { name: `Cenário ${ordem} de 3 concluído` })
          .waitFor({ timeout: 30_000 });
        await capturar(page, `${ordem}-desfecho`);
        await apertar(page, /Próximo cenário/);
      }
    }

    // O resultado: tudo cumprido = 100%, 3 cenários, sem repetir nenhum.
    await page.waitForURL(/\/lab\/resultado\//, { timeout: 30_000 });
    await page.getByRole("heading", { name: "Resultado do teste" }).waitFor();
    await capturar(page, "resultado");
    expect(new Set(vistos).size).toBe(3);
    const numeros = page.getByRole("region", { name: "Números do teste" });
    // O número anima até 100%: o texto fixo confirma que todas as decisões foram cumpridas.
    expect(await numeros.innerText()).toMatch(/15 de 15 decisões cumpridas/);
    expect(await page.getByText(/Cenário [123]:/).count()).toBeGreaterThanOrEqual(3);

    // E o painel já conta o teste concluído.
    await page.goto(`${url}/lab`);
    await page.getByText(/Pronto para o próximo teste/).waitFor({ timeout: 30_000 });
    await contexto.close();
  }, 600_000);

  it("no celular a trilha não rola na horizontal", async () => {
    const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const page = await contexto.newPage();
    await entrar(page);
    await page.goto(`${url}/lab/teste`);
    await page.getByRole("button", { name: "Começar o teste" }).waitFor({ timeout: 30_000 });
    const rolagem = (await page.evaluate(
      "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )) as number;
    expect(rolagem).toBeLessThanOrEqual(1);
    await contexto.close();
  }, 120_000);
});
