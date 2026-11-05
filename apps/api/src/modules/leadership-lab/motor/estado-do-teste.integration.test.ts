// Ler o teste em andamento (GET /sessoes/atual). SÓ lê: nunca começa um teste, nunca chama a IA e
// nunca grava. É o que a tela do teste usa ao abrir ou recarregar, então abrir o endereço por
// engano não pode disparar o relógio da situação 1.
// PostgreSQL real; exige LAB_TEST_DATABASE_URL (sem ela, é ignorado).
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
import { CANARIO_JUSTIFICATIVA } from "./ia-falsa.js";

describe.skipIf(!integrationEnabled)("ler o teste em andamento", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  /** Tudo o que o participante tem no banco, para provar que ler não muda nada. */
  const fotografia = async (c: Cenario) => {
    const participanteId = [c.ctx.participanteId];
    return {
      sessoes: await consulta(
        `SELECT * FROM leadership_lab.sessao WHERE participante_id = $1`,
        participanteId
      ),
      turnos: await consulta(
        `SELECT t.* FROM leadership_lab.turno t
           JOIN leadership_lab.sessao s ON s.id = t.sessao_id
          WHERE s.participante_id = $1 ORDER BY s.id, t.numero`,
        participanteId
      ),
      logs: await consulta(
        `SELECT l.id FROM leadership_lab.log_ia l
           JOIN leadership_lab.sessao s ON s.id = l.sessao_id
          WHERE s.participante_id = $1 ORDER BY l.id`,
        participanteId
      )
    };
  };

  const semTeste = { statusCode: 404, code: "LAB_SEM_TESTE_EM_ANDAMENTO" };

  // -------------------------------------------------------------------------
  describe("sem teste em andamento", () => {
    it("responde 404 e não começa nenhum teste", async () => {
      const c = await novoCenario(banco);

      await expect(c.motor.estadoDoTeste(c.ator)).rejects.toMatchObject(semTeste);

      expect((await fotografia(c)).sessoes).toHaveLength(0);
      expect(c.ia.chamadas).toEqual({ abrir: 0, turno: 0, guarda: 0 });
    });

    it("o termo não entra aqui: quem ainda não o aceitou também recebe 'sem teste'", async () => {
      const c = await novoCenario(banco, { termoAceito: false });
      await expect(c.motor.estadoDoTeste(c.ator)).rejects.toMatchObject(semTeste);
    });

    it("depois de concluir um teste, não há mais nenhum em andamento", async () => {
      const c = await novoCenario(banco);
      await jogar(c, ["A", "A", "A", "A", "A"]);
      await expect(c.motor.estadoDoTeste(c.ator)).rejects.toMatchObject(semTeste);
    });
  });

  // -------------------------------------------------------------------------
  describe("com teste em andamento", () => {
    it("devolve a situação em que o participante parou, igual ao que iniciar() devolveu", async () => {
      const c = await novoCenario(banco);
      const aberto = await c.motor.iniciar(c.ator);

      expect(await c.motor.estadoDoTeste(c.ator)).toEqual(aberto);
    });

    it("depois de responder, mostra a próxima situação com a consequência da escolha", async () => {
      const c = await novoCenario(banco);
      const respostas = await jogar(c, ["A"]);

      const estado = await c.motor.estadoDoTeste(c.ator);

      expect(estado).toEqual(respostas.at(-1));
      expect(estado).toMatchObject({ tipo: "situacao", situacao: { numero: 2 } });
      expect(estado.tipo === "situacao" && estado.situacao.consequencia).toBeTruthy();
    });

    it("o tempo que resta vem do relógio do servidor e diminui com ele", async () => {
      const c = await novoCenario(banco);
      await c.motor.iniciar(c.ator);

      c.relogio.avancar(15_000);
      const estado = await c.motor.estadoDoTeste(c.ator);

      expect(estado).toMatchObject({
        tipo: "situacao",
        situacao: { numero: 1, tempoLimiteS: TEMPO_LIMITE_S, tempoRestanteMs: 45_000 }
      });
    });

    it("com o prazo vencido devolve tempo restante 0 e NÃO marca omissão (quem decide é tempo-esgotado)", async () => {
      const c = await novoCenario(banco);
      await c.motor.iniciar(c.ator);
      c.relogio.avancar((TEMPO_LIMITE_S + 30) * 1000);

      const estado = await c.motor.estadoDoTeste(c.ator);

      expect(estado).toMatchObject({ tipo: "situacao", situacao: { tempoRestanteMs: 0 } });
      const [turno] = (await fotografia(c)).turnos;
      expect(turno).toMatchObject({ respondida_em: null, tempo_esgotado: false });
    });

    it("ler várias vezes não muda nada: nenhuma escrita, nenhuma chamada à IA, nenhuma sessão nova", async () => {
      const c = await novoCenario(banco);
      await jogar(c, ["A", "B"]);
      const antes = await fotografia(c);
      const chamadas = { ...c.ia.chamadas };

      for (let i = 0; i < 3; i++) await c.motor.estadoDoTeste(c.ator);

      expect(await fotografia(c)).toEqual(antes);
      expect(c.ia.chamadas).toEqual(chamadas);
    });
  });

  // -------------------------------------------------------------------------
  describe("resposta dada, avaliação ainda não aplicada (a IA falhou)", () => {
    it("devolve 'em-processamento', sem nada da avaliação; iniciar() conclui e a leitura segue em frente", async () => {
      const c = await novoCenario(banco);
      const aberto = await c.motor.iniciar(c.ator);
      if (aberto.tipo !== "situacao") throw new Error("esperava a situação 1");

      c.ia.falharNa("turno", "erro");
      c.relogio.avancar(10_000);
      await expect(
        c.motor.responder(c.ator, aberto.sessaoId, { numero: 1, escolha: "A" })
      ).rejects.toMatchObject({ code: "LAB_IA_INDISPONIVEL" });

      const estado = await c.motor.estadoDoTeste(c.ator);
      expect(estado).toEqual({
        tipo: "em-processamento",
        sessaoId: aberto.sessaoId,
        numero: 1,
        totalSituacoes: aberto.totalSituacoes
      });

      const retomado = await c.motor.iniciar(c.ator);
      expect(retomado).toMatchObject({ tipo: "situacao", situacao: { numero: 2 } });
      expect(await c.motor.estadoDoTeste(c.ator)).toEqual(retomado);
    });
  });

  // -------------------------------------------------------------------------
  describe("o que nunca aparece durante o teste", () => {
    const proibidos = [
      "aderencia",
      "estilo",
      "estiloAdequado",
      "estilo_adequado",
      "justificativa",
      "alerta",
      "skills",
      "niveis",
      CANARIO_JUSTIFICATIVA
    ];

    it("nem a situação seguinte, nem o 'em-processamento' carregam dado de avaliação", async () => {
      const c = await novoCenario(banco);
      const [, depoisDeA] = await jogar(c, ["A"]);
      const situacao = JSON.stringify(await c.motor.estadoDoTeste(c.ator));
      for (const palavra of proibidos) expect(situacao).not.toContain(palavra);
      expect(depoisDeA?.tipo).toBe("situacao");

      c.ia.falharNa("turno", "erro");
      c.relogio.avancar(5_000);
      if (depoisDeA?.tipo !== "situacao") throw new Error("esperava a situação 2");
      await expect(
        c.motor.responder(c.ator, depoisDeA.sessaoId, { numero: 2, escolha: "B" })
      ).rejects.toMatchObject({ code: "LAB_IA_INDISPONIVEL" });
      const emProcessamento = JSON.stringify(await c.motor.estadoDoTeste(c.ator));
      for (const palavra of proibidos) expect(emProcessamento).not.toContain(palavra);
    });
  });

  // -------------------------------------------------------------------------
  describe("permissões", () => {
    it("cada participante lê só o próprio teste", async () => {
      const a = await novoCenario(banco);
      const b = await novoCenario(banco);
      const abertoDeA = await a.motor.iniciar(a.ator);

      await expect(b.motor.estadoDoTeste(b.ator)).rejects.toMatchObject(semTeste);
      expect(await a.motor.estadoDoTeste(a.ator)).toEqual(abertoDeA);
    });

    it.each(["RH", "ADMIN"] as const)("o perfil %s não lê: 403", async (role) => {
      const c = await novoCenario(banco);
      await c.motor.iniciar(c.ator);
      await expect(c.motor.estadoDoTeste({ ...c.ator, role })).rejects.toMatchObject({
        statusCode: 403,
        code: "LAB_FORBIDDEN"
      });
    });

    it("COMUM ainda sem vínculo com um colaborador: 403 LAB_SEM_VINCULO", async () => {
      const c = await novoCenario(banco);
      await expect(
        c.motor.estadoDoTeste({ ...c.ator, participanteId: null })
      ).rejects.toMatchObject({ statusCode: 403, code: "LAB_SEM_VINCULO" });
    });
  });
});
