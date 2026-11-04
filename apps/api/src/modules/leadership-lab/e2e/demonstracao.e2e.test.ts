// O modo demonstração no navegador, do jeito que está publicado: o servidor sobe como em produção
// com LAB_MODO_DEMO=true e SEM serviço de IA, e o front tem o modo de teste sem login ligado.
// Reproduz o que um visitante vive: abre o endereço, entra sozinho como DEV, acha o Leadership Lab
// no menu, descobre que precisa da conta de participante e faz um teste de demonstração inteiro.
//
//   LAB_E2E=1 LAB_TEST_DATABASE_URL=postgresql://... pnpm --filter @my-flux/api test:e2e
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import {
  type AmbienteDeDemonstracao,
  type PessoaDoE2e,
  subirAmbienteDeDemonstracao
} from "./ambiente-e2e.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;
const pastaDeCapturas = process.env.LAB_E2E_SHOTS;

// As melhores respostas de cada situação da demonstração (veja demonstracao/conteudo.ts): A, C, B, A, C.
const MELHORES = ["1", "3", "2", "1", "3"];
// Na situação 4 a opção C vale 10 e abre o alerta vermelho.
const COM_ALERTA_VERMELHO = ["1", "3", "2", "3", "3"];

describe.skipIf(!ligado)("Leadership Lab em modo demonstração, no navegador", () => {
  let ambiente: AmbienteDeDemonstracao;
  let navegador: Browser;

  beforeAll(async () => {
    if (pastaDeCapturas) mkdirSync(pastaDeCapturas, { recursive: true });
    ambiente = await subirAmbienteDeDemonstracao();
    navegador = await chromium.launch();
  }, 180_000);

  afterAll(async () => {
    await navegador?.close();
    await ambiente?.fechar();
  });

  async function capturar(page: Page, nome: string) {
    if (pastaDeCapturas) {
      await page.screenshot({ path: join(pastaDeCapturas, `${nome}.png`), fullPage: true });
    }
  }

  async function entrarPelaTelaDeLogin(page: Page, pessoa: PessoaDoE2e) {
    await page.getByLabel("E-mail").fill(pessoa.email);
    await page.getByLabel("Senha", { exact: true }).fill(pessoa.senha);
    await page.getByRole("button", { name: "Entrar no MyFlux" }).click();
  }

  /** Faz um teste inteiro pelo teclado, a partir do botão "Iniciar teste" do painel. */
  async function fazerUmTeste(page: Page, teclas: string[]) {
    await page.getByRole("button", { name: "Iniciar teste" }).click();
    await page.waitForURL("**/lab/teste");
    for (const [indice, tecla] of teclas.entries()) {
      await page.getByText(`Situação ${indice + 1} de 5`, { exact: true }).waitFor();
      // Toda situação é de demonstração, e diz isso.
      await page.getByText(/\(Demonstração\)/).waitFor();
      await page.keyboard.press(tecla);
      await page.getByRole("button", { name: "Confirmar resposta" }).click();
    }
    await page.waitForURL("**/lab/resultado/*");
    await page.getByRole("heading", { level: 1, name: "Resultado do teste" }).waitFor();
  }

  it("o visitante abre o endereço, acha o Lab, entra como participante e faz um teste de demonstração inteiro", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });

    // 1. Abrir o endereço: sem login, como DEV (o modo de teste), e o Lab aparece no menu.
    await page.goto(`${ambiente.url}/`);
    await page.waitForURL("**/colaboradores");
    const itemDoMenu = page.getByRole("link", { name: "Leadership Lab" });
    await itemDoMenu.waitFor();
    await capturar(page, "20-visitante-no-modo-de-teste");

    // 2. O DEV não é participante: a página diz isso e como chegar ao teste.
    await itemDoMenu.click();
    await page.waitForURL("**/lab");
    await page.getByText("O Leadership Lab não é para o seu perfil").waitFor();
    await page.getByText("comum@myflux.local").waitFor();
    await capturar(page, "21-dev-sem-acesso-com-dica");

    // 3. Entrar com a conta de participante.
    await page.getByRole("link", { name: /Ir para o login/ }).click();
    await page.waitForURL("**/login");
    await entrarPelaTelaDeLogin(page, ambiente.participante);
    await page.waitForURL("**/lab");

    // 4. O painel avisa que é demonstração. Termo, depois o teste.
    const faixa = page.getByRole("note").filter({ hasText: "Modo demonstração" });
    await faixa.waitFor();
    await page.getByRole("checkbox", { name: "Li e estou ciente." }).check();
    await page.getByRole("button", { name: "Aceitar e continuar" }).click();
    await page.getByRole("heading", { name: "Pronto para o próximo teste" }).waitFor();
    await capturar(page, "22-painel-demonstracao");

    await fazerUmTeste(page, MELHORES);

    // 5. Resultado: as cinco melhores respostas dão 100% em cada situação, com o selo de validação,
    //    e o texto do resumo é claro sobre ser de demonstração.
    expect(await page.getByText("Aderência 100%").count()).toBe(5);
    await page.getByText("Aguardando validação").first().waitFor();
    await page.getByText(/resultado de demonstração/).waitFor();
    await capturar(page, "23-resultado-demonstracao");

    // 6. De volta ao painel, com o teste nos números e o aviso de demonstração ainda lá.
    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await page.waitForURL("**/lab");
    const indicadores = page.getByRole("region", { name: "Indicadores" });
    await indicadores.getByText("1", { exact: true }).first().waitFor();
    await indicadores.getByText("100%").first().waitFor();
    await faixa.waitFor();
    await capturar(page, "24-painel-depois-do-teste");
    await page.close();
  }, 120_000);

  it("a escolha de nota 10 abre o alerta vermelho no painel, e a evolução já tem dois testes", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${ambiente.url}/login`);
    await entrarPelaTelaDeLogin(page, ambiente.participante);
    await page.waitForURL("**/lab");

    await fazerUmTeste(page, COM_ALERTA_VERMELHO);
    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await page.waitForURL("**/lab");

    await page.getByText("Alertas abertos").waitFor();
    await page.getByText("Alerta vermelho").waitFor();
    await page
      .getByText(/Situação 4/)
      .first()
      .waitFor();
    // Dois testes concluídos: a tabela da evolução lista os dois.
    await page.getByText("Ver os números em tabela").click();
    await page.getByRole("row", { name: /Teste 2/ }).waitFor();
    await capturar(page, "25-alerta-vermelho");
    await page.close();
  }, 120_000);
});
