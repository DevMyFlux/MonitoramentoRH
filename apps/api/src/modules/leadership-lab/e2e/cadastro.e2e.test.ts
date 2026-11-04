// Leadership Lab, de ponta a ponta no navegador: o que antes era feito no banco (SQL) agora é feito
// pelas telas. O administrador libera o molde, o RH cadastra o participante e monta a turma, e o
// participante consegue iniciar o teste. Depois o RH o desativa e ele perde o acesso.
//
// Sobe a API de verdade, o PostgreSQL de verdade, o front compilado e o serviço de IA falso (veja
// ambiente-e2e.ts). Só roda quando pedido:
//
//   LAB_E2E=1 LAB_TEST_DATABASE_URL=postgresql://... pnpm --filter @my-flux/api test:e2e
//
// Com LAB_E2E_SHOTS=<pasta>, salva capturas de tela de cada etapa.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { type AmbienteE2e, type PessoaDoE2e, subirAmbienteE2e } from "./ambiente-e2e.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;
const pastaDeCapturas = process.env.LAB_E2E_SHOTS;

describe.skipIf(!ligado)("cadastros do Leadership Lab no navegador", () => {
  let ambiente: AmbienteE2e;
  let navegador: Browser;
  let admin: PessoaDoE2e;
  let rh: PessoaDoE2e;
  let marina: PessoaDoE2e;

  beforeAll(async () => {
    if (pastaDeCapturas) mkdirSync(pastaDeCapturas, { recursive: true });
    ambiente = await subirAmbienteE2e();
    navegador = await chromium.launch();
    // O cenário de teste já deixa o molde do supervisor liberado (60 s). Aqui ele volta a como a
    // migração o entrega (desligado e sem tempo): é a liberação, pela tela, que está sendo testada.
    await ambiente.banco.db.client.query(
      `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = NULL`
    );
    admin = await ambiente.criarPessoa("ADMIN", { nome: "Administrador" });
    rh = await ambiente.criarPessoa("RH", { nome: "RH do Lab", escopoGlobal: true });
    marina = await ambiente.criarPessoa("COMUM", {
      nome: "Conta da Marina",
      email: "marina@e2e.local"
    });
    await ambiente.criarColaboradorComCargo({
      nome: "Marina Teixeira",
      matricula: "E2E-MARINA",
      cargo: "Supervisora de campo (e2e)"
    });
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
    // Espera o menu: é quando a verificação da sessão terminou. Navegar antes disso aborta a
    // verificação em andamento, e o app trata o aborto como sessão inválida e a descarta.
    await page.getByRole("navigation", { name: /./ }).first().waitFor();
  }

  const semRolagemHorizontal = (page: Page) =>
    page
      .evaluate("document.documentElement.scrollWidth <= window.innerWidth")
      .then((v) => v === true);

  it("o administrador libera o molde do supervisor para o cargo, pela tela", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, admin);
    await page.waitForURL("**/colaboradores");

    // A entrada do menu é a do administrador; a do RH e a do participante não aparecem.
    expect(await page.getByRole("link", { name: "Acompanhamento do Lab" }).count()).toBe(0);
    expect(await page.getByRole("link", { name: "Leadership Lab", exact: true }).count()).toBe(0);
    await page.getByRole("link", { name: "Configuração do Lab" }).click();
    await page.waitForURL("**/lab/config");
    await page
      .getByRole("heading", {
        level: 1,
        name: "Configuração do Leadership Lab"
      })
      .waitFor();

    const supervisor = page.getByRole("form", { name: "Molde Supervisor" });
    await supervisor.waitFor();
    // Nenhum tempo vem preenchido: é decisão do negócio.
    expect(await supervisor.getByLabel(/Tempo por situação/).inputValue()).toBe("");
    await capturar(page, "10-configuracao-moldes");

    // Liberar sem tempo é recusado na própria tela.
    await supervisor.getByRole("checkbox", { name: /Teste liberado/ }).check();
    await supervisor.getByRole("button", { name: "Salvar Supervisor" }).click();
    await supervisor.getByText("Defina o tempo por situação para liberar o teste.").waitFor();

    await supervisor.getByLabel(/Tempo por situação/).fill("60");
    await supervisor.getByRole("checkbox", { name: /Supervisora de campo \(e2e\)/ }).check();
    await supervisor.getByRole("button", { name: "Salvar Supervisor" }).click();
    await supervisor.getByRole("status").getByText("Alterações salvas.").waitFor();
    await capturar(page, "11-molde-liberado");

    // Recarregar mostra o que ficou gravado.
    await page.reload();
    const depois = page.getByRole("form", { name: "Molde Supervisor" });
    await depois.waitFor();
    expect(await depois.getByLabel(/Tempo por situação/).inputValue()).toBe("60");
    expect(await depois.getByRole("checkbox", { name: /Teste liberado/ }).isChecked()).toBe(true);
    expect(
      await depois.getByRole("checkbox", { name: /Supervisora de campo \(e2e\)/ }).isChecked()
    ).toBe(true);
    await page.close();
  }, 90_000);

  it("o RH cadastra a participante e monta a turma, e ela consegue iniciar o teste", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.getByRole("link", { name: "Acompanhamento do Lab" }).click();
    await page.waitForURL("**/lab/rh/participantes");
    // O cenário já tem um participante (o das outras telas); a Marina ainda não está na lista.
    await page
      .getByRole("heading", { level: 1, name: "Acompanhamento do Leadership Lab" })
      .waitFor();
    await page.getByRole("button", { name: "Cadastrar participante" }).waitFor();
    expect(await page.getByRole("row", { name: /Marina Teixeira/ }).count()).toBe(0);
    await capturar(page, "12-participantes-antes");

    // Cadastrar: busca o colaborador e o usuário (a lista nunca vem inteira).
    await page.getByRole("button", { name: "Cadastrar participante" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel(/Buscar colaborador/).fill("marina");
    await dialogo.getByRole("radio", { name: /Marina Teixeira/ }).check();
    await dialogo.getByText("Liberado").waitFor(); // o teste do cargo dela já está liberado
    await dialogo.getByLabel(/Buscar usuário/).fill("marina@");
    await dialogo.getByRole("radio", { name: /marina@e2e.local/ }).check();
    await capturar(page, "13-cadastrar-participante");
    await dialogo.getByRole("button", { name: "Cadastrar participante" }).click();
    await dialogo.waitFor({ state: "detached" });

    const linha = page.getByRole("row", { name: /Marina Teixeira/ });
    await linha.getByText("Matrícula E2E-MARINA").waitFor();
    await linha.getByText("Liberado").waitFor();
    await linha.getByText("Ativo").waitFor();
    await capturar(page, "14-participante-cadastrada");

    // A turma: criar, abrir e incluir a participante.
    await page.getByRole("link", { name: "Turmas" }).click();
    await page.waitForURL("**/lab/rh/turmas");
    await page.getByText("Você ainda não tem turmas").waitFor();
    await page.getByLabel(/Nova turma/).fill("Supervisores — e2e");
    await page.getByRole("button", { name: "Criar turma" }).click();
    await page.waitForURL("**/lab/rh/turmas/*");
    await page.getByRole("heading", { name: "Supervisores — e2e" }).waitFor();
    await page.getByText("A turma está vazia").waitFor();

    await page
      .getByLabel("Incluir participante")
      .selectOption({ label: "Marina Teixeira — matrícula E2E-MARINA" });
    await page.getByRole("button", { name: "Incluir na turma" }).click();
    await page.getByText("Participantes (1)").waitFor();
    await page.getByRole("row", { name: /Marina Teixeira/ }).waitFor();
    await capturar(page, "15-turma-com-participante");
    await page.close();

    // A participante entra e já pode iniciar: o que antes exigia SQL no banco.
    const dela = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(dela, marina);
    await dela.waitForURL("**/lab");
    await dela.getByRole("checkbox", { name: "Li e estou ciente." }).check();
    await dela.getByRole("button", { name: "Aceitar e continuar" }).click();
    await dela.getByRole("heading", { name: "Pronto para o próximo teste" }).waitFor();
    await dela.getByRole("button", { name: "Iniciar teste" }).click();
    await dela.waitForURL("**/lab/teste");
    await dela.getByText("Situação 1 de 5", { exact: true }).waitFor();
    // O tempo é o que o administrador configurou (60 s): o relógio começa em 1:00 e vai descendo.
    const relogio = await dela.getByRole("timer").innerText();
    expect(["1:00", "0:59", "0:58"]).toContain(relogio);
    await dela.close();
  }, 120_000);

  it("o RH desativa a participante e ela perde o acesso; reativar devolve", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/participantes`);
    const linha = page.getByRole("row", { name: /Marina Teixeira/ });
    await linha.waitFor();

    await linha.getByRole("button", { name: "Desativar Marina Teixeira" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByText(/perde o acesso ao Leadership Lab/).waitFor();
    await capturar(page, "16-confirmar-desativacao");
    await dialogo.getByRole("button", { name: "Desativar participante" }).click();
    await dialogo.waitFor({ state: "detached" });
    await linha.getByText("Desativado").waitFor();

    const dela = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(dela, marina);
    await dela.waitForURL("**/lab");
    await dela.getByText("Seu acesso ainda não está ligado a um colaborador").waitFor();

    await linha.getByRole("button", { name: "Reativar Marina Teixeira" }).click();
    await linha.getByText("Ativo").waitFor();
    await dela.reload();
    await dela.getByRole("heading", { level: 1, name: "Leadership Lab" }).waitFor();
    expect(await dela.getByText("Seu acesso ainda não está ligado a um colaborador").count()).toBe(
      0
    );
    await dela.close();
    await page.close();
  }, 120_000);

  it("quem não é do RH não acessa o acompanhamento, e quem não é administrador não acessa a configuração", async () => {
    const comum = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(comum, marina);
    await comum.waitForURL("**/lab");
    await comum.goto(`${ambiente.url}/lab/rh/participantes`);
    await comum.getByText("Esta área não é para o seu perfil").waitFor();
    await comum.goto(`${ambiente.url}/lab/config`);
    await comum.getByText("Esta área não é para o seu perfil").waitFor();
    await capturar(comum, "17-area-sem-acesso");
    await comum.close();

    const doRh = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(doRh, rh);
    await doRh.waitForURL("**/colaboradores");
    await doRh.goto(`${ambiente.url}/lab/config`);
    await doRh.getByText("Esta área não é para o seu perfil").waitFor();
    await doRh.close();
  }, 90_000);

  it("no celular, as telas do RH e da configuração cabem, sem rolagem horizontal", async () => {
    const page = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/participantes`);
    await page.getByRole("row", { name: /Marina Teixeira/ }).waitFor();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await capturar(page, "18-celular-participantes");

    await page.getByRole("button", { name: "Cadastrar participante" }).click();
    await page.getByRole("dialog").waitFor();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await capturar(page, "19-celular-cadastrar");
    await page.getByRole("button", { name: "Cancelar" }).click();

    await page.goto(`${ambiente.url}/lab/rh/turmas`);
    await page.getByRole("link", { name: "Supervisores — e2e" }).waitFor();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await page.close();

    const doAdmin = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await entrar(doAdmin, admin);
    await doAdmin.waitForURL("**/colaboradores");
    await doAdmin.goto(`${ambiente.url}/lab/config`);
    await doAdmin.getByRole("form", { name: "Molde Supervisor" }).waitFor();
    expect(await semRolagemHorizontal(doAdmin)).toBe(true);
    await capturar(doAdmin, "20-celular-configuracao");
    await doAdmin.close();
  }, 90_000);
});
