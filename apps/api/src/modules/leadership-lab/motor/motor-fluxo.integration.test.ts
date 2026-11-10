// Motor do teste: o fluxo de uma partida, ponta a ponta, contra PostgreSQL real e a IA falsa.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Veja db/test-database.ts.
import { calcularResultado, type LabEscolha, type TurnoResolvido } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import {
  type Banco,
  type Cenario,
  TEMPO_LIMITE_S,
  encerrarBanco,
  jogar,
  novoCenario,
  prepararBanco
} from "./cenario-de-teste.js";
import { CANARIO_JUSTIFICATIVA, roteiroPadrao } from "./ia-falsa.js";
import type { RespostaDeResultado, RespostaDeSituacao, RespostaDoTeste } from "./visoes.js";

function situacao(r: RespostaDoTeste): RespostaDeSituacao {
  if (r.tipo !== "situacao") throw new Error("era esperada uma situação, veio o resultado");
  return r;
}
function resultado(r: RespostaDoTeste): RespostaDeResultado {
  if (r.tipo !== "resultado") throw new Error("era esperado o resultado, veio uma situação");
  return r;
}

describe.skipIf(!integrationEnabled)("motor do teste: fluxo", () => {
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
  describe("uma partida completa", () => {
    const escolhas: LabEscolha[] = ["A", "B", "C", "B", "A"];
    let c: Cenario;
    let respostas: RespostaDoTeste[];

    beforeAll(async () => {
      c = await novoCenario(banco);
      respostas = await jogar(c, escolhas);
    }, 60_000);

    it("devolve a situação 1 e depois cada próxima, com a consequência da anterior e o marco na 3", () => {
      const numeros = respostas.slice(0, 5).map((r) => situacao(r).situacao.numero);
      expect(numeros).toEqual([1, 2, 3, 4, 5]);
      expect(situacao(respostas[0]!).situacao.consequencia).toBeNull();
      for (let i = 1; i < 5; i++) {
        const s = situacao(respostas[i]!).situacao;
        expect(s.consequencia).toContain(`[efeito-${i}]`);
        expect(s.marco).toBe(s.numero === 3);
        expect(s.tempoLimiteS).toBe(TEMPO_LIMITE_S);
        expect(s.opcoes.map((o) => o.id)).toEqual(["A", "B", "C"]);
      }
      expect(situacao(respostas[0]!).totalSituacoes).toBe(5);
    });

    it("termina com o resultado, depois da 5ª resposta", () => {
      const final = resultado(respostas[5]!);
      expect(respostas).toHaveLength(6);
      expect(final.consequencia).toContain("[efeito-5]");
      expect(final.tempoEsgotadoNaAnterior).toBe(false);
    });

    it("calcula os números no backend, não na IA", () => {
      const { resultado: r } = resultado(respostas[5]!);
      // Aderências: A=100, B=70, C=40, B=70, A=100 -> média 76.
      expect(r.aderenciaGeral).toBe(76);
      // Cada resposta levou 10 s, menos 3 s de tolerância: 7 s de 60 -> 88,33% por situação.
      expect(r.agilidade).toBe(88.33);
      expect(r.statusValidacao).toBe("aguardando_validacao");
      expect(r.niveisPorSkill.map((n) => [n.skillId, n.nivel, n.nEvidencias])).toEqual([
        ["gestao-os", 5, 1],
        ["contingencia", 5, 1],
        ["comunicacao-cliente", 4, 1],
        ["gestao-equipe", 4, 1],
        ["delegacao", 2, 1]
      ]);
      expect(r.situacoes.map((s) => s.aderencia)).toEqual([100, 70, 40, 70, 100]);
      expect(r.situacoes.map((s) => s.escolha)).toEqual(escolhas);
    });

    it("o resultado gravado é exatamente o de calcularResultado sobre as situações gravadas", async () => {
      const turnos = await consulta(
        `SELECT t.numero, t.aderencia, t.tempo_esgotado, t.tempo_resposta_ms, t.estilo, t.estilo_adequado,
                COALESCE(array_agg(ts.skill_id) FILTER (WHERE ts.skill_id IS NOT NULL), '{}') AS skills
           FROM leadership_lab.turno t LEFT JOIN leadership_lab.turno_skill ts ON ts.turno_id = t.id
          WHERE t.sessao_id = $1 GROUP BY t.id ORDER BY t.numero`,
        [respostas[0] && situacao(respostas[0]).sessaoId]
      );
      const independente = calcularResultado(
        turnos.map((t): TurnoResolvido => ({
          numero: t.numero,
          aderencia: t.aderencia,
          tempoEsgotado: t.tempo_esgotado,
          tempoRespostaMs: t.tempo_resposta_ms,
          estilo: t.estilo,
          estiloAdequado: t.estilo_adequado,
          skills: t.skills
        })),
        { tempoLimiteS: TEMPO_LIMITE_S }
      );
      const [gravado] = await consulta(
        `SELECT aderencia_geral, agilidade, estilo_predominante, flexibilidade_pct, flexibilidade, niveis_por_skill
           FROM leadership_lab.resultado WHERE sessao_id = $1`,
        [situacao(respostas[0]!).sessaoId]
      );
      expect(gravado).toMatchObject({
        aderencia_geral: independente.aderenciaGeral,
        agilidade: independente.agilidade,
        estilo_predominante: independente.estiloPredominante,
        flexibilidade_pct: independente.flexibilidadePct,
        flexibilidade: independente.flexibilidade,
        niveis_por_skill: independente.niveisPorSkill
      });
      expect(independente.estiloPredominante).toBe("orientacao");
    });

    it("grava a sessão como concluída, as situações avaliadas e o perfil por skill", async () => {
      const sessaoId = situacao(respostas[0]!).sessaoId;
      const [sessao] = await consulta(
        `SELECT status, concluida_em, ia_sessao_id FROM leadership_lab.sessao WHERE id = $1`,
        [sessaoId]
      );
      expect(sessao).toMatchObject({ status: "concluida" });
      expect(sessao.ia_sessao_id).toMatch(/^ses_falsa_\d+$/);
      expect(sessao.concluida_em).toBeInstanceOf(Date);

      const turnos = await consulta(
        `SELECT numero, escolha, tempo_resposta_ms, justificativa, processando_ate FROM leadership_lab.turno WHERE sessao_id = $1 ORDER BY numero`,
        [sessaoId]
      );
      expect(turnos).toHaveLength(5);
      expect(turnos.map((t) => t.escolha)).toEqual(escolhas);
      expect(turnos.every((t) => t.tempo_resposta_ms === 7000)).toBe(true);
      expect(turnos.every((t) => t.justificativa !== null && t.processando_ate === null)).toBe(
        true
      );

      const perfil = await consulta(
        `SELECT skill_id, nivel, validado FROM leadership_lab.perfil_skill WHERE sessao_id = $1`,
        [sessaoId]
      );
      expect(perfil).toHaveLength(5);
      expect(perfil.every((p) => p.validado === false)).toBe(true);
    });

    it("registra cada chamada à IA no log_ia, só com metadados", async () => {
      const logs = await consulta(
        `SELECT agente, modelo, versao_instrucao, tokens_entrada, tokens_saida, sucesso, codigo_erro, sessao_id
           FROM leadership_lab.log_ia WHERE sessao_id = $1`,
        [situacao(respostas[0]!).sessaoId]
      );
      expect(logs).toHaveLength(6); // 1 abertura + 5 turnos
      for (const log of logs) {
        expect(log).toMatchObject({
          agente: "agente_lab",
          modelo: "modelo-falso",
          versao_instrucao: "falsa-1",
          tokens_entrada: 100,
          tokens_saida: 50,
          sucesso: true,
          codigo_erro: null
        });
      }
    });

    it("não gera alerta numa partida sem linha vermelha, e chama a IA o mínimo", async () => {
      const alertas = await consulta(`SELECT 1 FROM leadership_lab.alerta WHERE sessao_id = $1`, [
        situacao(respostas[0]!).sessaoId
      ]);
      expect(alertas).toHaveLength(0);
      expect(c.ia.chamadas).toEqual({ abrir: 1, turno: 5, guarda: 0, conversa: 0 });
    });
  });

  // -------------------------------------------------------------------------
  describe("a aderência fica escondida durante o teste", () => {
    it("nenhuma resposta antes do resultado traz aderência, estilo, skills, alerta ou justificativa", async () => {
      const c = await novoCenario(banco);
      const respostas = await jogar(c, ["A", "B", "C", "B", "A"]);
      const durante = respostas.slice(0, 5);

      const chaves = new Set<string>();
      const coletar = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(coletar);
        else if (v && typeof v === "object") {
          for (const [k, filho] of Object.entries(v)) {
            chaves.add(k);
            coletar(filho);
          }
        }
      };
      durante.forEach(coletar);

      for (const proibida of [
        "aderencia",
        "estilo",
        "estiloAdequado",
        "estilo_adequado",
        "skills",
        "skill",
        "alerta",
        "justificativa",
        "agilidade",
        "niveisPorSkill",
        "resultado",
        "tempoRespostaMs",
        "textoLivre"
      ]) {
        expect(chaves.has(proibida), `chave proibida durante o teste: ${proibida}`).toBe(false);
      }
      // E o conteúdo secreto da avaliação (a justificativa) não aparece em lugar nenhum.
      expect(JSON.stringify(durante)).not.toContain(CANARIO_JUSTIFICATIVA);
    });

    it("a forma da resposta é exatamente a prevista", async () => {
      const c = await novoCenario(banco);
      const [abertura] = await jogar(c, []);
      const r = situacao(abertura!);
      expect(Object.keys(r).sort()).toEqual([
        "sessaoId",
        "situacao",
        "tempoEsgotadoNaAnterior",
        "tipo",
        "totalSituacoes"
      ]);
      expect(Object.keys(r.situacao).sort()).toEqual([
        "consequencia",
        "marco",
        "numero",
        "opcoes",
        "tempoLimiteS",
        "tempoRestanteMs",
        "texto"
      ]);
    });

    it("depois do último turno, o participante vê o resultado, com as justificativas", async () => {
      const c = await novoCenario(banco);
      const respostas = await jogar(c, ["A", "A", "A", "A", "A"]);
      const { resultado: r } = resultado(respostas[5]!);
      expect(r.situacoes[0]!.justificativa).toContain(CANARIO_JUSTIFICATIVA);
      expect(r.aderenciaGeral).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  describe("a mesma resposta duas vezes", () => {
    it("devolve o mesmo resultado, sem nova chamada à IA e sem duplicar a próxima situação", async () => {
      const c = await novoCenario(banco);
      const abertura = situacao(await c.motor.iniciar(c.ator));
      c.relogio.avancar(10_000);
      const entrada = { numero: 1, escolha: "B" } as const;
      const primeira = await c.motor.responder(c.ator, abertura.sessaoId, entrada);
      const repetida = await c.motor.responder(c.ator, abertura.sessaoId, entrada);

      expect(repetida).toEqual(primeira);
      expect(c.ia.chamadas.turno).toBe(1);
      const turnos = await consulta(
        `SELECT numero FROM leadership_lab.turno WHERE sessao_id = $1 ORDER BY numero`,
        [abertura.sessaoId]
      );
      expect(turnos.map((t) => t.numero)).toEqual([1, 2]);
    });

    it("repetir uma resposta antiga, depois de avançar, devolve o que ficou gravado", async () => {
      const c = await novoCenario(banco);
      const abertura = situacao(await c.motor.iniciar(c.ator));
      c.relogio.avancar(10_000);
      const primeira = situacao(
        await c.motor.responder(c.ator, abertura.sessaoId, { numero: 1, escolha: "B" })
      );
      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, abertura.sessaoId, { numero: 2, escolha: "A" });

      const repetida = situacao(
        await c.motor.responder(c.ator, abertura.sessaoId, { numero: 1, escolha: "B" })
      );
      // Só o relógio de tela muda; o resto é o que foi gravado.
      const semRelogio = (r: RespostaDeSituacao) => ({
        ...r,
        situacao: { ...r.situacao, tempoRestanteMs: 0 }
      });
      expect(semRelogio(repetida)).toEqual(semRelogio(primeira));
      expect(c.ia.chamadas.turno).toBe(2);
    });

    it("repetir a última resposta, depois do fim, devolve o resultado de novo", async () => {
      const c = await novoCenario(banco);
      const respostas = await jogar(c, ["A", "B", "C", "B", "A"]);
      const sessaoId = situacao(respostas[0]!).sessaoId;
      const repetida = await c.motor.responder(c.ator, sessaoId, { numero: 5, escolha: "A" });
      expect(repetida).toEqual(respostas[5]);
      expect(c.ia.chamadas.turno).toBe(5);
    });

    it("outra resposta para a mesma situação é recusada, sem chamar a IA", async () => {
      const c = await novoCenario(banco);
      const abertura = situacao(await c.motor.iniciar(c.ator));
      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, abertura.sessaoId, { numero: 1, escolha: "B" });
      await expect(
        c.motor.responder(c.ator, abertura.sessaoId, { numero: 1, escolha: "C" })
      ).rejects.toMatchObject({ statusCode: 409, code: "LAB_RESPOSTA_DIVERGENTE" });
      await expect(
        c.motor.tempoEsgotado(c.ator, abertura.sessaoId, { numero: 1 })
      ).rejects.toMatchObject({
        code: "LAB_RESPOSTA_DIVERGENTE"
      });
      expect(c.ia.chamadas.turno).toBe(1);
    });

    it("responder uma situação adiante da que está em andamento é recusado", async () => {
      const c = await novoCenario(banco);
      const abertura = situacao(await c.motor.iniciar(c.ator));
      await expect(
        c.motor.responder(c.ator, abertura.sessaoId, { numero: 3, escolha: "A" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "LAB_TURNO_FORA_DE_ORDEM",
        details: { situacaoEmAndamento: 1 }
      });
      expect(c.ia.chamadas.turno).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("o tempo é medido no servidor", () => {
    async function comSituacao1() {
      const c = await novoCenario(banco);
      const abertura = situacao(await c.motor.iniciar(c.ator));
      return { c, sessaoId: abertura.sessaoId };
    }
    const dadosDoTurno1 = (sessaoId: string) =>
      consulta(
        `SELECT escolha, tempo_esgotado, tempo_resposta_ms, aderencia, texto_livre, decisao_guarda
           FROM leadership_lab.turno WHERE sessao_id = $1 AND numero = 1`,
        [sessaoId]
      ).then((l) => l[0]);

    it("responder dentro do prazo mais a tolerância vale, e o tempo gravado já desconta a tolerância", async () => {
      const { c, sessaoId } = await comSituacao1();
      c.relogio.avancar(62_000); // 62 s - 3 s = 59 s, dentro dos 60 s
      const r = situacao(await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "A" }));
      expect(r.tempoEsgotadoNaAnterior).toBe(false);
      expect(await dadosDoTurno1(sessaoId)).toMatchObject({
        escolha: "A",
        tempo_esgotado: false,
        tempo_resposta_ms: 59_000,
        aderencia: 100
      });
    });

    it("exatamente no limite (60 s depois da tolerância) ainda vale; 1 ms depois, não", async () => {
      const a = await comSituacao1();
      a.c.relogio.avancar(63_000);
      expect(
        situacao(await a.c.motor.responder(a.c.ator, a.sessaoId, { numero: 1, escolha: "A" }))
          .tempoEsgotadoNaAnterior
      ).toBe(false);

      const b = await comSituacao1();
      b.c.relogio.avancar(63_001);
      expect(
        situacao(await b.c.motor.responder(b.c.ator, b.sessaoId, { numero: 1, escolha: "A" }))
          .tempoEsgotadoNaAnterior
      ).toBe(true);
    });

    it("resposta fora do prazo vale como omissão: a letra e o texto livre são descartados e a IA nem os vê", async () => {
      const { c, sessaoId } = await comSituacao1();
      c.ia.decisaoDaGuarda = "seguir";
      c.relogio.avancar(64_000);
      const r = situacao(
        await c.motor.responder(c.ator, sessaoId, {
          numero: 1,
          escolha: "A",
          textoLivre: "Eu faria diferente."
        })
      );

      expect(r.tempoEsgotadoNaAnterior).toBe(true);
      expect(r.situacao.numero).toBe(2);
      expect(r.situacao.consequencia).toContain("[efeito-1]"); // o efeito de não decidir
      expect(await dadosDoTurno1(sessaoId)).toEqual({
        escolha: null,
        tempo_esgotado: true,
        tempo_resposta_ms: null,
        aderencia: 0,
        texto_livre: null,
        decisao_guarda: null
      });
      expect(JSON.parse(c.ia.corpos.at(-1) as string)).toMatchObject({
        escolha: null,
        tempo_esgotado: true,
        texto_livre: null
      });
      expect(c.ia.chamadas.guarda).toBe(0);
    });

    it("o aviso do cliente de que o tempo acabou só vale se o relógio do servidor concorda", async () => {
      const { c, sessaoId } = await comSituacao1();
      c.relogio.avancar(30_000);
      await expect(c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 })).rejects.toMatchObject({
        statusCode: 409,
        code: "LAB_TEMPO_NAO_ESGOTADO",
        details: { tempoRestanteMs: 30_000 }
      });
      // Nada mudou: ainda dá para responder.
      expect(await dadosDoTurno1(sessaoId)).toMatchObject({ escolha: null, tempo_esgotado: false });
      expect(c.ia.chamadas.turno).toBe(0);

      c.relogio.avancar(30_000); // 60 s no relógio do servidor
      const r = situacao(await c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 }));
      expect(r.tempoEsgotadoNaAnterior).toBe(true);
      expect(r.situacao.numero).toBe(2);
      expect(await dadosDoTurno1(sessaoId)).toMatchObject({
        escolha: null,
        tempo_esgotado: true,
        aderencia: 0
      });
    });

    it("repetir o aviso de tempo esgotado, ou responder depois dele, devolve o mesmo desfecho", async () => {
      const { c, sessaoId } = await comSituacao1();
      c.relogio.avancar(61_000);
      const primeira = await c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 });
      expect(await c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 })).toEqual(primeira);
      // Uma resposta tardia que chega depois do aviso não reabre a situação.
      expect(await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "A" })).toEqual(
        primeira
      );
      expect(c.ia.chamadas.turno).toBe(1);
    });

    it("recarregar a página não zera o relógio: o tempo restante vem do servidor", async () => {
      const { c, sessaoId } = await comSituacao1();
      c.relogio.avancar(20_000);
      const retomada = situacao(await c.motor.iniciar(c.ator));
      expect(retomada.sessaoId).toBe(sessaoId);
      expect(retomada.situacao.numero).toBe(1);
      expect(retomada.situacao.tempoRestanteMs).toBe(40_000);
      expect(c.ia.chamadas.abrir).toBe(1);
      expect(
        await consulta(`SELECT 1 FROM leadership_lab.sessao WHERE participante_id = $1`, [
          c.ctx.participanteId
        ])
      ).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe("omissão, linha vermelha e contribuição numa partida", () => {
    it("calcula com o tempo esgotado, avisa o curador na hora da linha vermelha e guarda a contribuição", async () => {
      const c = await novoCenario(banco);
      c.ia.roteiro = {
        ...roteiroPadrao,
        aderencia: (n, e) => (n === 3 && e === "C" ? 10 : roteiroPadrao.aderencia(n, e)),
        contribuicao: (n) =>
          n === 4 ? "Incluir o aviso ao solicitante no passo de remarcação." : null
      };
      const abertura = situacao(await c.motor.iniciar(c.ator));
      const id = abertura.sessaoId;

      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, id, { numero: 1, escolha: "A" });
      c.relogio.avancar(61_000);
      const apos2 = situacao(await c.motor.tempoEsgotado(c.ator, id, { numero: 2 }));
      expect(apos2.tempoEsgotadoNaAnterior).toBe(true);

      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, id, { numero: 3, escolha: "C" });
      // O alerta vermelho existe ANTES do fim do teste, para o curador ser avisado.
      const vermelhos = await consulta(
        `SELECT a.cor, a.status, t.numero FROM leadership_lab.alerta a JOIN leadership_lab.turno t ON t.id = a.turno_id WHERE a.sessao_id = $1`,
        [id]
      );
      expect(vermelhos).toEqual([{ cor: "vermelho", status: "aberto", numero: 3 }]);

      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, id, { numero: 4, escolha: "B" });
      c.relogio.avancar(10_000);
      const final = resultado(await c.motor.responder(c.ator, id, { numero: 5, escolha: "A" }));

      // Aderências 100, 0 (omissão), 10 (linha vermelha), 70, 100 -> 56.
      expect(final.resultado.aderenciaGeral).toBe(56);
      // Agilidade: 4 situações a 88,33% e uma a 0 -> 70,67.
      expect(final.resultado.agilidade).toBe(70.67);
      expect(final.resultado.situacoes.map((s) => s.aderencia)).toEqual([100, 0, 10, 70, 100]);
      expect(final.resultado.situacoes[1]).toMatchObject({
        escolha: null,
        tempoEsgotado: true,
        tempoRespostaMs: null
      });
      // A omissão conta contra a skill que a IA ligou a ela.
      expect(
        final.resultado.niveisPorSkill.find((n) => n.skillId === "comunicacao-cliente")
      ).toMatchObject({ nivel: 1, media: 0 });
      expect(final.resultado.niveisPorSkill.find((n) => n.skillId === "delegacao")).toMatchObject({
        nivel: 1,
        media: 10
      });

      // Sem alerta duplicado, e a contribuição foi para a fila do curador.
      expect(
        await consulta(`SELECT 1 FROM leadership_lab.alerta WHERE sessao_id = $1`, [id])
      ).toHaveLength(1);
      const contribuicoes = await consulta(
        `SELECT c.texto, c.status, t.numero FROM leadership_lab.contribuicao c JOIN leadership_lab.turno t ON t.id = c.turno_id WHERE c.sessao_id = $1`,
        [id]
      );
      expect(contribuicoes).toEqual([
        {
          texto: "Incluir o aviso ao solicitante no passo de remarcação.",
          status: "pendente",
          numero: 4
        }
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe("alerta amarelo: a mesma skill abaixo de 50 em dois testes seguidos", () => {
    it("só dispara no segundo teste seguido com média abaixo de 50", async () => {
      const c = await novoCenario(banco);
      // Em todos os testes a primeira situação liga "gestao-os". B=70, C=40, A=100.
      const sessoes: string[] = [];
      for (const primeira of ["B", "C", "C", "A"] as const) {
        const respostas = await jogar(c, [primeira, "A", "A", "A", "A"]);
        sessoes.push(situacao(respostas[0]!).sessaoId);
        c.relogio.avancar(60_000);
      }
      const amarelos = await consulta(
        `SELECT sessao_id, skill_id, status FROM leadership_lab.alerta WHERE cor = 'amarelo' AND sessao_id = ANY($1::uuid[])`,
        [sessoes]
      );
      // Teste 1: 70. Teste 2: 40 (o anterior era 70). Teste 3: 40 (o anterior era 40): dispara. Teste 4: 100.
      expect(amarelos).toEqual([
        { sessao_id: sessoes[2], skill_id: "gestao-os", status: "aberto" }
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe("iniciar e retomar", () => {
    it("iniciar com um teste em andamento devolve o mesmo, sem chamar a IA nem criar outro", async () => {
      const c = await novoCenario(banco);
      const primeira = situacao(await c.motor.iniciar(c.ator));
      c.relogio.avancar(5_000);
      const segunda = situacao(await c.motor.iniciar(c.ator));
      expect(segunda.sessaoId).toBe(primeira.sessaoId);
      expect(c.ia.chamadas.abrir).toBe(1);
    });

    it("retomar no meio do teste volta à situação atual com a consequência da anterior", async () => {
      const c = await novoCenario(banco);
      const abertura = situacao(await c.motor.iniciar(c.ator));
      c.relogio.avancar(10_000);
      await c.motor.responder(c.ator, abertura.sessaoId, { numero: 1, escolha: "B" });
      c.relogio.avancar(5_000);

      const retomada = situacao(await c.motor.iniciar(c.ator));
      expect(retomada.situacao.numero).toBe(2);
      expect(retomada.situacao.consequencia).toContain("[efeito-1]");
      expect(retomada.situacao.tempoRestanteMs).toBe(55_000);
      expect(c.ia.chamadas).toMatchObject({ abrir: 1, turno: 1 });
    });

    it("depois de concluir, iniciar abre um teste novo", async () => {
      const c = await novoCenario(banco);
      const primeiro = await jogar(c, ["A", "A", "A", "A", "A"]);
      const novo = situacao(await c.motor.iniciar(c.ator));
      expect(novo.sessaoId).not.toBe(situacao(primeiro[0]!).sessaoId);
      expect(novo.situacao.numero).toBe(1);
      expect(c.ia.chamadas.abrir).toBe(2);
    });
  });
});
