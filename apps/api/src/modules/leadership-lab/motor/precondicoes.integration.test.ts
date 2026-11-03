// Pré-condições de início: um estado por motivo, a ordem das verificações e, sobretudo, a
// concordância com iniciar(): o que o painel mostra é exatamente o que o servidor vai fazer.
// PostgreSQL real; exige LAB_TEST_DATABASE_URL (sem ela, é ignorado).
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
} from "./cenario-de-teste.js";
import { avaliarInicio, moldePronto, type EstadoDoInicio } from "./precondicoes.js";

describe.skipIf(!integrationEnabled)("pré-condições de início", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  const estadoDe = (c: Cenario): Promise<EstadoDoInicio> =>
    avaliarInicio(banco.prisma, {
      participanteId: c.ctx.participanteId,
      config: c.config,
      agora: c.relogio.agora()
    });

  // -------------------------------------------------------------------------
  describe("cada estado, e o que iniciar() faz com ele", () => {
    const casos: Array<{
      nome: string;
      estado: EstadoDoInicio["tipo"];
      /** Código do erro de iniciar(), ou null se iniciar() funciona. */
      erro: string | null;
      montar: () => Promise<Cenario>;
    }> = [
      {
        nome: "termo ainda não aceito",
        estado: "termo-pendente",
        erro: "LAB_TERMO_PENDENTE",
        montar: () => novoCenario(banco, { termoAceito: false })
      },
      {
        nome: "colaborador sem cargo informado",
        estado: "cargo-nao-informado",
        erro: "LAB_CARGO_NAO_INFORMADO",
        montar: () => novoCenario(banco, { nivel: null })
      },
      {
        nome: "cargo que não leva a nenhum molde",
        estado: "molde-nao-mapeado",
        erro: "LAB_MOLDE_NAO_MAPEADO",
        montar: async () => {
          const funcao = await inserir(banco.db.client, '"JobFunction"', {
            id: crypto.randomUUID(),
            name: "Cargo sem teste",
            updatedAt: new Date().toISOString()
          });
          return novoCenario(banco, { nivel: null, colaborador: { functionId: funcao } });
        }
      },
      {
        nome: "molde do cargo ainda não liberado",
        estado: "molde-inativo",
        erro: "LAB_MOLDE_INATIVO",
        montar: () => novoCenario(banco, { nivel: "coordenador" })
      },
      {
        nome: "limite de testes do dia atingido",
        estado: "limite-diario",
        erro: "LAB_LIMITE_DIARIO",
        montar: async () => {
          const c = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
          await jogar(c, ["A", "A", "A", "A", "A"]);
          return c;
        }
      },
      {
        nome: "tudo certo",
        estado: "iniciar",
        erro: null,
        montar: () => novoCenario(banco)
      }
    ];

    it.each(casos)("$nome -> $estado", async ({ estado, erro, montar }) => {
      const c = await montar();
      expect((await estadoDe(c)).tipo).toBe(estado);

      if (erro === null) {
        expect((await c.motor.iniciar(c.ator)).tipo).toBe("situacao");
      } else {
        await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({ code: erro });
      }
    });

    it("teste em andamento -> continuar, e iniciar() retoma exatamente esse teste", async () => {
      const c = await novoCenario(banco);
      const aberto = await c.motor.iniciar(c.ator);
      const estado = await estadoDe(c);

      expect(estado.tipo).toBe("continuar");
      if (estado.tipo !== "continuar") return;
      expect(estado.sessao.id).toBe(aberto.sessaoId);
      expect((await c.motor.iniciar(c.ator)).sessaoId).toBe(aberto.sessaoId);
    });
  });

  // -------------------------------------------------------------------------
  describe("ordem das verificações", () => {
    it("o termo vem antes de tudo, até de um teste em andamento", async () => {
      const c = await novoCenario(banco);
      await c.motor.iniciar(c.ator);
      // Sai uma nova versão do termo: quem estava no meio de um teste precisa aceitá-la.
      c.config.versaoTermo = "2027-1";
      expect((await estadoDe(c)).tipo).toBe("termo-pendente");
    });

    it("o termo vem antes do cargo", async () => {
      const c = await novoCenario(banco, { nivel: null, termoAceito: false });
      expect((await estadoDe(c)).tipo).toBe("termo-pendente");
    });

    it("um teste em andamento vem antes do molde e do limite: retomar nunca é barrado", async () => {
      const c = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
      await c.motor.iniciar(c.ator);
      // Mesmo com o molde desativado e o limite do dia atingido, quem tem teste aberto retoma.
      await consulta(`UPDATE leadership_lab.molde SET ativo = false WHERE nivel = 'supervisor'`);
      try {
        expect((await estadoDe(c)).tipo).toBe("continuar");
      } finally {
        await consulta(`UPDATE leadership_lab.molde SET ativo = true WHERE nivel = 'supervisor'`);
      }
    });

    it("molde não liberado vem antes do limite do dia (com as duas condições verdadeiras)", async () => {
      const c = await novoCenario(banco, { nivel: "coordenador", config: { limiteTestesDia: 1 } });
      // Um teste de hoje, feito antes de o molde ser desativado: o limite do dia já está atingido.
      const [{ id: molde }] = await consulta(
        `SELECT id FROM leadership_lab.molde WHERE nivel = 'coordenador'`
      );
      await consulta(
        `INSERT INTO leadership_lab.sessao (participante_id, molde_id, status, iniciada_em, concluida_em)
         VALUES ($1, $2, 'concluida', $3, $3)`,
        [c.ctx.participanteId, molde, c.relogio.agora()]
      );
      expect((await estadoDe(c)).tipo).toBe("molde-inativo");

      // Com o molde liberado, o mesmo participante cai no limite do dia.
      await consulta(
        `UPDATE leadership_lab.molde SET ativo = true, tempo_limite_s = 30 WHERE nivel = 'coordenador'`
      );
      try {
        expect((await estadoDe(c)).tipo).toBe("limite-diario");
      } finally {
        await consulta(
          `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = NULL WHERE nivel = 'coordenador'`
        );
      }
    });

    it("com o molde divergente, iniciar() recusa antes de dizer que o molde não está liberado", async () => {
      const c = await novoCenario(banco, { nivel: "coordenador" });
      const [{ id: supervisor }] = await consulta(
        `SELECT id FROM leadership_lab.molde WHERE nivel = 'supervisor'`
      );
      await expect(c.motor.iniciar(c.ator, { moldeId: supervisor })).rejects.toMatchObject({
        code: "LAB_MOLDE_DIVERGENTE"
      });
    });

    it("mas cargo e mapeamento vêm antes da divergência", async () => {
      const c = await novoCenario(banco, { nivel: null });
      await expect(c.motor.iniciar(c.ator, { moldeId: crypto.randomUUID() })).rejects.toMatchObject(
        {
          code: "LAB_CARGO_NAO_INFORMADO"
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("molde pronto", () => {
    const molde = (extra: Record<string, unknown>) =>
      ({
        ativo: true,
        tempoLimiteS: 60,
        temas: ["Prioridade de OS"],
        ...extra
      }) as Parameters<typeof moldePronto>[0];

    it("exige ativo, tempo e ao menos um tema", () => {
      expect(moldePronto(molde({}))).toEqual({ temas: ["Prioridade de OS"], tempoLimiteS: 60 });
      expect(moldePronto(molde({ ativo: false }))).toBeNull();
      expect(moldePronto(molde({ tempoLimiteS: null }))).toBeNull();
      expect(moldePronto(molde({ temas: [] }))).toBeNull();
      expect(moldePronto(molde({ temas: ["  "] }))).toBeNull();
      expect(moldePronto(molde({ temas: "não é lista" }))).toBeNull();
      expect(moldePronto(molde({ temas: null }))).toBeNull();
    });
  });

  it("vale também dentro de uma transação (é o que o painel faz, em snapshot)", async () => {
    const c = await novoCenario(banco);
    const estado = await banco.prisma.$transaction((tx) =>
      avaliarInicio(tx, {
        participanteId: c.ctx.participanteId,
        config: c.config,
        agora: c.relogio.agora()
      })
    );
    expect(estado.tipo).toBe("iniciar");
  });
});
