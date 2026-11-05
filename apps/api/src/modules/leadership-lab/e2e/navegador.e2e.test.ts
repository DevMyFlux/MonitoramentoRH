// Leadership Lab, de ponta a ponta no navegador (Chromium, via Playwright): um participante entra,
// aceita o termo, faz um teste inteiro pelo teclado, vê o resultado e o painel atualizado.
//
// Sobe a API de verdade, o PostgreSQL de verdade, o front compilado e o serviço de IA falso (veja
// ambiente-e2e.ts). Demora, e precisa do Chromium; por isso só roda quando pedido:
//
//   LAB_E2E=1 LAB_TEST_DATABASE_URL=postgresql://... pnpm --filter @my-flux/api test:e2e
//
// Com LAB_E2E_SHOTS=<pasta>, salva capturas de tela de cada etapa (desktop e celular).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { type AmbienteE2e, type PessoaDoE2e, subirAmbienteE2e } from "./ambiente-e2e.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;
const pastaDeCapturas = process.env.LAB_E2E_SHOTS;

describe.skipIf(!ligado)("Leadership Lab no navegador", () => {
  let ambiente: AmbienteE2e;
  let navegador: Browser;

  beforeAll(async () => {
    if (pastaDeCapturas) mkdirSync(pastaDeCapturas, { recursive: true });
    ambiente = await subirAmbienteE2e();
    navegador = await chromium.launch();
  }, 180_000);

  afterAll(async () => {
    await navegador?.close();
    await ambiente?.fechar();
  });

  async function capturar(page: Page, nome: string) {
    if (pastaDeCapturas)
      await page.screenshot({ path: join(pastaDeCapturas, `${nome}.png`), fullPage: true });
  }

  async function entrar(page: Page, pessoa: PessoaDoE2e) {
    await page.goto(`${ambiente.url}/login`);
    await page.getByLabel("E-mail").fill(pessoa.email);
    await page.getByLabel("Senha", { exact: true }).fill(pessoa.senha);
    await page.getByRole("button", { name: "Entrar no MyFlux" }).click();
  }

  async function aceitarOTermo(page: Page) {
    await page.getByRole("checkbox", { name: "Li e estou ciente." }).check();
    await page.getByRole("button", { name: "Aceitar e continuar" }).click();
    await page.getByRole("heading", { name: "Pronto para o próximo teste" }).waitFor();
  }

  it("um participante faz um teste inteiro pelo teclado e vê o painel atualizado", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, ambiente.participante);

    // O participante cai direto no painel dele, não em Colaboradores.
    await page.waitForURL("**/lab");
    await page.getByRole("heading", { level: 1, name: "Leadership Lab" }).waitFor();
    await capturar(page, "01-painel-com-termo-pendente");

    // Sem o termo aceito, não dá para iniciar.
    expect(await page.getByRole("button", { name: "Iniciar teste" }).isDisabled()).toBe(true);
    expect(await page.getByRole("button", { name: "Aceitar e continuar" }).isDisabled()).toBe(true);
    await aceitarOTermo(page);
    await capturar(page, "02-painel-pronto-para-iniciar");

    // Antes do primeiro teste: nada de gráfico, perfil nem tendência.
    await page.getByText(/Sua evolução aparece aqui depois do primeiro teste/).waitFor();
    await page.getByText("Seu perfil aparece depois de 3 testes concluídos.").waitFor();

    await page.getByRole("button", { name: "Iniciar teste" }).click();
    await page.waitForURL("**/lab/teste");

    // Cinco situações, escolhidas pelas teclas 1, 2 e 3 e confirmadas com o botão.
    for (const [indice, tecla] of ["1", "2", "3", "2", "1"].entries()) {
      const numero = indice + 1;
      await page.getByText(`Situação ${numero} de 5`, { exact: true }).waitFor();
      expect(await page.getByRole("timer").isVisible()).toBe(true);
      if (numero === 1) await capturar(page, "03-situacao-1");
      if (numero === 3) {
        await page.getByText("Situação de marco").waitFor();
        await capturar(page, "04-situacao-3-marco");
      }
      // A aderência nunca aparece durante o teste.
      expect(await page.getByText(/aderência/i).count()).toBe(0);

      await page.keyboard.press(tecla);
      const letra = ({ "1": "A", "2": "B", "3": "C" } as const)[tecla as "1" | "2" | "3"];
      expect(await page.getByRole("radio", { name: new RegExp(`^${letra}\\.`) }).isChecked()).toBe(
        true
      );
      await page.getByRole("button", { name: "Confirmar resposta" }).click();
    }

    // O resultado.
    await page.waitForURL("**/lab/resultado/*");
    await page.getByRole("heading", { level: 1, name: "Resultado do teste" }).waitFor();
    await page.getByText("Aguardando validação").first().waitFor();
    await page.getByText("Suas escolhas, situação por situação").waitFor();
    // O seletor da contestação também lista "Situação N": a contagem é só da lista de escolhas.
    expect(
      await page
        .locator("li")
        .getByText(/^Situação \d$/)
        .count()
    ).toBe(5);
    await capturar(page, "05-resultado");

    // De volta ao painel: o teste já está nos números.
    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await page.waitForURL("**/lab");
    await page.getByText("Testes feitos").waitFor();
    await page.getByText("1 validado").or(page.getByText("0 validados pelo RH")).first().waitFor();
    // Com um teste só, a linha não tem traço (um ponto não faz linha): o gráfico existe e desenha.
    for (const nome of [/Evolução da aderência e da agilidade/, /Radar de skills/]) {
      const grafico = page.getByRole("img", { name: nome });
      await grafico.waitFor();
      await grafico.locator("svg[role=application]").waitFor();
    }
    await capturar(page, "06-painel-depois-do-teste");
    await page.close();
  }, 90_000);

  it("recarregar no meio do teste volta à mesma situação, sem começar outro teste", async () => {
    const pessoa = await ambiente.novoParticipante();
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, pessoa);
    await page.waitForURL("**/lab");
    await aceitarOTermo(page);
    await page.getByRole("button", { name: "Iniciar teste" }).click();
    await page.waitForURL("**/lab/teste");

    await page.getByText("Situação 1 de 5", { exact: true }).waitFor();
    await page.keyboard.press("1");
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    await page.getByText("Situação 2 de 5", { exact: true }).waitFor();

    // Passam uns segundos fora; o relógio é do servidor e não pode voltar a 1:00 ao recarregar.
    await page.waitForTimeout(2500);
    await page.reload();
    await page.getByText("Situação 2 de 5", { exact: true }).waitFor();
    // A consequência da escolha anterior continua na tela, e o relógio não voltou a 1:00.
    await page.getByText("O que aconteceu depois da sua escolha").waitFor();
    expect(await page.getByRole("timer").innerText()).not.toBe("1:00");

    // Recarregar é só leitura: continua um único teste em andamento.
    const { rows } = await ambiente.banco.db.client.query(
      `SELECT count(*)::int AS n FROM leadership_lab.sessao s
         JOIN "User" u ON u.id = (SELECT user_id FROM leadership_lab.participante WHERE id = s.participante_id)
        WHERE u.email = $1`,
      [pessoa.email]
    );
    expect(rows[0]?.n).toBe(1);
    await page.close();
  }, 90_000);

  it("quem não é participante (RH) não vê o Leadership Lab no menu e recebe o aviso na página", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, ambiente.curador);
    await page.waitForURL("**/colaboradores");
    await page.getByRole("navigation", { name: /./ }).waitFor();
    expect(await page.getByRole("link", { name: "Leadership Lab" }).count()).toBe(0);

    await page.goto(`${ambiente.url}/lab`);
    await page.getByText("O Leadership Lab não é para o seu perfil").waitFor();
    await capturar(page, "07-perfil-sem-acesso");
    await page.close();
  }, 60_000);

  it("no celular, o painel e o teste cabem na tela, sem rolagem horizontal", async () => {
    const pessoa = await ambiente.novoParticipante();
    const page = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    // A expressão roda no navegador (a API não tem os tipos do DOM), por isso vai como texto.
    const semRolagemHorizontal = async () =>
      (await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")) === true;

    await entrar(page, pessoa);
    await page.waitForURL("**/lab");
    await aceitarOTermo(page);
    expect(await semRolagemHorizontal()).toBe(true);
    await capturar(page, "08-celular-painel");

    await page.getByRole("button", { name: "Iniciar teste" }).click();
    await page.waitForURL("**/lab/teste");
    await page.getByText("Situação 1 de 5", { exact: true }).waitFor();
    expect(await semRolagemHorizontal()).toBe(true);
    await capturar(page, "09-celular-situacao");
    await page.close();
  }, 60_000);
});
