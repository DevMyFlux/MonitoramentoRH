// Leadership Lab, de ponta a ponta no navegador: o ciclo da curadoria. O participante faz o teste
// pela tela; o RH da turma revisa o resultado, ajusta um nível e valida, encerra o alerta e aprova a
// contribuição; o participante vê o resultado validado, contesta um ponto e lê a resposta do RH.
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
import { roteiroPadrao } from "../motor/ia-falsa.js";
import { type AmbienteE2e, type PessoaDoE2e, subirAmbienteE2e } from "./ambiente-e2e.js";

const ligado = Boolean(process.env.LAB_E2E) && integrationEnabled;
const pastaDeCapturas = process.env.LAB_E2E_SHOTS;
const SUGESTAO = "Sugiro um checklist de abertura do turno.";

describe.skipIf(!ligado)("curadoria do Leadership Lab no navegador", () => {
  let ambiente: AmbienteE2e;
  let navegador: Browser;
  let rh: PessoaDoE2e;
  let semTurma: PessoaDoE2e;
  let renata: PessoaDoE2e;

  beforeAll(async () => {
    if (pastaDeCapturas) mkdirSync(pastaDeCapturas, { recursive: true });
    ambiente = await subirAmbienteE2e();
    navegador = await chromium.launch();
    rh = await ambiente.criarPessoa("RH", { nome: "Rita do RH", escopoGlobal: true });
    semTurma = await ambiente.criarPessoa("RH", { nome: "RH sem turma", escopoGlobal: true });

    // A IA falsa dá aderência 10 (alerta vermelho) na situação 2 e uma ideia na situação 1.
    ambiente.ia.roteiro = {
      ...roteiroPadrao,
      aderencia: (n, escolha) => (n === 2 ? 10 : roteiroPadrao.aderencia(n, escolha)),
      contribuicao: (n) => (n === 1 ? SUGESTAO : null)
    };
    renata = await ambiente.novoParticipante({ nomeDoColaborador: "Renata Campos" });
    await ambiente.banco.db.client.query(
      `WITH t AS (INSERT INTO leadership_lab.turma (nome, curador_id)
                  SELECT 'Turma da Rita', id FROM "User" WHERE email = $1 RETURNING id)
       INSERT INTO leadership_lab.turma_participante (turma_id, participante_id)
       SELECT t.id, p.id FROM t, leadership_lab.participante p
         JOIN "User" u ON u.id = p.user_id WHERE u.email = $2`,
      [rh.email, renata.email]
    );
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

  const abas = (page: Page) => page.getByRole("navigation", { name: "Áreas do acompanhamento" });

  it("a participante faz o teste inteiro pela tela (com um alerta e uma ideia no caminho)", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, renata);
    await page.waitForURL("**/lab");
    await page.getByRole("checkbox", { name: "Li e estou ciente." }).check();
    await page.getByRole("button", { name: "Aceitar e continuar" }).click();
    await page.getByRole("heading", { name: "Pronto para o próximo teste" }).waitFor();
    await page.getByRole("button", { name: "Iniciar teste" }).click();
    await page.waitForURL("**/lab/teste");

    for (const [indice, tecla] of ["1", "2", "3", "2", "1"].entries()) {
      await page.getByText(`Situação ${indice + 1} de 5`, { exact: true }).waitFor();
      await page.keyboard.press(tecla);
      await page.getByRole("button", { name: "Confirmar resposta" }).click();
    }
    await page.waitForURL("**/lab/resultado/*");
    await page.getByRole("heading", { level: 1, name: "Resultado do teste" }).waitFor();
    await page.getByText("Aguardando validação").first().waitFor();
    // Ainda não validado: nenhuma nota de ajuste, e o participante já pode contestar.
    expect(await page.getByText(/ajustado pelo RH/).count()).toBe(0);
    await page.getByRole("heading", { name: "Discorda de algum ponto?" }).waitFor();
    await page.close();
  }, 120_000);

  it("o RH vê o que espera por ele: abas com número, fila, alerta e contribuição", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.getByRole("link", { name: "Acompanhamento do Lab" }).click();
    // O Acompanhamento abre no que pede decisão: a revisão.
    await page.waitForURL("**/lab/rh/revisao");
    await abas(page).getByRole("link", { name: "Revisão (1 pendente)" }).waitFor();
    await abas(page).getByRole("link", { name: "Alertas (1 pendente)" }).waitFor();
    await abas(page).getByRole("link", { name: "Contribuições (1 pendente)" }).waitFor();
    expect(
      await abas(page)
        .getByRole("link", { name: /^Contestações/ })
        .innerText()
    ).toBe("Contestações");

    const linha = page.getByRole("row", { name: /Renata Campos/ });
    await linha.getByText("Aguardando validação").waitFor();
    await linha.getByText("1 alerta").waitFor();
    await capturar(page, "21-fila-de-revisao");

    await abas(page)
      .getByRole("link", { name: /^Alertas/ })
      .click();
    const alerta = page.getByRole("row", { name: /Renata Campos/ });
    await alerta.getByText("Vermelho").waitFor();
    await alerta.getByText("Situação 2").waitFor();
    await alerta.getByRole("link", { name: "Abrir resultado" }).waitFor();
    await capturar(page, "22-alertas");

    await abas(page)
      .getByRole("link", { name: /^Contribuições/ })
      .click();
    await page.getByText(SUGESTAO).waitFor();
    await capturar(page, "23-contribuicoes");
    await page.close();
  }, 90_000);

  it("um RH sem a Renata em turma nenhuma não vê nada dela", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, semTurma);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/revisao`);
    await page.getByText("Nada aguardando validação").waitFor();
    expect(await page.getByText("Renata Campos").count()).toBe(0);
    await page.goto(`${ambiente.url}/lab/rh/alertas`);
    await page.getByText("Nenhum alerta aberto").waitFor();
    await page.goto(`${ambiente.url}/lab/rh/contribuicoes`);
    await page.getByText("Nenhuma contribuição pendente").waitFor();
    await page.close();
  }, 90_000);

  it("o RH revisa a ficha, ajusta um nível, valida (com confirmação) e a validação não se refaz", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/revisao`);
    await page.getByRole("link", { name: "Revisar o resultado de Renata Campos" }).click();
    await page.waitForURL("**/lab/rh/revisao/*");
    await page.getByRole("heading", { name: /Renata Campos/ }).waitFor();
    await page.getByText("Situação por situação").waitFor();
    await capturar(page, "24-ficha");

    // Abrir a situação 2 mostra a escolha, a aderência 10 e a avaliação.
    const situacao2 = page.locator("details", { hasText: "Situação 2" });
    await situacao2.getByText("Alerta vermelho").waitFor();
    await situacao2.locator("summary").click();
    await situacao2.getByText("Avaliação:").waitFor();

    // Mudar um nível exige a justificativa antes de falar com o servidor.
    const primeiraSkill = page.getByLabel(/Nível validado de/).first();
    const atual = Number(await primeiraSkill.inputValue());
    const novo = atual === 5 ? 4 : atual + 1;
    await primeiraSkill.selectOption(String(novo));
    await page.getByRole("button", { name: "Validar com 1 ajuste" }).click();
    await page
      .getByRole("alert")
      .getByText(/Explique o ajuste/)
      .waitFor();

    await page
      .getByLabel(/Justificativa/)
      .fill("Na conversa, a Renata mostrou mais do que o teste captou.");
    await page.getByRole("button", { name: "Validar com 1 ajuste" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByText(/validação não se refaz/).waitFor();
    await capturar(page, "25-confirmar-validacao");
    await dialogo.getByRole("button", { name: "Validar com ajuste" }).click();

    await page.getByText(/Validado.* por Rita do RH/).waitFor();
    await page.getByText("Ajustado", { exact: true }).waitFor();
    expect(await page.getByRole("button", { name: /^Validar/ }).count()).toBe(0);
    expect(await page.getByLabel(/Nível validado de/).count()).toBe(0);
    await capturar(page, "26-ficha-validada");

    // Recarregar mostra a mesma coisa, só leitura.
    await page.reload();
    await page.getByText(/por Rita do RH/).waitFor();
    expect(await page.getByRole("button", { name: /^Validar/ }).count()).toBe(0);
    await page.close();
  }, 90_000);

  it("o RH encerra o alerta com a nota e aprova a contribuição; as abas passam a zero", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/alertas`);
    await page.getByRole("button", { name: "Encerrar o alerta de Renata Campos" }).click();
    const dialogo = page.getByRole("dialog");
    // Sem a nota, não encerra.
    await dialogo.getByRole("button", { name: "Encerrar alerta" }).click();
    await dialogo.getByText(/Escreva a nota da conversa/).waitFor();
    await dialogo
      .getByLabel("Nota da conversa")
      .fill("Conversamos sobre o episódio e combinamos revisar o procedimento.");
    await dialogo.getByRole("button", { name: "Encerrar alerta" }).click();
    await dialogo.waitFor({ state: "detached" });
    await page.getByText("Nenhum alerta aberto").waitFor();

    await abas(page)
      .getByRole("link", { name: /^Contribuições/ })
      .click();
    await page.getByRole("button", { name: "Aprovar a contribuição de Renata Campos" }).click();
    await page
      .getByRole("dialog")
      .getByText(/não se desfaz/)
      .waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Aprovar", exact: true }).click();
    await page.getByText("Nenhuma contribuição pendente").waitFor();

    // O que foi decidido continua consultável.
    await page.getByLabel("Mostrar").selectOption({ label: "Aprovadas" });
    await page.getByText(SUGESTAO).waitFor();
    await page.getByText(/Decidida por Rita do RH/).waitFor();

    // Os números das abas de alerta e de contribuição somem; a revisão também (já validada).
    await abas(page).getByRole("link", { name: "Alertas", exact: true }).waitFor();
    await abas(page).getByRole("link", { name: "Contribuições", exact: true }).waitFor();
    await abas(page).getByRole("link", { name: "Revisão", exact: true }).waitFor();
    await capturar(page, "27-contribuicao-aprovada");
    await page.close();
  }, 90_000);

  it("a participante abre o resultado pelo painel, vê o nível validado, e contesta um ponto", async () => {
    const dela = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(dela, renata);
    await dela.waitForURL("**/lab");
    await dela.getByRole("heading", { level: 1, name: "Leadership Lab" }).waitFor();
    // O painel conta o teste como validado e leva de volta ao resultado.
    await dela.getByText("1 validado pelo RH").waitFor();
    await capturar(dela, "28-painel-com-testes");
    await dela.getByRole("link", { name: /Ver o resultado do teste de/ }).click();
    await dela.waitForURL("**/lab/resultado/*");
    await dela.getByText("Validado com ajuste").first().waitFor();
    await dela.getByText(/Calculado: \d\/5 · ajustado pelo RH na validação/).waitFor();
    // A justificativa do RH fica com o RH.
    expect(await dela.getByText("mostrou mais do que o teste captou").count()).toBe(0);
    expect(await dela.getByText("Rita do RH").count()).toBe(0);

    // Contestar: sem o motivo, a tela não deixa; com ele, a contestação fica "em análise".
    await dela.getByLabel("O que você contesta").selectOption("Situação 2");
    await dela.getByRole("button", { name: "Enviar contestação" }).click();
    await dela.getByText(/Conte o motivo/).waitFor();
    await dela
      .getByLabel(/Por quê/)
      .fill("O cliente já tinha sido avisado antes da minha decisão.");
    await dela.getByRole("button", { name: "Enviar contestação" }).click();
    await dela.getByText(/Contestação enviada/).waitFor();
    await dela.getByText("Suas contestações").waitFor();
    await dela.getByText("Em análise").waitFor();
    await capturar(dela, "29-contestacao-enviada");
    await dela.close();
  }, 90_000);

  it("o RH decide a contestação com a nota, e a participante lê a resposta, sem o nome de quem decidiu", async () => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/contestacoes`);
    await abas(page).getByRole("link", { name: "Contestações (1 pendente)" }).waitFor();
    await page.getByText("O cliente já tinha sido avisado antes da minha decisão.").waitFor();
    await page.getByText("Validado com ajuste").waitFor(); // o estado do resultado contestado
    await capturar(page, "30-contestacoes");

    await page.getByRole("button", { name: "Decidir a contestação de Renata Campos" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByText(/Este resultado já foi validado/).waitFor();
    // Sem escolher e sem nota, não registra.
    await dialogo.getByRole("button", { name: "Registrar decisão" }).click();
    await dialogo.getByText(/Escolha se a contestação é aceita ou rejeitada/).waitFor();
    await dialogo.getByRole("radio", { name: "Aceitar a contestação" }).check();
    await dialogo.getByRole("button", { name: "Registrar decisão" }).click();
    await dialogo.getByText(/Escreva a nota/).waitFor();
    await dialogo
      .getByLabel("Nota para o participante")
      .fill("Revisamos o registro e você tem razão quanto ao aviso.");
    await dialogo.getByRole("button", { name: "Registrar decisão" }).click();
    await dialogo.waitFor({ state: "detached" });
    await page.getByText("Nenhuma contestação pendente").waitFor();

    await page.getByLabel("Mostrar").selectOption({ label: "Aceitas" });
    await page.getByText(/Decisão de Rita do RH em .*: Revisamos o registro/).waitFor();
    await page.close();

    // A participante lê a resposta, mas não o nome de quem decidiu.
    const dela = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(dela, renata);
    await dela.waitForURL("**/lab");
    await dela.getByRole("link", { name: /Ver o resultado do teste de/ }).click();
    await dela.waitForURL("**/lab/resultado/*");
    await dela.getByText("Suas contestações").waitFor();
    await dela.getByText("Aceita", { exact: true }).waitFor();
    await dela.getByText(/Resposta do RH:/).waitFor();
    await dela.getByText(/você tem razão quanto ao aviso/).waitFor();
    expect(await dela.getByText("Rita do RH").count()).toBe(0);
    await capturar(dela, "31-resposta-do-rh");
    await dela.close();
  }, 90_000);

  it("quem não é curador não abre a curadoria, e o participante não abre a ficha de ninguém", async () => {
    const comum = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await entrar(comum, renata);
    await comum.waitForURL("**/lab");
    for (const caminho of ["revisao", "alertas", "contestacoes", "contribuicoes"]) {
      await comum.goto(`${ambiente.url}/lab/rh/${caminho}`);
      await comum.getByText("Esta área não é para o seu perfil").waitFor();
    }
    await comum.close();
  }, 90_000);

  it("no celular, as telas da curadoria cabem, sem rolagem horizontal", async () => {
    const page = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await entrar(page, rh);
    await page.waitForURL("**/colaboradores");
    await page.goto(`${ambiente.url}/lab/rh/revisao?`);
    await page.getByLabel("Mostrar").selectOption({ label: "Todos" });
    const linha = page.getByRole("row", { name: /Renata Campos/ });
    await linha.waitFor();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await capturar(page, "32-celular-revisao");

    await linha.getByRole("link", { name: /Abrir|Revisar/ }).click();
    await page.getByText("Situação por situação").waitFor();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await capturar(page, "33-celular-ficha");

    for (const caminho of ["alertas", "contestacoes", "contribuicoes"]) {
      await page.goto(`${ambiente.url}/lab/rh/${caminho}`);
      await page
        .getByLabel("Mostrar")
        .selectOption({ label: caminho === "alertas" ? "Todos" : "Todas" });
      await page.getByText("Renata Campos").first().waitFor();
      expect(await semRolagemHorizontal(page), caminho).toBe(true);
    }
    await capturar(page, "34-celular-contribuicoes");
    await page.close();

    const dela = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await entrar(dela, renata);
    await dela.waitForURL("**/lab");
    await dela.getByRole("link", { name: /Ver o resultado do teste de/ }).click();
    await dela.getByText("Suas contestações").waitFor();
    expect(await semRolagemHorizontal(dela)).toBe(true);
    await capturar(dela, "35-celular-resultado-com-contestacao");
    await dela.close();
  }, 120_000);
});
