// Treinamentos Interativos, de ponta a ponta no navegador (Chromium, via Playwright): um participante
// entra, faz as 5 perguntas PELO TECLADO, recarrega no meio e retoma, vê o desfecho; o modo de
// movimento reduzido tira as partículas; o celular não rola na horizontal; o RH de outra turma não vê.
//
// Sobe a API de verdade, o PostgreSQL de verdade (banco descartável) e o front compilado na mesma
// origem, com login exigido (sem o modo de teste sem login). Só roda quando pedido:
//
//   LAB_E2E=1 LAB_TEST_DATABASE_URL=postgresql://... pnpm --filter @my-flux/api test:e2e
//
// Com LAB_E2E_SHOTS=<pasta>, salva capturas de tela (desktop e celular). Com LAB_E2E_CHROMIUM=<exe>,
// usa esse Chromium no lugar do que o Playwright baixaria.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password-service.js";
import { createAccessToken } from "../auth/token-service.js";
import { integrationEnabled } from "../leadership-lab/db/test-database.js";
import { criarParticipante, criarUsuario, inserir } from "../leadership-lab/db/test-fixtures.js";
import {
  type Banco,
  encerrarBanco,
  prepararBanco
} from "../leadership-lab/motor/cenario-de-teste.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;
const pastaDeCapturas = process.env.LAB_E2E_SHOTS;
const SENHA = "Senha-de-teste-1!";
const raiz = fileURLToPath(new URL("../../../../../", import.meta.url));
const textoDoPlantao = readFileSync(
  join(raiz, "packages/shared/src/treinamentos/exemplos/rh-falta-plantao-noturno.json"),
  "utf8"
);
const plantao = JSON.parse(textoDoPlantao) as {
  questions: { alternatives: { taken: boolean }[] }[];
};
const quadro = JSON.parse(
  readFileSync(
    join(raiz, "packages/shared/src/treinamentos/exemplos/manutencao-quadro-uti.json"),
    "utf8"
  )
) as { questions: { alternatives: { taken: boolean }[] }[] };

/** Compila o front com o Vite chamado pelo Node (não depende de pnpm no PATH), login exigido. */
function compilarOFront(destino: string): void {
  const vite = join(raiz, "apps/web/node_modules/vite/bin/vite.js");
  execFileSync(process.execPath, [vite, "build", "--outDir", destino, "--emptyOutDir"], {
    cwd: join(raiz, "apps/web"),
    env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_MODO_TESTE_SEM_LOGIN: "false" },
    stdio: "pipe"
  });
}

