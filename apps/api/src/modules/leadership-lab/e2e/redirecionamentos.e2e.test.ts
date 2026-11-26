// Redirecionamentos de ponta a ponta no navegador: a raiz e as rotas internas sem sessão vão ao
// login, depois dele cada perfil cai na inicial dele (ou volta à rota pretendida, se puder abri-la).
//
//   LAB_E2E=1 LAB_TEST_DATABASE_URL=postgresql://... pnpm --filter @my-flux/api test:e2e
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { type AmbienteE2e, type PessoaDoE2e, subirAmbienteE2e } from "./ambiente-e2e.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;

describe.skipIf(!ligado)("redirecionamentos no navegador", () => {
  let ambiente: AmbienteE2e;
  let navegador: Browser;

  beforeAll(async () => {
    ambiente = await subirAmbienteE2e();
    // LAB_E2E_CHROMIUM: um Chromium já instalado, quando o da versão do Playwright não está presente.
    navegador = await chromium.launch(
      process.env.LAB_E2E_CHROMIUM ? { executablePath: process.env.LAB_E2E_CHROMIUM } : {}
    );
  }, 180_000);

  afterAll(async () => {
    await navegador?.close();
    await ambiente?.fechar();
  });

  /** Uma aba limpa (sem sessão de outro teste). */
  const novaAba = async () => (await navegador.newContext()).newPage();
  const caminho = (page: Page) => new URL(page.url()).pathname;

  async function preencherLogin(page: Page, pessoa: PessoaDoE2e) {
    await page.getByLabel("E-mail").fill(pessoa.email);
    await page.getByLabel("Senha", { exact: true }).fill(pessoa.senha);
    await page.getByRole("button", { name: "Entrar no MyFlux" }).click();
  }

  it("a raiz e uma rota interna sem sessão mostram o login", async () => {
    const page = await novaAba();
    for (const rota of ["/", "/colaboradores", "/escalas", "/lab", "/usuarios"]) {
      await page.goto(`${ambiente.url}${rota}`);
      await page.waitForURL("**/login");
      await page.getByRole("heading", { name: "Bem-vindo de volta" }).waitFor();
    }
  }, 60_000);

  it.each([
    ["COMUM", "/lab"],
    ["RH", "/colaboradores"],
    ["ADMIN", "/colaboradores"],
    ["DEV", "/colaboradores"]
  ] as const)(
    "%s entra pela raiz e cai em %s",
    async (perfil, inicial) => {
      const pessoa = await ambiente.criarPessoa(perfil, { escopoGlobal: true });
      const page = await novaAba();
      await page.goto(`${ambiente.url}/`);
      await page.waitForURL("**/login");
      await preencherLogin(page, pessoa);
      await page.waitForURL(`**${inicial}`);
    },
    60_000
  );

  it("rota interna sem sessão: depois do login, volta a ela", async () => {
    const pessoa = await ambiente.criarPessoa("RH", { escopoGlobal: true });
    const page = await novaAba();
    await page.goto(`${ambiente.url}/escalas`);
    await page.waitForURL("**/login");
    await preencherLogin(page, pessoa);
    await page.waitForURL("**/escalas");
  }, 60_000);

  it("rota que o perfil não abre: depois do login, vai para a inicial", async () => {
    const pessoa = await ambiente.criarPessoa("COMUM");
    const page = await novaAba();
    await page.goto(`${ambiente.url}/usuarios`);
    await page.waitForURL("**/login");
    await preencherLogin(page, pessoa);
    await page.waitForURL("**/lab");
  }, 60_000);

  it("um 'from' externo é ignorado", async () => {
    const pessoa = await ambiente.criarPessoa("RH", { escopoGlobal: true });
    const page = await novaAba();
    await page.goto(`${ambiente.url}/login`);
    // O roteador lê o estado do histórico em `usr`: forja um destino externo e recarrega.
    await page.evaluate(
      'history.replaceState({ usr: { from: "//exemplo.invalid/roubo" }, key: "x", idx: 0 }, "")'
    );
    await page.reload();
    await preencherLogin(page, pessoa);
    await page.waitForURL("**/colaboradores");
    expect(new URL(page.url()).origin).toBe(ambiente.url);
  }, 60_000);

  it("sessão inválida vai ao login e fica lá, sem laço", async () => {
    const page = await novaAba();
    await page.goto(`${ambiente.url}/login`);
    await page.evaluate(
      'localStorage.setItem("my-flux.accessToken", "invalido"); localStorage.setItem("my-flux.refreshToken", "invalido")'
    );
    await page.goto(`${ambiente.url}/`);
    await page.waitForURL("**/login");
    let navegacoes = 0;
    page.on("framenavigated", () => navegacoes++);
    await page.waitForTimeout(2000);
    expect(caminho(page)).toBe("/login");
    expect(navegacoes).toBeLessThanOrEqual(1);
    await page.getByRole("heading", { name: "Bem-vindo de volta" }).waitFor();
  }, 60_000);

  it("quem já entrou e abre /login vai para a inicial; sair volta ao login", async () => {
    const pessoa = await ambiente.criarPessoa("RH", { escopoGlobal: true });
    const page = await novaAba();
    await page.goto(`${ambiente.url}/login`);
    await preencherLogin(page, pessoa);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/login`);
    await page.waitForURL("**/colaboradores");
    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL("**/login");
    await page.waitForTimeout(1000);
    expect(caminho(page)).toBe("/login");
  }, 60_000);
});
