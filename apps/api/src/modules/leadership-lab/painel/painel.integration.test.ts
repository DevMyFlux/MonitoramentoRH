// O painel do participante, de ponta a ponta: partidas reais do motor (com a IA falsa) sobre
// PostgreSQL real, e o painel lido depois. Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import type { LabAtor, LabEscolha, LabEstilo } from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { inserir } from "../db/test-fixtures.js";
import {
  type Banco,
  type Cenario,
  encerrarBanco,
  jogar,
  novoCenario,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { CANARIO_JUSTIFICATIVA, roteiroPadrao } from "../motor/ia-falsa.js";
import type { RespostaDeResultado } from "../motor/visoes.js";
import { consultarPainel } from "./consulta.js";
import type { PainelDoParticipante } from "./tipos.js";

const TODAS_A: LabEscolha[] = ["A", "A", "A", "A", "A"];

const semAcao = (p: PainelDoParticipante) =>
  Object.fromEntries(Object.entries(p).filter(([chave]) => chave !== "acao"));

function resultadoDe(respostas: Awaited<ReturnType<typeof jogar>>): RespostaDeResultado {
  const ultima = respostas.at(-1);
  if (ultima?.tipo !== "resultado") throw new Error("o teste não terminou");
  return ultima;
}

describe.skipIf(!integrationEnabled)("painel do participante", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  // -------------------------------------------------------------------------
  describe("participante sem nenhum teste", () => {
    it("traz tudo vazio, as 8 skills no radar e o botão de iniciar", async () => {
      const c = await novoCenario(banco);
      const p = await c.motor.painel(c.ator);

      expect(p.termo).toMatchObject({ versaoAtual: "2026-1", aceito: true });
      expect(p.acao).toMatchObject({ tipo: "iniciar", molde: { nivel: "supervisor" } });
      expect(p.indicadores).toEqual({
        testesFeitos: 0,
        testesValidados: 0,
        aderenciaMedia: null,
        agilidadeMedia: null,
        ultimoTesteEm: null
      });
      expect(p.evolucao).toEqual({ pontos: [], tendenciaDisponivel: false });
      expect(p.skills).toHaveLength(8);
      expect(p.skills.every((s) => s.nivel === null && s.nEvidencias === 0)).toBe(true);
      expect(p.tipoDePerfil).toEqual({ disponivel: false, testesFeitos: 0, testesNecessarios: 3 });
      expect(p.alertas).toEqual([]);
      expect(p.sugestoes).toEqual({ itens: [], origem: null });
    });

    it("sem o termo aceito, o painel diz isso e bloqueia o botão", async () => {
      const c = await novoCenario(banco, { termoAceito: false });
      const p = await c.motor.painel(c.ator);
      expect(p.termo).toEqual({ versaoAtual: "2026-1", aceito: false, aceitoEm: null });
      expect(p.acao).toMatchObject({ tipo: "indisponivel", motivo: "termo-pendente" });
    });
  });

  // -------------------------------------------------------------------------
  describe("depois de um teste concluído", () => {
    let c: Cenario;
    let final: RespostaDeResultado;
    let painel: PainelDoParticipante;

    beforeAll(async () => {
      c = await novoCenario(banco);
      final = resultadoDe(await jogar(c, ["A", "B", "C", "B", "A"]));
      painel = await c.motor.painel(c.ator);
    }, 60_000);

    it("os indicadores são os do teste: aderência 76, agilidade 88,33, um teste", () => {
      expect(painel.indicadores).toMatchObject({
        testesFeitos: 1,
        testesValidados: 0,
        aderenciaMedia: 76,
        agilidadeMedia: 88.33
      });
      expect(painel.indicadores.ultimoTesteEm).toBeInstanceOf(Date);
      expect(painel.indicadores.ultimoTesteEm?.toISOString()).toBe(final.resultado.concluidaEm);
    });

    it("a evolução tem um ponto, ligado ao resultado, com o selo e quantas escolhas o sustentam", () => {
      expect(painel.evolucao.tendenciaDisponivel).toBe(false);
      expect(painel.evolucao.pontos).toEqual([
        {
          resultadoId: final.resultado.resultadoId,
          sessaoId: final.sessaoId,
          concluidaEm: expect.any(Date),
          aderenciaGeral: 76,
          agilidade: 88.33,
          statusValidacao: "aguardando_validacao",
          nSituacoes: 5
        }
      ]);
    });

    it("o radar tem os mesmos níveis do resultado, com quantas escolhas os sustentam, e as outras skills vazias", () => {
      const porId = Object.fromEntries(painel.skills.map((s) => [s.skillId, s]));
      for (const nivel of final.resultado.niveisPorSkill) {
        expect(porId[nivel.skillId], nivel.skillId).toMatchObject({
          nivel: nivel.nivel,
          nivelCalculado: nivel.nivel,
          nEvidencias: nivel.nEvidencias,
          validado: false,
          resultadoId: final.resultado.resultadoId,
          sessaoId: final.sessaoId
        });
      }
      expect(porId["gestao-os"]).toMatchObject({ nivel: 5, tipo: "hard" });
      expect(porId["delegacao"]).toMatchObject({ nivel: 2, tipo: "soft" });
      // Sem evidência neste teste.
      expect(porId["materiais-custos"]).toMatchObject({
        nivel: null,
        nEvidencias: 0,
        resultadoId: null
      });
      expect(porId["decisao-pressao"]).toMatchObject({ nivel: null, nEvidencias: 0 });
    });

    it("ainda não há perfil (1 de 3 testes), nem alertas; as sugestões são as do debriefing", () => {
      expect(painel.tipoDePerfil).toEqual({
        disponivel: false,
        testesFeitos: 1,
        testesNecessarios: 3
      });
      expect(painel.alertas).toEqual([]);
      expect(painel.sugestoes.itens).toEqual([
        "Registre o aviso ao solicitante antes de remarcar."
      ]);
      expect(painel.sugestoes.origem).toMatchObject({
        resultadoId: final.resultado.resultadoId,
        sessaoId: final.sessaoId,
        statusValidacao: "aguardando_validacao"
      });
    });

    it("o botão volta a ser iniciar", () => {
      expect(painel.acao.tipo).toBe("iniciar");
    });

    it("nenhuma justificativa, resposta da IA ou dado de avaliação por situação vai para o painel", () => {
      const texto = JSON.stringify(painel);
      expect(texto).not.toContain(CANARIO_JUSTIFICATIVA);
      for (const chave of [
        "justificativa",
        "respostaIa",
        "resposta_ia",
        "estiloAdequado",
        "textoLivre",
        "processandoAte"
      ]) {
        expect(texto, chave).not.toContain(`"${chave}"`);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("com 3 testes: tendência e tipo de perfil", () => {
    it("o perfil junta as escolhas dos três testes e confere com uma contagem independente em SQL", async () => {
      const c = await novoCenario(banco);
      const estilosPor = (f: (n: number) => LabEstilo | null) => ({ ...roteiroPadrao, estilo: f });
      // Teste 1: tudo "apoio". Teste 2: "direcao" e, na última, "orientacao". Teste 3: o padrão.
      c.ia.roteiro = estilosPor((n) => (n === 4 ? null : "apoio"));
      await jogar(c, TODAS_A);
      c.ia.roteiro = estilosPor((n) => (n === 4 ? null : n === 5 ? "orientacao" : "direcao"));
      await jogar(c, TODAS_A);
      c.ia.roteiro = roteiroPadrao;
      await jogar(c, TODAS_A);

      const p = await c.motor.painel(c.ator);
      expect(p.evolucao.tendenciaDisponivel).toBe(true);
      expect(p.evolucao.pontos).toHaveLength(3);
      if (!p.tipoDePerfil.disponivel) throw new Error("o perfil deveria estar disponível");

      // O oráculo: conta as escolhas direto no banco, sem usar o código do painel.
      const linhas = await consulta(
        `SELECT t.estilo, t.estilo_adequado FROM leadership_lab.turno t
           JOIN leadership_lab.sessao s ON s.id = t.sessao_id
          WHERE s.participante_id = $1 AND s.status = 'concluida'
            AND NOT t.tempo_esgotado AND t.estilo IS NOT NULL`,
        [c.ctx.participanteId]
      );
      const contagem: Record<string, number> = {
        direcao: 0,
        orientacao: 0,
        apoio: 0,
        delegacao: 0
      };
      for (const l of linhas)
        contagem[l.estilo as string] = (contagem[l.estilo as string] ?? 0) + 1;
      const adequadas = linhas.filter((l) => l.estilo === l.estilo_adequado).length;

      expect(linhas).toHaveLength(12); // 4 escolhas por teste (a 4ª situação não envolve a equipe)
      expect(p.tipoDePerfil.distribuicao).toEqual(contagem);
      expect(p.tipoDePerfil.nEscolhas).toBe(12);
      expect(p.tipoDePerfil.flexibilidadePct).toBe(Math.round((adequadas / 12) * 10000) / 100);
      expect(p.tipoDePerfil).toMatchObject({
        estiloPredominante: "orientacao", // 5 contra 4 (apoio) e 3 (direcao)
        flexibilidade: "media", // 5 de 12 adequadas = 41,67%: logo acima do corte de 40%
        testesConsiderados: 3,
        testesAguardandoValidacao: 3
      });
    });

    it("a evolução vem em ordem cronológica, do mais antigo ao mais novo", async () => {
      const c = await novoCenario(banco);
      await jogar(c, ["C", "C", "C", "C", "C"]); // 40
      await jogar(c, ["B", "B", "B", "B", "B"]); // 70
      await jogar(c, TODAS_A); // 100
      const { evolucao } = await c.motor.painel(c.ator);
      expect(evolucao.pontos.map((x) => x.aderenciaGeral)).toEqual([40, 70, 100]);
      const datas = evolucao.pontos.map((x) => x.concluidaEm.getTime());
      expect([...datas].sort((a, b) => a - b)).toEqual(datas);
    });
  });

  // -------------------------------------------------------------------------
  describe("o teste em andamento NÃO aparece (a aderência é escondida até o fim)", () => {
    const redLine = {
      ...roteiroPadrao,
      aderencia: (n: number, e: LabEscolha) =>
        n === 2 && e === "C" ? (10 as const) : roteiroPadrao.aderencia(n, e)
    };

    it("responder uma situação com linha vermelha não muda NADA do painel até o último turno", async () => {
      const c = await novoCenario(banco);
      c.ia.roteiro = redLine;
      await jogar(c, TODAS_A);
      const antes = await c.motor.painel(c.ator);
      expect(antes.indicadores.testesFeitos).toBe(1);

      // Novo teste: abre, responde a 1 e responde a 2 com a escolha que cruza a linha vermelha.
      const abertura = await c.motor.iniciar(c.ator);
      const durante1 = await c.motor.painel(c.ator);
      expect(durante1.acao).toMatchObject({
        tipo: "continuar",
        situacaoAtual: 1,
        totalSituacoes: 5
      });
      expect(semAcao(durante1)).toEqual(semAcao(antes));

      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, abertura.sessaoId, { numero: 1, escolha: "A" });
      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, abertura.sessaoId, { numero: 2, escolha: "C" });

      // O alerta vermelho EXISTE (o curador precisa ser avisado na hora)...
      const vermelhos = await consulta(
        `SELECT a.status, s.status AS sessao FROM leadership_lab.alerta a
           JOIN leadership_lab.sessao s ON s.id = a.sessao_id WHERE a.sessao_id = $1 AND a.cor = 'vermelho'`,
        [abertura.sessaoId]
      );
      expect(vermelhos).toEqual([{ status: "aberto", sessao: "em_andamento" }]);

      // ...mas o participante não pode saber: o painel é igual ao de antes, salvo o botão.
      const durante2 = await c.motor.painel(c.ator);
      expect(durante2.acao).toMatchObject({ tipo: "continuar", situacaoAtual: 3 });
      expect(semAcao(durante2)).toEqual(semAcao(antes));
      expect(durante2.alertas).toEqual([]);
      expect(JSON.stringify(durante2)).not.toContain(CANARIO_JUSTIFICATIVA);
    });

    it("ao concluir, o alerta e o teste passam a aparecer", async () => {
      const c = await novoCenario(banco);
      c.ia.roteiro = redLine;
      const abertura = await c.motor.iniciar(c.ator);
      for (const n of [1, 2, 3, 4, 5]) {
        c.relogio.avancar(10_000);
        await c.motor.responder(c.ator, abertura.sessaoId, {
          numero: n,
          escolha: n === 2 ? "C" : "A"
        });
      }
      const p = await c.motor.painel(c.ator);
      expect(p.indicadores.testesFeitos).toBe(1);
      expect(p.alertas).toHaveLength(1);
      expect(p.alertas[0]).toMatchObject({
        cor: "vermelho",
        situacao: 2,
        skill: null,
        teste: { sessaoId: abertura.sessaoId }
      });
    });

    it("com 3 testes concluídos, as escolhas de um quarto em andamento não entram no perfil", async () => {
      const c = await novoCenario(banco);
      for (let i = 0; i < 3; i++) await jogar(c, TODAS_A);
      const antes = await c.motor.painel(c.ator);
      expect(antes.tipoDePerfil).toMatchObject({ disponivel: true, nEscolhas: 12 });

      // Um quarto teste, todo em "direcao", respondido até a metade.
      c.ia.roteiro = { ...roteiroPadrao, estilo: () => "direcao" };
      const abertura = await c.motor.iniciar(c.ator);
      for (const n of [1, 2, 3]) {
        c.relogio.avancar(10_000);
        await c.motor.responder(c.ator, abertura.sessaoId, { numero: n, escolha: "A" });
      }
      const durante = await c.motor.painel(c.ator);
      expect(durante.acao.tipo).toBe("continuar");
      expect(semAcao(durante)).toEqual(semAcao(antes));
    });

    it("um teste abandonado no meio não conta como feito", async () => {
      const c = await novoCenario(banco);
      await c.motor.iniciar(c.ator);
      const p = await c.motor.painel(c.ator);
      expect(p.indicadores.testesFeitos).toBe(0);
      expect(p.evolucao.pontos).toEqual([]);
      expect(p.sugestoes.origem).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("skills: o nível mais recente de cada uma", () => {
    it("uma skill que não apareceu no último teste mantém o nível do teste em que apareceu", async () => {
      const c = await novoCenario(banco);
      const primeiro = resultadoDe(await jogar(c, ["C", "A", "A", "A", "A"]));
      // No segundo teste, só "gestao-os" é avaliada.
      c.ia.roteiro = { ...roteiroPadrao, skills: (n) => (n <= 2 ? ["gestao-os"] : []) };
      const segundo = resultadoDe(await jogar(c, TODAS_A));

      const porId = Object.fromEntries(
        (await c.motor.painel(c.ator)).skills.map((s) => [s.skillId, s])
      );
      // gestao-os: 40 no primeiro teste (nível 2), 100 no segundo (nível 5, duas escolhas). Vale o segundo.
      expect(porId["gestao-os"]).toMatchObject({
        nivel: 5,
        nEvidencias: 2,
        resultadoId: segundo.resultado.resultadoId
      });
      // delegacao só apareceu no primeiro teste: o nível dele continua no radar.
      expect(porId["delegacao"]).toMatchObject({
        nivel: 5,
        nEvidencias: 1,
        resultadoId: primeiro.resultado.resultadoId
      });
    });

    it("depois da revisão do curador, o radar mostra o nível dele e guarda o calculado", async () => {
      const c = await novoCenario(banco);
      const final = resultadoDe(await jogar(c, TODAS_A));
      // O que o curador faz (Etapa 5): ajusta um nível, com justificativa, e valida o resto.
      await consulta(
        `UPDATE leadership_lab.resultado
            SET status_validacao = 'ajustado', validado_por = gen_random_uuid(), validado_em = now(),
                justificativa_validacao = 'Só uma evidência; nível 2.'
          WHERE sessao_id = $1`,
        [final.sessaoId]
      );
      await consulta(
        `UPDATE leadership_lab.perfil_skill
            SET validado = true, nivel_validado = CASE WHEN skill_id = 'gestao-os' THEN 2 ELSE nivel END
          WHERE sessao_id = $1`,
        [final.sessaoId]
      );

      const p = await c.motor.painel(c.ator);
      const porId = Object.fromEntries(p.skills.map((s) => [s.skillId, s]));
      expect(porId["gestao-os"]).toMatchObject({ nivel: 2, nivelCalculado: 5, validado: true });
      expect(porId["delegacao"]).toMatchObject({ nivel: 5, nivelCalculado: 5, validado: true });
      expect(p.indicadores).toMatchObject({ testesFeitos: 1, testesValidados: 1 });
      expect(p.evolucao.pontos[0]?.statusValidacao).toBe("ajustado");
      expect(p.sugestoes.origem?.statusValidacao).toBe("ajustado");
    });
  });

  // -------------------------------------------------------------------------
  describe("alertas", () => {
    it("o amarelo aparece com a skill; o vermelho, com a situação; vermelhos primeiro", async () => {
      const c = await novoCenario(banco);
      // Dois testes seguidos com gestao-os em 40 (amarelo no segundo), e o segundo com linha vermelha.
      await jogar(c, ["C", "A", "A", "A", "A"]);
      c.ia.roteiro = {
        ...roteiroPadrao,
        aderencia: (n, e) => (n === 3 && e === "C" ? 10 : roteiroPadrao.aderencia(n, e))
      };
      await jogar(c, ["C", "A", "C", "A", "A"]);

      const { alertas } = await c.motor.painel(c.ator);
      expect(alertas.map((a) => a.cor)).toEqual(["vermelho", "amarelo"]);
      expect(alertas[0]).toMatchObject({ situacao: 3, skill: null });
      expect(alertas[1]).toMatchObject({
        situacao: null,
        skill: { id: "gestao-os", nome: "Gestão de OS e prioridades" }
      });
    });

    it("o alerta encerrado pelo curador sai do painel", async () => {
      const c = await novoCenario(banco);
      c.ia.roteiro = {
        ...roteiroPadrao,
        aderencia: (n, e) => (n === 2 && e === "C" ? 10 : roteiroPadrao.aderencia(n, e))
      };
      await jogar(c, ["A", "C", "A", "A", "A"]);
      expect((await c.motor.painel(c.ator)).alertas).toHaveLength(1);

      await consulta(
        `UPDATE leadership_lab.alerta
            SET status = 'encerrado', tratado_por = gen_random_uuid(), tratado_em = now(), nota = 'Conversa registrada.'
          WHERE sessao_id IN (SELECT id FROM leadership_lab.sessao WHERE participante_id = $1)`,
        [c.ctx.participanteId]
      );
      expect((await c.motor.painel(c.ator)).alertas).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe("a ação concorda com o que iniciar() faz", () => {
    it("indisponível por cargo, molde ou limite, com o motivo", async () => {
      const semCargo = await novoCenario(banco, { nivel: null });
      expect((await semCargo.motor.painel(semCargo.ator)).acao).toEqual({
        tipo: "indisponivel",
        motivo: "cargo-nao-informado",
        molde: null,
        limiteDiario: null
      });

      const coordenador = await novoCenario(banco, { nivel: "coordenador" });
      expect((await coordenador.motor.painel(coordenador.ator)).acao).toMatchObject({
        tipo: "indisponivel",
        motivo: "molde-inativo",
        molde: { nivel: "coordenador" },
        limiteDiario: null
      });

      const limitado = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
      await jogar(limitado, TODAS_A);
      expect((await limitado.motor.painel(limitado.ator)).acao).toMatchObject({
        tipo: "indisponivel",
        motivo: "limite-diario",
        limiteDiario: 1,
        molde: { nivel: "supervisor" }
      });
      // E iniciar() confirma.
      await expect(limitado.motor.iniciar(limitado.ator)).rejects.toMatchObject({
        code: "LAB_LIMITE_DIARIO"
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("isolamento e permissões", () => {
    it("cada participante vê só o próprio painel", async () => {
      const ana = await novoCenario(banco);
      const bia = await novoCenario(banco);
      ana.ia.roteiro = {
        ...roteiroPadrao,
        aderencia: (n, e) => (n === 2 && e === "C" ? 10 : roteiroPadrao.aderencia(n, e))
      };
      await jogar(ana, ["A", "C", "A", "A", "A"]); // com linha vermelha
      await jogar(bia, ["B", "B", "B", "B", "B"]);
      await jogar(bia, ["B", "B", "B", "B", "B"]);

      const deAna = await ana.motor.painel(ana.ator);
      const deBia = await bia.motor.painel(bia.ator);
      expect(deAna.indicadores.testesFeitos).toBe(1);
      expect(deBia.indicadores.testesFeitos).toBe(2);
      expect(deAna.alertas).toHaveLength(1);
      expect(deBia.alertas).toEqual([]);
      expect(deBia.evolucao.pontos.every((x) => x.aderenciaGeral === 70)).toBe(true);
      expect(deAna.evolucao.pontos).toHaveLength(1);
    });

    it("só o participante vê o painel: RH, ADMIN e DEV recebem 403; sem vínculo, também", async () => {
      const c = await novoCenario(banco);
      const ator = (role: LabAtor["role"], participanteId: string | null = null): LabAtor => ({
        userId: crypto.randomUUID(),
        role,
        participanteId,
        permissoes: []
      });
      for (const intruso of [
        ator("RH"),
        ator("ADMIN"),
        ator("DEV"),
        ator("RH", c.ctx.participanteId)
      ]) {
        await expect(c.motor.painel(intruso), intruso.role).rejects.toMatchObject({
          statusCode: 403,
          code: "LAB_FORBIDDEN"
        });
      }
      await expect(c.motor.painel(ator("COMUM"))).rejects.toMatchObject({
        code: "LAB_SEM_VINCULO"
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("consistência: todos os blocos vêm do mesmo instante", () => {
    it("um teste que conclui no meio da leitura não aparece pela metade", async () => {
      const c = await novoCenario(banco);
      await jogar(c, TODAS_A);

      // Um banco que, logo depois da PRIMEIRA consulta da transação do painel, grava um novo teste
      // concluído em outra conexão, como se ele terminasse bem no meio da leitura.
      let jaGravou = false;
      const gravarOutroTeste = async () => {
        const molde = await consulta(
          `SELECT id FROM leadership_lab.molde WHERE nivel = 'supervisor'`
        );
        const sessao = await inserir(banco.db.client, "leadership_lab.sessao", {
          participante_id: c.ctx.participanteId,
          molde_id: molde[0]!.id,
          status: "concluida",
          iniciada_em: "2026-03-02T15:00:00.000Z",
          concluida_em: "2026-03-02T15:10:00.000Z"
        });
        await inserir(banco.db.client, "leadership_lab.resultado", {
          sessao_id: sessao,
          aderencia_geral: 10,
          agilidade: 10,
          resumo: "Concluído durante a leitura.",
          resposta_ia: "{}"
        });
      };
      const bancoQueGrava = {
        $transaction: (fn: (tx: unknown) => Promise<unknown>, opcoes: unknown) =>
          banco.prisma.$transaction(
            (tx) =>
              fn(
                new Proxy(tx, {
                  get(alvo, propriedade, receptor) {
                    if (propriedade !== "$queryRaw")
                      return Reflect.get(alvo, propriedade, receptor);
                    return async (...args: unknown[]) => {
                      const linhas = await (
                        alvo.$queryRaw as (...a: unknown[]) => Promise<unknown>
                      )(...args);
                      if (!jaGravou) {
                        jaGravou = true;
                        await gravarOutroTeste();
                      }
                      return linhas;
                    };
                  }
                })
              ),
            opcoes as never
          )
      } as unknown as PrismaClient;

      const p = await consultarPainel(bancoQueGrava, {
        participanteId: c.ctx.participanteId,
        config: c.config,
        agora: c.relogio.agora()
      });

      expect(jaGravou).toBe(true);
      // O painel é de UM instante: o cartão e o gráfico concordam, e nenhum viu o teste novo.
      expect(p.indicadores.testesFeitos).toBe(1);
      expect(p.evolucao.pontos).toHaveLength(1);
      // E o teste que terminou durante a leitura aparece na leitura seguinte.
      const depois = await c.motor.painel(c.ator);
      expect(depois.indicadores.testesFeitos).toBe(2);
      expect(depois.evolucao.pontos).toHaveLength(2);
    });
  });

  describe("modo demonstração", () => {
    it("o painel só diz que é demonstração quando a configuração do motor diz", async () => {
      const c = await novoCenario(banco);
      expect((await c.motor.painel(c.ator)).demonstracao).toBe(false);

      const emDemonstracao = await consultarPainel(banco.prisma, {
        participanteId: c.ctx.participanteId,
        config: { ...c.config, demonstracao: true },
        agora: c.relogio.agora()
      });
      expect(emDemonstracao.demonstracao).toBe(true);
    });
  });
});