describe.skipIf(!ligado)("Treinamentos Interativos no navegador", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let url: string;
  let navegador: Browser;
  let pastaDoFront: string;
  let desligarPrisma: () => Promise<void>;
  let atribuicaoId: string;
  const papeis: Record<string, string> = {};
  let contador = 0;

  async function pessoa(papel: "RH" | "ADMIN") {
    contador += 1;
    const email = `${papel.toLowerCase()}${contador}@e2e.local`;
    const id = await criarUsuario(banco.db.client, banco.base, {
      roleId: papeis[papel],
      email,
      passwordHash: hashPassword(SENHA)
    });
    const token = createAccessToken({ id, email, name: papel, role: papel, scopes: [] });
    return { id, email, token };
  }

  async function participante(turmaId: string) {
    contador += 1;
    const email = `participante${contador}@e2e.local`;
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { email, passwordHash: hashPassword(SENHA), name: `Participante ${contador}` },
      colaborador: { name: `Colaborador ${contador}` }
    });
    await banco.db.client.query(
      `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
      [turmaId, ctx.participanteId]
    );
    return { email, userId: ctx.userId };
  }

  async function chamar(token: string, metodo: "GET" | "POST", caminho: string, corpo?: object) {
    const r = await app.inject({
      method: metodo,
      url: `/api/v1/treinamentos${caminho}`,
      headers: { authorization: `Bearer ${token}` },
      ...(corpo ? { payload: corpo } : {})
    });
    return { status: r.statusCode, corpo: r.json() as { data: Record<string, string> } };
  }

  async function capturar(page: Page, nome: string) {
    if (pastaDeCapturas) await page.screenshot({ path: join(pastaDeCapturas, `${nome}.png`) });
  }

  async function entrar(page: Page, email: string) {
    await page.goto(`${url}/login`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: /Entrar no MyFlux/ }).click();
    await page.waitForURL((endereco) => !endereco.pathname.startsWith("/login"));
  }

  /** Responde a pergunta aberta pelo teclado: Tab até as alternativas, o número e Enter. */
  async function responderPeloTeclado(page: Page, numero: number, alternativa: number) {
    await page.getByText(`Pergunta ${numero} de 5`).waitFor({ timeout: 15_000 });
    await page.keyboard.press("Tab");
    await page.keyboard.press(String(alternativa + 1));
    await page.keyboard.press("Enter");
  }

  async function seguirPeloTeclado(page: Page, rotulo: string) {
    const botao = page.getByRole("button", { name: rotulo, exact: true });
    await botao.waitFor();
    await botao.focus();
    await page.keyboard.press("Enter");
  }

  beforeAll(async () => {
    if (pastaDeCapturas) mkdirSync(pastaDeCapturas, { recursive: true });
    pastaDoFront = mkdtempSync(join(tmpdir(), "treinos-e2e-web-"));
    compilarOFront(pastaDoFront);
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../app.js");
    const { prisma } = await import("../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    app = await buildApp({ treinamentos: { config: { limiteTentativasDia: null } } });
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

    papeis.COMUM = banco.base.roleId;
    for (const [nome, nivel] of [
      ["RH", 2],
      ["ADMIN", 3]
    ] as const)
      papeis[nome] = await inserir(banco.db.client, '"Role"', {
        id: crypto.randomUUID(),
        name: nome,
        level: nivel,
        description: nome,
        updatedAt: new Date().toISOString()
      });

    // LAB_E2E_CHROMIUM: caminho de um Chromium já instalado, quando o da versão do Playwright não está.
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

  let turmaA: string;
  let curador: { token: string; email: string };
  let outroCurador: { token: string };
  let administrador: { email: string };

  it("o ADMIN cadastra, aprova e atribui o cenário à turma", async () => {
    const admin = await pessoa("ADMIN");
    administrador = admin;
    const rhA = await pessoa("RH");
    const rhB = await pessoa("RH");
    curador = rhA;
    outroCurador = rhB;
    turmaA = await inserir(banco.db.client, "leadership_lab.turma", {
      nome: "Turma A",
      curador_id: rhA.id
    });
    await inserir(banco.db.client, "leadership_lab.turma", { nome: "Turma B", curador_id: rhB.id });
    const criado = await chamar(admin.token, "POST", "/cenarios", { conteudo: quadro });
    expect(criado.status).toBe(201);
    const { id, versaoId } = criado.corpo.data as { id: string; versaoId: string };
    expect(
      (await chamar(admin.token, "POST", `/cenarios/${id}/aprovar`, { versaoId })).status
    ).toBe(200);
    const atribuido = await chamar(admin.token, "POST", "/atribuicoes", {
      versaoId,
      turmaId: turmaA
    });
    expect(atribuido.status).toBe(201);
    atribuicaoId = atribuido.corpo.data.id!;
  });

  it("o participante faz as 5 perguntas pelo teclado, recarrega no meio e retoma, e vê o desfecho", async () => {
    const ana = await participante(turmaA);
    const page = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    await entrar(page, ana.email);
    await page.goto(`${url}/treinamentos`);
    const comecar = page.getByRole("link", { name: /Começar/ });
    await comecar.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(`**/treinamentos/${atribuicaoId}/jogar`);
    await capturar(page, "01-abertura-desktop");

    await seguirPeloTeclado(page, "Iniciar");
    await seguirPeloTeclado(page, "Pular cena");
    // Escolhas: cumpre tudo, menos a medição (q5): arco contido pelo EPI.
    const alternativas = quadro.questions.map((q, i) =>
      q.alternatives.findIndex((a) => a.taken === (i !== 4))
    );
    await responderPeloTeclado(page, 1, alternativas[0]!);
    await page.getByRole("heading", { name: /UTI preparada|Aviso confirmado/ }).waitFor();
    await capturar(page, "02-reacao-desktop");
    await seguirPeloTeclado(page, "Próxima pergunta");
    await responderPeloTeclado(page, 2, alternativas[1]!);
    await page.getByRole("button", { name: "Próxima pergunta" }).waitFor();

    // Recarregar no meio: volta na pergunta 3, sem abertura e sem cena de abertura.
    await page.reload();
    await page.getByText("Pergunta 3 de 5").waitFor({ timeout: 15_000 });
    expect(await page.getByRole("button", { name: "Iniciar", exact: true }).count()).toBe(0);
    await capturar(page, "03-pergunta-retomada-desktop");

    for (const numero of [3, 4, 5]) {
      await responderPeloTeclado(page, numero, alternativas[numero - 1]!);
      await seguirPeloTeclado(page, numero < 5 ? "Próxima pergunta" : "Seguir para o desfecho");
    }
    await seguirPeloTeclado(page, "Ver o desfecho");
    await page.waitForURL("**/treinamentos/resultado/**");
    await page.getByRole("heading", { name: "O que aconteceu" }).waitFor();
    // Só o painel do desfecho (a análise, abaixo, também lista os acontecimentos).
    const painelDoDesfecho = page.locator("section[aria-labelledby=desfecho-titulo]");
    expect(await painelDoDesfecho.getByText("Arco elétrico no quadro").count()).toBe(1);
    expect(await painelDoDesfecho.getByText("EPI contém o arco").count()).toBe(1);
    await capturar(page, "04-desfecho-desktop");
    await seguirPeloTeclado(page, "Ver os resultados");
    expect(await painelDoDesfecho.getByText("Incidente contido").count()).toBe(1);
    await capturar(page, "05-resultados-desktop");

    // Análise: "e se eu tivesse medido?" pelo teclado; o desfecho novo vem do servidor.
    await seguirPeloTeclado(page, "Continuar");
    await seguirPeloTeclado(page, "Ver a análise");
    const analise = page.locator("section[aria-labelledby=analise-titulo]");
    const medir = analise.getByRole("button", {
      name: /^Medir a ausência de tensão: não cumprida/
    });
    await medir.focus();
    await page.keyboard.press("Enter");
    const tecnico = analise.getByRole("button", { name: /Integridade do técnico/ });
    await tecnico.getByText("Sem lesão").waitFor();
    expect(await tecnico.getByText("mudou").count()).toBe(1);
    await capturar(page, "09-analise-e-se-desktop");
    await tecnico.focus();
    await page.keyboard.press("Enter");
    await analise.getByText("Por que “Integridade do técnico”?").waitFor();
    await seguirPeloTeclado(page, "Voltar à minha escolha");
    await tecnico.getByText("Incidente contido").waitFor();

    // O RH da turma vê; o RH de outra turma recebe o mesmo 404 de "não existe".
    const tentativaId = page.url().split("/").pop()!;
    expect(
      (await chamar(curador.token, "GET", `/tentativas/${tentativaId}/resultado`)).status
    ).toBe(200);
    const alheio = await chamar(outroCurador.token, "GET", `/tentativas/${tentativaId}/resultado`);
    const inexistente = await chamar(
      outroCurador.token,
      "GET",
      `/tentativas/${crypto.randomUUID()}/resultado`
    );
    expect(alheio.status).toBe(404);
    expect(alheio.corpo).toEqual(inexistente.corpo);

    // Com "reduzir movimento": sem partículas nem grão; a cena é um quadro estático.
    const reduzido = await navegador.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 }
    });
    const paginaReduzida = await reduzido.newPage();
    await entrar(paginaReduzida, ana.email);
    await paginaReduzida.goto(page.url());
    await paginaReduzida.getByRole("heading", { name: "O que aconteceu" }).waitFor();
    expect(await paginaReduzida.locator("canvas").count()).toBe(0);
    expect(await paginaReduzida.locator(".palco-grao").count()).toBe(0);
    await capturar(paginaReduzida, "06-desfecho-movimento-reduzido");
    await reduzido.close();
    await page.close();
  }, 180_000);

  it("no celular, o Palco e o painel cabem sem rolagem horizontal", async () => {
    const bia = await participante(turmaA);
    const contexto = await navegador.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const page = await contexto.newPage();
    await entrar(page, bia.email);
    const semRolagem = () =>
      // Expressão em texto: o tsconfig da API não tem os tipos do DOM.
      page.evaluate<boolean>(
        "document.documentElement.scrollWidth <= document.documentElement.clientWidth"
      );

    await page.goto(`${url}/treinamentos`);
    await page.getByRole("link", { name: /Começar/ }).waitFor();
    expect(await semRolagem()).toBe(true);
    await capturar(page, "07-lista-celular");

    await page.goto(`${url}/treinamentos/${atribuicaoId}/jogar`);
    await page.getByRole("button", { name: "Iniciar", exact: true }).click();
    await page.getByRole("button", { name: /Pular cena/ }).click();
    await page.getByText("Pergunta 1 de 5").waitFor({ timeout: 15_000 });
    // O painel fica DENTRO do quadro do Palco.
    const quadroDoPalco = await page.locator(".palco").boundingBox();
    const painel = await page.locator(".palco section[role=group]").boundingBox();
    expect(painel!.y).toBeGreaterThanOrEqual(quadroDoPalco!.y);
    expect(painel!.y + painel!.height).toBeLessThanOrEqual(
      quadroDoPalco!.y + quadroDoPalco!.height + 1
    );
    expect(await semRolagem()).toBe(true);
    await capturar(page, "08-pergunta-celular");

    // A análise no celular abre em lista (e o grafo continua a um toque), sem rolagem horizontal.
    const tentativaDaAna = await banco.db.client.query(
      `SELECT id FROM treinamentos.tentativa WHERE status = 'concluida' ORDER BY concluida_em LIMIT 1`
    );
    const ana = await banco.db.client.query(
      `SELECT u.email FROM treinamentos.tentativa t JOIN leadership_lab.participante p ON p.id = t.participante_id
        JOIN "User" u ON u.id = p.user_id WHERE t.id = $1`,
      [tentativaDaAna.rows[0].id]
    );
    const outra = await contexto
      .browser()!
      .newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
    const celular = await outra.newPage();
    await entrar(celular, ana.rows[0].email);
    await celular.goto(`${url}/treinamentos/resultado/${tentativaDaAna.rows[0].id}`);
    await celular.getByRole("button", { name: "Ver como grafo" }).waitFor();
    expect(
      await celular.evaluate<boolean>(
        "document.documentElement.scrollWidth <= document.documentElement.clientWidth"
      )
    ).toBe(true);
    await celular.locator("#analise-titulo").scrollIntoViewIfNeeded();
    await capturar(celular, "10-analise-lista-celular");
    await outra.close();
    await contexto.close();
  }, 120_000);

  it("o segundo cenário (RH) roda sem mudar código: cadastro pela tela, jogo pelo teclado, validação do RH", async () => {
    // 1. O ADMIN cola o JSON, valida, salva, aprova e atribui à turma, pela tela.
    const paginaDoAdmin = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    paginaDoAdmin.on("dialog", (dialogo) => void dialogo.accept());
    await entrar(paginaDoAdmin, administrador.email);
    await paginaDoAdmin.goto(`${url}/treinamentos/config`);
    await paginaDoAdmin.getByLabel("Conteúdo do cenário (JSON)").fill(textoDoPlantao);
    await paginaDoAdmin.getByRole("button", { name: "Validar", exact: true }).click();
    await paginaDoAdmin.getByText(/Cenário válido: Falta no plantão noturno/).waitFor();
    await paginaDoAdmin
      .getByRole("button", { name: "Pré-visualizar", exact: true })
      .first()
      .click();
    await paginaDoAdmin.getByRole("tab", { name: "Pergunta 2" }).click();
    await capturar(paginaDoAdmin, "11-configuracao-previa-rh");
    await paginaDoAdmin.getByRole("button", { name: "Salvar", exact: true }).click();
    const cartao = paginaDoAdmin.locator("article", { hasText: "Falta no plantão noturno" });
    await cartao.getByRole("button", { name: "Aprovar" }).click();
    await cartao.getByText(/Aprovada em/).waitFor();
    await cartao.getByRole("button", { name: "Atribuir" }).click();
    await cartao.getByLabel("Turma").selectOption(turmaA);
    await cartao.getByRole("button", { name: "Atribuir", exact: true }).last().click();
    await cartao.getByText("1 atribuição").waitFor();
    await capturar(paginaDoAdmin, "12-configuracao-cenarios");
    await paginaDoAdmin.close();

    // 2. Um participante da turma faz o cenário de RH pelo teclado, cumprindo tudo.
    const carla = await participante(turmaA);
    const page = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    await entrar(page, carla.email);
    await page.goto(`${url}/treinamentos`);
    const comecar = page
      .locator("li", { hasText: "Falta no plantão noturno" })
      .getByRole("link", { name: /Começar/ });
    await comecar.focus();
    await page.keyboard.press("Enter");
    await seguirPeloTeclado(page, "Iniciar");
    await seguirPeloTeclado(page, "Pular cena");
    expect(await page.locator("svg[role=img]").getAttribute("aria-label")).toMatch(
      /Sala de gestão da escala/
    );
    const certas = plantao.questions.map((q) => q.alternatives.findIndex((a) => a.taken));
    for (const numero of [1, 2, 3, 4, 5]) {
      await responderPeloTeclado(page, numero, certas[numero - 1]!);
      if (numero === 4) await capturar(page, "13-rh-reacao-escala");
      await seguirPeloTeclado(page, numero < 5 ? "Próxima pergunta" : "Seguir para o desfecho");
    }
    await seguirPeloTeclado(page, "Ver o desfecho");
    await page.waitForURL("**/treinamentos/resultado/**");
    await seguirPeloTeclado(page, "Ver os resultados");
    const painel = page.locator("section[aria-labelledby=desfecho-titulo]");
    await painel.getByText("Plantão coberto e claro para todos").waitFor();
    expect(await painel.getByText("Escala dentro das regras").count()).toBe(1);
    await capturar(page, "14-rh-resultados");
    const resultadoDaCarla = page.url();

    // 3. O RH da turma vê a tentativa, abre e valida com uma nota.
    const paginaDoRh = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(paginaDoRh, curador.email);
    await paginaDoRh.goto(`${url}/treinamentos/rh`);
    const item = paginaDoRh.locator("li", { hasText: "Falta no plantão noturno" }).first();
    await item.getByRole("button", { name: /^Validar/ }).click();
    await item.getByLabel(/Nota para a pessoa/).fill("Troca bem conduzida.");
    await item.getByRole("button", { name: "Confirmar validação" }).click();
    await paginaDoRh
      .getByText(/validada\./)
      .first()
      .waitFor();
    await capturar(paginaDoRh, "15-rh-acompanhamento");
    await paginaDoRh.close();

    // 4. A pessoa vê a validação e a nota no resultado.
    await page.goto(resultadoDaCarla);
    await page.getByText(/Validado pelo RH: “Troca bem conduzida.”/).waitFor();
    await page.close();
  }, 240_000);
});
