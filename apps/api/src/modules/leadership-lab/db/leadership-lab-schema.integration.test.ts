// Etapa 1 do Leadership Lab: banco de dados.
//
// Exige um PostgreSQL real (LAB_TEST_DATABASE_URL); sem ele, as suítes são ignoradas.
// Veja test-database.ts para subir um servidor local.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  labAderenciaEscala,
  labAgentesIa,
  labAlertaCores,
  labAlertaStatus,
  labContestacaoStatus,
  labContribuicaoStatus,
  labDecisoesGuarda,
  labEscolhas,
  labEstilos,
  labFlexibilidades,
  labModos,
  labMoldeNiveis,
  labMoldesPiloto,
  labPermissoes,
  labSessaoStatus,
  labSkillTipos,
  labSkillsPiloto,
  labStatusValidacao
} from "@my-flux/shared";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigrations,
  createTestDatabase,
  expectDbError,
  integrationEnabled,
  listRelations,
  readMigrations,
  sqlState,
  type TestDatabase
} from "./test-database.js";
import {
  criarBase,
  criarColaborador,
  criarParticipante,
  criarSessao,
  criarUsuario,
  inserir,
  tentarInserir,
  type Base,
  type Colunas,
  type Contexto
} from "./test-fixtures.js";

const LAB_MIGRATION = "0015_leadership_lab";
const ENGINE_MIGRATION = "0016_leadership_lab_engine";
const PAINEL_MIGRATION = "0017_leadership_lab_painel_sem_vazamento";
const PRE_LAB_MIGRATION = "0014_employee_termination_date";
const rolesScript = readFileSync(
  fileURLToPath(new URL("../../../../prisma/ops/leadership-lab-roles.sql", import.meta.url)),
  "utf8"
);

const suite = describe.skipIf(!integrationEnabled);

const APRESENTADA = "2026-03-02T10:00:00.000Z";
const RESPONDIDA = "2026-03-02T10:00:20.000Z";
const opcoes = JSON.stringify([
  { id: "A", texto: "a" },
  { id: "B", texto: "b" },
  { id: "C", texto: "c" }
]);

function colunasTurno(sessaoId: string, numero: number, extra: Colunas = {}): Colunas {
  return {
    sessao_id: sessaoId,
    numero,
    marco: numero === 3,
    texto: "Situação de teste",
    opcoes,
    estilo_adequado: "apoio",
    apresentada_em: APRESENTADA,
    ...extra
  };
}

/** Turno respondido e avaliado; `extra` sobrepõe campos. */
function turnoRespondido(sessaoId: string, numero: number, extra: Colunas = {}): Colunas {
  return colunasTurno(sessaoId, numero, {
    escolha: "B",
    respondida_em: RESPONDIDA,
    tempo_resposta_ms: 20_000,
    aderencia: 70,
    estilo: "apoio",
    ...extra
  });
}

// ---------------------------------------------------------------------------
// Subir, descer e subir de novo
// ---------------------------------------------------------------------------

suite("migração 0015_leadership_lab: subir, descer e subir de novo", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("tem down.sql nas migrações do Lab, e só nelas (as anteriores seguem sem descida)", () => {
    const comDescida = readMigrations().filter((m) => m.down !== null);
    expect(comDescida.map((m) => m.name)).toEqual([
      LAB_MIGRATION,
      ENGINE_MIGRATION,
      PAINEL_MIGRATION
    ]);
  });

  it("sobe sobre a cadeia atual, desce sem tocar no schema public e sobe de novo", async () => {
    await applyMigrations(db.client, PRE_LAB_MIGRATION);
    const publicAntes = await listRelations(db.client, "public");
    expect(publicAntes.length).toBeGreaterThan(40);
    expect(await listRelations(db.client, "leadership_lab")).toEqual([]);

    const lab = readMigrations().find((m) => m.name === LAB_MIGRATION)!;
    await db.client.query(lab.up);
    const labDepois = await listRelations(db.client, "leadership_lab");
    // 17 tabelas + a view do painel.
    expect(labDepois).toHaveLength(18);
    expect(labDepois).toContain("leadership_lab.vw_painel_participante");
    expect(await listRelations(db.client, "public")).toEqual(publicAntes);

    await db.client.query(lab.down!);
    expect(await listRelations(db.client, "leadership_lab")).toEqual([]);
    const { rows: schemas } = await db.client.query(
      `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'leadership_lab%'`
    );
    expect(schemas).toEqual([]);
    expect(await listRelations(db.client, "public")).toEqual(publicAntes);

    await db.client.query(lab.up);
    expect(await listRelations(db.client, "leadership_lab")).toEqual(labDepois);
    const { rows: skills } = await db.client.query(
      `SELECT count(*)::int AS n FROM leadership_lab.skill`
    );
    expect(skills[0].n).toBe(8);
  }, 60_000);

  it("a descida é atômica e não apaga conversas do ADK: falha se o schema de IA tem tabelas", async () => {
    await db.client.query(`CREATE TABLE leadership_lab_ia.sessions (id text PRIMARY KEY)`);
    const lab = readMigrations().find((m) => m.name === LAB_MIGRATION)!;

    await expect(db.client.query(lab.down!)).rejects.toThrow(/leadership_lab_ia/);
    await db.client.query("ROLLBACK").catch(() => undefined);

    // Nada foi desfeito: o Lab continua inteiro, com dados, e a tabela do ADK também.
    expect(await listRelations(db.client, "leadership_lab")).toHaveLength(18);
    expect(await listRelations(db.client, "leadership_lab_ia")).toEqual([
      "leadership_lab_ia.sessions"
    ]);
    await db.client.query(`DROP TABLE leadership_lab_ia.sessions`);
  }, 60_000);

  it("0016: sobe, desce sem apagar dados do Lab e sobe de novo", async () => {
    const motor = readMigrations().find((m) => m.name === ENGINE_MIGRATION)!;
    const colunaDoLease = `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_schema = 'leadership_lab' AND table_name = 'turno' AND column_name = 'processando_ate'`;
    const indiceDaSessaoAtiva = `SELECT count(*)::int AS n FROM pg_indexes
       WHERE schemaname = 'leadership_lab' AND indexname = 'ux_sessao_em_andamento_por_participante'`;

    await db.client.query(motor.up);
    expect((await db.client.query(colunaDoLease)).rows[0].n).toBe(1);
    expect((await db.client.query(indiceDaSessaoAtiva)).rows[0].n).toBe(1);

    await db.client.query(motor.down!);
    expect((await db.client.query(colunaDoLease)).rows[0].n).toBe(0);
    expect((await db.client.query(indiceDaSessaoAtiva)).rows[0].n).toBe(0);
    // A descida da 0016 não toca nos dados nem nas tabelas do Lab.
    expect(await listRelations(db.client, "leadership_lab")).toHaveLength(18);
    expect(
      (await db.client.query(`SELECT count(*)::int AS n FROM leadership_lab.skill`)).rows[0].n
    ).toBe(8);

    await db.client.query(motor.up);
    expect((await db.client.query(colunaDoLease)).rows[0].n).toBe(1);
  }, 60_000);

  it("0017: subir corrige a view do painel, descer restaura a contagem antiga, subir corrige de novo", async () => {
    const painel = readMigrations().find((m) => m.name === PAINEL_MIGRATION)!;
    const base = await criarBase(db.client);
    const ctx = await criarParticipante(db.client, base);
    const sessao = await criarSessao(db.client, ctx); // em andamento
    const turno = await inserir(
      db.client,
      "leadership_lab.turno",
      turnoRespondido(sessao, 1, { escolha: "C", aderencia: 10, alerta: "vermelho" })
    );
    await inserir(db.client, "leadership_lab.alerta", {
      sessao_id: sessao,
      cor: "vermelho",
      turno_id: turno
    });
    const alertasAbertos = async () =>
      (
        await db.client.query(
          `SELECT alertas_abertos FROM leadership_lab.vw_painel_participante WHERE participante_id = $1`,
          [ctx.participanteId]
        )
      ).rows[0].alertas_abertos;

    expect(await alertasAbertos()).toBe(1); // a view da 0015 vaza
    await db.client.query(painel.up);
    expect(await alertasAbertos()).toBe(0);
    await db.client.query(painel.down!);
    expect(await alertasAbertos()).toBe(1);
    await db.client.query(painel.up);
    expect(await alertasAbertos()).toBe(0);
    // A view segue com as mesmas colunas, na mesma ordem.
    const { rows } = await db.client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'leadership_lab' AND table_name = 'vw_painel_participante' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      "participante_id",
      "testes_feitos",
      "testes_validados",
      "aderencia_media",
      "agilidade_media",
      "ultimo_teste_em",
      "alertas_abertos"
    ]);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Dados iniciais, integridade e view
// ---------------------------------------------------------------------------

suite("schema leadership_lab", () => {
  let db: TestDatabase;
  let client: pg.Client;
  let base: Base;

  beforeAll(async () => {
    db = await createTestDatabase();
    client = db.client;
    await applyMigrations(client);
    base = await criarBase(client);
  }, 60_000);

  afterAll(async () => {
    await client?.query("RESET ROLE").catch(() => undefined);
    await client?.query("DROP OWNED BY lab_ia_rw").catch(() => undefined);
    await db?.admin.query("DROP ROLE IF EXISTS lab_ia_rw").catch(() => undefined);
    await db?.drop();
  });

  describe("dados iniciais", () => {
    it("cadastra as 8 skills do piloto, 4 hard e 4 soft, como no código", async () => {
      const { rows } = await client.query(
        `SELECT id, nome, tipo, ativo FROM leadership_lab.skill ORDER BY id COLLATE "C"`
      );
      const esperado = [...labSkillsPiloto]
        .map((s) => ({ ...s, ativo: true }))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      expect(rows).toEqual(esperado);
      expect(rows.filter((s) => s.tipo === "hard")).toHaveLength(4);
      expect(rows.filter((s) => s.tipo === "soft")).toHaveLength(4);
    });

    it("cadastra os 3 moldes inativos e sem tempo limite, com os temas da documentação", async () => {
      const { rows } = await client.query(
        `SELECT nivel, nome, temas, numero_situacoes, tempo_limite_s, ativo
           FROM leadership_lab.molde ORDER BY nivel`
      );
      expect(rows).toEqual(
        [...labMoldesPiloto]
          .map((m) => ({
            nivel: m.nivel,
            nome: m.nome,
            temas: [...m.temas],
            numero_situacoes: 5,
            tempo_limite_s: null,
            ativo: false
          }))
          .sort((a, b) => a.nivel.localeCompare(b.nivel))
      );
    });

    it("não deixa ativar um molde sem tempo limite, e ativa quando o tempo é informado", async () => {
      const erro = await expectDbError(
        client,
        `UPDATE leadership_lab.molde SET ativo = true WHERE nivel = 'encarregado'`
      );
      expect(erro).toMatchObject({
        code: sqlState.checkViolation,
        constraint: "ck_molde_ativo_exige_tempo"
      });

      await client.query("BEGIN");
      try {
        const { rows } = await client.query(
          `UPDATE leadership_lab.molde SET ativo = true, tempo_limite_s = 90
            WHERE nivel = 'encarregado' RETURNING ativo, tempo_limite_s`
        );
        expect(rows).toEqual([{ ativo: true, tempo_limite_s: 90 }]);
      } finally {
        await client.query("ROLLBACK");
      }
    });

    it("recusa tempo limite zero, nível desconhecido e menos de 3 situações (o marco é a 3ª)", async () => {
      expect(
        await expectDbError(
          client,
          `UPDATE leadership_lab.molde SET tempo_limite_s = 0 WHERE nivel = 'supervisor'`
        )
      ).toMatchObject({ constraint: "ck_molde_tempo_positivo" });
      expect(
        await expectDbError(
          client,
          `INSERT INTO leadership_lab.molde (nivel, nome) VALUES ('estagiario', 'X')`
        )
      ).toMatchObject({ constraint: "ck_molde_nivel" });
      expect(
        await expectDbError(
          client,
          `UPDATE leadership_lab.molde SET numero_situacoes = 2 WHERE nivel = 'supervisor'`
        )
      ).toMatchObject({ constraint: "ck_molde_numero_situacoes" });
    });
  });

  describe("listas fechadas do código = CHECK do banco", () => {
    async function valoresDoCheck(constraint: string): Promise<string[]> {
      const { rows } = await client.query<{ def: string }>(
        `SELECT pg_get_constraintdef(c.oid) AS def
           FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = 'leadership_lab' AND c.conname = $1`,
        [constraint]
      );
      expect(rows, `restrição ${constraint} não existe`).toHaveLength(1);
      return [...rows[0]!.def.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
    }

    it.each([
      ["ck_skill_tipo", labSkillTipos],
      ["ck_molde_nivel", labMoldeNiveis],
      ["ck_turno_estilo_adequado", labEstilos],
      ["ck_turno_estilo", labEstilos],
      ["ck_resultado_estilo_predominante", labEstilos],
      ["ck_turno_escolha", labEscolhas],
      ["ck_turno_decisao_guarda", labDecisoesGuarda],
      ["ck_sessao_modo", labModos],
      ["ck_sessao_status", labSessaoStatus],
      ["ck_resultado_flexibilidade", labFlexibilidades],
      ["ck_resultado_status", labStatusValidacao],
      ["ck_alerta_cor", labAlertaCores],
      ["ck_alerta_status", labAlertaStatus],
      ["ck_contribuicao_status", labContribuicaoStatus],
      ["ck_contestacao_status", labContestacaoStatus],
      ["ck_permissao_usuario_permissao", labPermissoes],
      ["ck_log_ia_agente", labAgentesIa]
    ] as const)("%s", async (constraint, esperado) => {
      expect(await valoresDoCheck(constraint)).toEqual([...esperado].sort());
    });

    it("ck_turno_aderencia_escala aceita exatamente a escala 100, 70, 40, 10 e 0", async () => {
      const { rows } = await client.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'ck_turno_aderencia_escala'`
      );
      const numeros = [...rows[0]!.def.matchAll(/\b(\d+)\b/g)]
        .map((m) => Number(m[1]))
        .sort((a, b) => a - b);
      expect(numeros).toEqual([...labAderenciaEscala].sort((a, b) => a - b));
    });
  });

  describe("turno", () => {
    it("aceita os quatro estados válidos: pendente, respondido, tempo esgotado e alerta vermelho", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      await inserir(client, "leadership_lab.turno", colunasTurno(sessao, 1));
      await inserir(client, "leadership_lab.turno", turnoRespondido(sessao, 2));
      await inserir(
        client,
        "leadership_lab.turno",
        colunasTurno(sessao, 3, { respondida_em: RESPONDIDA, tempo_esgotado: true, aderencia: 0 })
      );
      await inserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 4, { escolha: "C", aderencia: 10, alerta: "vermelho" })
      );
      await inserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 5, {
          texto_livre: "Chamaria o eletricista.",
          decisao_guarda: "mascarar"
        })
      );
    });

    it.each([
      ["aderência fora da escala", { aderencia: 55 }, "ck_turno_aderencia_escala"],
      ["escolha fora de A, B e C", { escolha: "D" }, "ck_turno_escolha"],
      ["estilo desconhecido", { estilo: "autocratico" }, "ck_turno_estilo"],
      ["aderência 0 sem tempo esgotado", { aderencia: 0 }, "ck_turno_zero_so_por_omissao"],
      [
        "alerta vermelho com aderência 40",
        { aderencia: 40, alerta: "vermelho" },
        "ck_turno_alerta_so_com_10"
      ],
      ["aderência 10 sem alerta vermelho", { aderencia: 10 }, "ck_turno_10_gera_alerta"],
      ["alerta de outra cor", { aderencia: 10, alerta: "amarelo" }, "ck_turno_alerta"],
      ["tempo de resposta negativo", { tempo_resposta_ms: -1 }, "ck_turno_tempo_resposta"],
      [
        "resposta anterior à apresentação",
        { respondida_em: "2026-03-02T09:59:00.000Z" },
        "ck_turno_datas"
      ],
      ["escolha sem horário de resposta", { respondida_em: null }, "ck_turno_estado"],
      ["decisão da Guarda desconhecida", { decisao_guarda: "talvez" }, "ck_turno_decisao_guarda"]
    ] as const)("recusa %s", async (_nome, extra, constraint) => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      const erro = await tentarInserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 1, extra)
      );
      expect(erro).toMatchObject({ code: sqlState.checkViolation, constraint });
    });

    it("tempo esgotado conta como omissão: sem escolha e com aderência 0", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      // Com aderência diferente de 0.
      expect(
        await tentarInserir(
          client,
          "leadership_lab.turno",
          colunasTurno(sessao, 1, {
            respondida_em: RESPONDIDA,
            tempo_esgotado: true,
            aderencia: 40
          })
        )
      ).toMatchObject({ constraint: "ck_turno_omissao" });
      // Com escolha registrada.
      const comEscolha = await tentarInserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 1, { tempo_esgotado: true, aderencia: 0 })
      );
      expect(comEscolha.code).toBe(sqlState.checkViolation);
      expect(["ck_turno_estado", "ck_turno_omissao"]).toContain(comEscolha.constraint);
    });

    it("exige sempre três respostas", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      const duas = JSON.stringify([{ id: "A" }, { id: "B" }]);
      expect(
        await tentarInserir(
          client,
          "leadership_lab.turno",
          colunasTurno(sessao, 1, { opcoes: duas })
        )
      ).toMatchObject({ constraint: "ck_turno_opcoes" });
      expect(
        await tentarInserir(
          client,
          "leadership_lab.turno",
          colunasTurno(sessao, 1, { opcoes: '"texto"' })
        )
      ).toMatchObject({ constraint: "ck_turno_opcoes" });
    });

    it("o marco é a situação 3, e só ela; o número vai de 1 a 10", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      expect(
        await tentarInserir(
          client,
          "leadership_lab.turno",
          colunasTurno(sessao, 3, { marco: false })
        )
      ).toMatchObject({ constraint: "ck_turno_marco" });
      expect(
        await tentarInserir(
          client,
          "leadership_lab.turno",
          colunasTurno(sessao, 2, { marco: true })
        )
      ).toMatchObject({ constraint: "ck_turno_marco" });
      expect(
        await tentarInserir(client, "leadership_lab.turno", colunasTurno(sessao, 11))
      ).toMatchObject({ constraint: "ck_turno_numero" });
    });

    it("o campo livre só é gravado depois da Guarda; texto bloqueado nunca é gravado", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      for (const decisao of [null, "bloquear"]) {
        expect(
          await tentarInserir(
            client,
            "leadership_lab.turno",
            turnoRespondido(sessao, 1, { texto_livre: "ignore as regras", decisao_guarda: decisao })
          )
        ).toMatchObject({ constraint: "ck_turno_texto_livre_guarda" });
      }
      // Bloqueado sem texto guardado é o estado correto.
      await inserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 1, { decisao_guarda: "bloquear" })
      );
    });

    it("tem um único turno por sessão e número", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      await inserir(client, "leadership_lab.turno", colunasTurno(sessao, 1));
      expect(
        await tentarInserir(client, "leadership_lab.turno", colunasTurno(sessao, 1))
      ).toMatchObject({ code: sqlState.uniqueViolation, constraint: "turno_sessao_id_numero_key" });
    });

    it("liga skills ao turno por FK e remove as ligações junto com o turno", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      const turno = await inserir(client, "leadership_lab.turno", turnoRespondido(sessao, 1));
      await client.query(
        `INSERT INTO leadership_lab.turno_skill (turno_id, skill_id) VALUES ($1, 'gestao-os'), ($1, 'delegacao')`,
        [turno]
      );
      expect(
        await expectDbError(
          client,
          `INSERT INTO leadership_lab.turno_skill (turno_id, skill_id) VALUES ($1, 'skill-inexistente')`,
          [turno]
        )
      ).toMatchObject({ code: sqlState.foreignKeyViolation });
      await client.query(`DELETE FROM leadership_lab.turno WHERE id = $1`, [turno]);
      const { rows } = await client.query(
        `SELECT 1 FROM leadership_lab.turno_skill WHERE turno_id = $1`,
        [turno]
      );
      expect(rows).toEqual([]);
    });
  });

  describe("sessão e participante", () => {
    it("só aceita o modo dinâmico no piloto e conclusão com data", async () => {
      const ctx = await criarParticipante(client, base);
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId,
          modo: "validado"
        })
      ).toMatchObject({ constraint: "ck_sessao_modo" });
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId,
          status: "concluida"
        })
      ).toMatchObject({ constraint: "ck_sessao_concluida_em" });
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId,
          status: "em_andamento",
          iniciada_em: "2026-03-02T09:00:00.000Z",
          concluida_em: "2026-03-02T09:10:00.000Z"
        })
      ).toMatchObject({ constraint: "ck_sessao_concluida_em" });
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId,
          status: "concluida",
          iniciada_em: "2026-03-02T09:10:00.000Z",
          concluida_em: "2026-03-02T09:00:00.000Z"
        })
      ).toMatchObject({ constraint: "ck_sessao_datas" });
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId,
          status: "abandonada"
        })
      ).toMatchObject({ constraint: "ck_sessao_status" });
    });

    it("só há uma sessão em andamento por participante; concluir ou cancelar libera a vaga", async () => {
      const ctx = await criarParticipante(client, base);
      const aberta = await criarSessao(client, ctx);
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId
        })
      ).toMatchObject({
        code: sqlState.uniqueViolation,
        constraint: "ux_sessao_em_andamento_por_participante"
      });

      // Outro participante não é afetado.
      await criarSessao(client, await criarParticipante(client, base));

      // Encerrada (cancelada ou concluída), a vaga volta.
      await client.query(`UPDATE leadership_lab.sessao SET status = 'cancelada' WHERE id = $1`, [
        aberta
      ]);
      const segunda = await criarSessao(client, ctx);
      await client.query(
        `UPDATE leadership_lab.sessao SET status = 'concluida', concluida_em = now() + interval '1 minute' WHERE id = $1`,
        [segunda]
      );
      await criarSessao(client, ctx);

      // E várias encerradas convivem.
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM leadership_lab.sessao WHERE participante_id = $1`,
        [ctx.participanteId]
      );
      expect(rows[0].n).toBe(3);
    });

    it("o turno nasce sem reserva de processamento", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      const turno = await inserir(client, "leadership_lab.turno", colunasTurno(sessao, 1));
      const { rows } = await client.query(
        `SELECT processando_ate FROM leadership_lab.turno WHERE id = $1`,
        [turno]
      );
      expect(rows[0].processando_ate).toBeNull();
    });

    it("o identificador da conversa na IA é único", async () => {
      const ctx = await criarParticipante(client, base);
      await criarSessao(client, ctx, { ia_sessao_id: "conv-opaca-1" });
      expect(
        await tentarInserir(client, "leadership_lab.sessao", {
          participante_id: ctx.participanteId,
          molde_id: base.moldeId,
          ia_sessao_id: "conv-opaca-1"
        })
      ).toMatchObject({ code: sqlState.uniqueViolation });
    });

    it("liga o participante ao colaborador e ao usuário do RH por FK entre schemas", async () => {
      const ctx = await criarParticipante(client, base);

      // Um usuário e um colaborador só podem ser um participante.
      expect(
        await tentarInserir(client, "leadership_lab.participante", {
          user_id: ctx.userId,
          employee_id: await criarColaborador(client, base)
        })
      ).toMatchObject({ code: sqlState.uniqueViolation });
      expect(
        await tentarInserir(client, "leadership_lab.participante", {
          user_id: await criarUsuario(client, base),
          employee_id: ctx.employeeId
        })
      ).toMatchObject({ code: sqlState.uniqueViolation });

      // Colaborador ou usuário inexistentes não passam.
      expect(
        await tentarInserir(client, "leadership_lab.participante", {
          user_id: crypto.randomUUID(),
          employee_id: await criarColaborador(client, base)
        })
      ).toMatchObject({ code: sqlState.foreignKeyViolation });
      expect(
        await tentarInserir(client, "leadership_lab.participante", {
          user_id: await criarUsuario(client, base),
          employee_id: crypto.randomUUID()
        })
      ).toMatchObject({ code: sqlState.foreignKeyViolation });

      // E o RH não consegue apagar quem já é participante.
      expect(
        await expectDbError(client, `DELETE FROM "Employee" WHERE id = $1`, [ctx.employeeId])
      ).toMatchObject({ code: sqlState.restrictViolation });
      expect(
        await expectDbError(client, `DELETE FROM "User" WHERE id = $1`, [ctx.userId])
      ).toMatchObject({ code: sqlState.restrictViolation });
    });

    it("mapeia um cargo do RH (JobFunction) para no máximo um molde", async () => {
      const funcao = await inserir(client, '"JobFunction"', {
        id: crypto.randomUUID(),
        name: "Encarregado de turno",
        updatedAt: new Date().toISOString()
      });
      await client.query(
        `INSERT INTO leadership_lab.molde_cargo (job_function_id, molde_id) VALUES ($1, $2)`,
        [funcao, base.moldeId]
      );
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM leadership_lab.molde WHERE nivel = 'coordenador'`
      );
      expect(
        await expectDbError(
          client,
          `INSERT INTO leadership_lab.molde_cargo (job_function_id, molde_id) VALUES ($1, $2)`,
          [funcao, rows[0]!.id]
        )
      ).toMatchObject({ code: sqlState.uniqueViolation });
    });

    it("guarda permissões por usuário, só as duas conhecidas e sem repetir", async () => {
      const userId = await criarUsuario(client, base);
      await client.query(
        `INSERT INTO leadership_lab.permissao_usuario (user_id, permissao) VALUES ($1, 'lab_gestao')`,
        [userId]
      );
      expect(
        await tentarInserir(client, "leadership_lab.permissao_usuario", {
          user_id: userId,
          permissao: "lab_gestao"
        })
      ).toMatchObject({ code: sqlState.uniqueViolation });
      expect(
        await tentarInserir(client, "leadership_lab.permissao_usuario", {
          user_id: userId,
          permissao: "lab_admin"
        })
      ).toMatchObject({ constraint: "ck_permissao_usuario_permissao" });
    });

    it("registra o termo de ciência uma vez por versão", async () => {
      const ctx = await criarParticipante(client, base);
      await inserir(client, "leadership_lab.termo_aceite", {
        participante_id: ctx.participanteId,
        versao_termo: "2026-1"
      });
      expect(
        await tentarInserir(client, "leadership_lab.termo_aceite", {
          participante_id: ctx.participanteId,
          versao_termo: "2026-1"
        })
      ).toMatchObject({ code: sqlState.uniqueViolation });
      await inserir(client, "leadership_lab.termo_aceite", {
        participante_id: ctx.participanteId,
        versao_termo: "2026-2"
      });
    });

    it("monta turmas e apaga os vínculos com a turma, sem apagar o participante", async () => {
      const curador = await criarUsuario(client, base);
      const ctx = await criarParticipante(client, base);
      const turma = await inserir(client, "leadership_lab.turma", {
        nome: "Piloto",
        curador_id: curador
      });
      await client.query(
        `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
        [turma, ctx.participanteId]
      );
      await client.query(`DELETE FROM leadership_lab.turma WHERE id = $1`, [turma]);
      const { rows } = await client.query(
        `SELECT 1 FROM leadership_lab.participante WHERE id = $1`,
        [ctx.participanteId]
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe("resultado e perfil", () => {
    async function sessaoComTurno(): Promise<{ ctx: Contexto; sessao: string }> {
      const ctx = await criarParticipante(client, base);
      return { ctx, sessao: await criarSessao(client, ctx) };
    }

    const resultadoBase = (sessao: string, extra: Colunas = {}): Colunas => ({
      sessao_id: sessao,
      aderencia_geral: 74,
      agilidade: 61.5,
      resumo: "Resumo.",
      resposta_ia: JSON.stringify({ tipo: "resultado" }),
      ...extra
    });

    it("grava um resultado aguardando validação e um único por sessão", async () => {
      const { sessao } = await sessaoComTurno();
      await inserir(client, "leadership_lab.resultado", resultadoBase(sessao));
      expect(
        await tentarInserir(client, "leadership_lab.resultado", resultadoBase(sessao))
      ).toMatchObject({ code: sqlState.uniqueViolation });
    });

    it.each([
      ["aderência acima de 100", { aderencia_geral: 101 }, "ck_resultado_aderencia_geral"],
      ["agilidade negativa", { agilidade: -1 }, "ck_resultado_agilidade"],
      [
        "estilo predominante desconhecido",
        { estilo_predominante: "x" },
        "ck_resultado_estilo_predominante"
      ],
      ["flexibilidade desconhecida", { flexibilidade: "total" }, "ck_resultado_flexibilidade"],
      [
        "níveis por skill que não é um objeto",
        { niveis_por_skill: "[]" },
        "ck_resultado_niveis_objeto"
      ],
      ["validado sem quem validou", { status_validacao: "validado" }, "ck_resultado_validacao"],
      [
        "aguardando validação com validador",
        { validado_por: crypto.randomUUID(), validado_em: APRESENTADA },
        "ck_resultado_validacao"
      ],
      [
        "ajuste sem justificativa",
        {
          status_validacao: "ajustado",
          validado_por: crypto.randomUUID(),
          validado_em: APRESENTADA
        },
        "ck_resultado_ajuste_justificado"
      ],
      [
        "ajuste com justificativa em branco",
        {
          status_validacao: "ajustado",
          validado_por: crypto.randomUUID(),
          validado_em: APRESENTADA,
          justificativa_validacao: "   "
        },
        "ck_resultado_ajuste_justificado"
      ]
    ] as const)("recusa %s", async (_nome, extra, constraint) => {
      const { sessao } = await sessaoComTurno();
      expect(
        await tentarInserir(client, "leadership_lab.resultado", resultadoBase(sessao, extra))
      ).toMatchObject({ code: sqlState.checkViolation, constraint });
    });

    it("aceita validação e ajuste completos", async () => {
      const validador = crypto.randomUUID();
      for (const extra of [
        { status_validacao: "validado", validado_por: validador, validado_em: APRESENTADA },
        {
          status_validacao: "ajustado",
          validado_por: validador,
          validado_em: APRESENTADA,
          justificativa_validacao: "Nível 3 em vez de 4: só uma evidência."
        }
      ]) {
        const { sessao } = await sessaoComTurno();
        await inserir(client, "leadership_lab.resultado", resultadoBase(sessao, extra));
      }
    });

    it("guarda o nível por skill: de 1 a 5, uma linha por sessão e skill, validado coerente", async () => {
      const { ctx, sessao } = await sessaoComTurno();
      const linha = (extra: Colunas = {}): Colunas => ({
        participante_id: ctx.participanteId,
        skill_id: "gestao-os",
        sessao_id: sessao,
        nivel: 4,
        n_evidencias: 2,
        ...extra
      });
      await inserir(client, "leadership_lab.perfil_skill", linha());
      expect(await tentarInserir(client, "leadership_lab.perfil_skill", linha())).toMatchObject({
        code: sqlState.uniqueViolation
      });
      expect(
        await tentarInserir(
          client,
          "leadership_lab.perfil_skill",
          linha({ skill_id: "delegacao", nivel: 6 })
        )
      ).toMatchObject({ constraint: "ck_perfil_skill_nivel" });
      expect(
        await tentarInserir(
          client,
          "leadership_lab.perfil_skill",
          linha({ skill_id: "delegacao", n_evidencias: 0 })
        )
      ).toMatchObject({ constraint: "ck_perfil_skill_evidencias" });
      expect(
        await tentarInserir(
          client,
          "leadership_lab.perfil_skill",
          linha({ skill_id: "delegacao", validado: true })
        )
      ).toMatchObject({ constraint: "ck_perfil_skill_validado" });
      expect(
        await tentarInserir(
          client,
          "leadership_lab.perfil_skill",
          linha({ skill_id: "delegacao", nivel_validado: 3 })
        )
      ).toMatchObject({ constraint: "ck_perfil_skill_validado" });
      await inserir(
        client,
        "leadership_lab.perfil_skill",
        linha({ skill_id: "delegacao", validado: true, nivel_validado: 3 })
      );
      expect(
        await tentarInserir(
          client,
          "leadership_lab.perfil_skill",
          linha({ skill_id: "inexistente" })
        )
      ).toMatchObject({ code: sqlState.foreignKeyViolation });
    });
  });

  describe("alertas, contribuições e contestações", () => {
    async function turnoVermelho() {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx);
      const turno = await inserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 1, { escolha: "C", aderencia: 10, alerta: "vermelho" })
      );
      return { ctx, sessao, turno };
    }

    it("vermelho nasce de um turno e amarelo de uma skill", async () => {
      const { sessao, turno } = await turnoVermelho();
      expect(
        await tentarInserir(client, "leadership_lab.alerta", { sessao_id: sessao, cor: "vermelho" })
      ).toMatchObject({ constraint: "ck_alerta_origem" });
      expect(
        await tentarInserir(client, "leadership_lab.alerta", {
          sessao_id: sessao,
          cor: "amarelo",
          turno_id: turno
        })
      ).toMatchObject({ constraint: "ck_alerta_origem" });
      expect(
        await tentarInserir(client, "leadership_lab.alerta", {
          sessao_id: sessao,
          cor: "azul",
          turno_id: turno
        })
      ).toMatchObject({ constraint: "ck_alerta_cor" });
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "vermelho",
        turno_id: turno
      });
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "amarelo",
        skill_id: "gestao-os"
      });
    });

    it("não duplica alertas ao reprocessar o mesmo resultado", async () => {
      const { sessao, turno } = await turnoVermelho();
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "vermelho",
        turno_id: turno
      });
      expect(
        await tentarInserir(client, "leadership_lab.alerta", {
          sessao_id: sessao,
          cor: "vermelho",
          turno_id: turno
        })
      ).toMatchObject({
        code: sqlState.uniqueViolation,
        constraint: "ux_alerta_vermelho_por_turno"
      });

      await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "amarelo",
        skill_id: "gestao-os"
      });
      expect(
        await tentarInserir(client, "leadership_lab.alerta", {
          sessao_id: sessao,
          cor: "amarelo",
          skill_id: "gestao-os"
        })
      ).toMatchObject({
        code: sqlState.uniqueViolation,
        constraint: "ux_alerta_amarelo_por_sessao_skill"
      });
      // Outra skill na mesma sessão é outro alerta.
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "amarelo",
        skill_id: "delegacao"
      });
    });

    it("encerrar um alerta exige quem tratou, quando e a nota da conversa", async () => {
      const { sessao, turno } = await turnoVermelho();
      const alerta = await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "vermelho",
        turno_id: turno
      });
      const encerrar = (set: string) =>
        expectDbError(client, `UPDATE leadership_lab.alerta SET ${set} WHERE id = $1`, [alerta]);

      expect(await encerrar(`status = 'encerrado'`)).toMatchObject({
        constraint: "ck_alerta_encerramento"
      });
      expect(
        await encerrar(`status = 'encerrado', tratado_por = gen_random_uuid(), tratado_em = now()`)
      ).toMatchObject({ constraint: "ck_alerta_encerramento" });
      expect(
        await encerrar(
          `status = 'encerrado', tratado_por = gen_random_uuid(), tratado_em = now(), nota = '  '`
        )
      ).toMatchObject({ constraint: "ck_alerta_encerramento" });

      const { rowCount } = await client.query(
        `UPDATE leadership_lab.alerta
            SET status = 'encerrado', tratado_por = gen_random_uuid(), tratado_em = now(),
                nota = 'Conversa de desenvolvimento registrada.'
          WHERE id = $1`,
        [alerta]
      );
      expect(rowCount).toBe(1);
    });

    it("tem no máximo uma contribuição por turno, com texto e decisão completa", async () => {
      const { sessao, turno } = await turnoVermelho();
      await inserir(client, "leadership_lab.contribuicao", {
        sessao_id: sessao,
        turno_id: turno,
        texto: "Checar o EPI antes."
      });
      expect(
        await tentarInserir(client, "leadership_lab.contribuicao", {
          sessao_id: sessao,
          turno_id: turno,
          texto: "Outra"
        })
      ).toMatchObject({ code: sqlState.uniqueViolation });

      const { sessao: s2, turno: t2 } = await turnoVermelho();
      expect(
        await tentarInserir(client, "leadership_lab.contribuicao", {
          sessao_id: s2,
          turno_id: t2,
          texto: " "
        })
      ).toMatchObject({ constraint: "ck_contribuicao_texto" });
      expect(
        await tentarInserir(client, "leadership_lab.contribuicao", {
          sessao_id: s2,
          turno_id: t2,
          texto: "Ideia",
          status: "aprovada"
        })
      ).toMatchObject({ constraint: "ck_contribuicao_decisao" });
      await inserir(client, "leadership_lab.contribuicao", {
        sessao_id: s2,
        turno_id: t2,
        texto: "Ideia",
        status: "aprovada",
        decidido_por: crypto.randomUUID(),
        decidido_em: APRESENTADA
      });
    });

    it("registra contestações com ponto e motivo, e decisão completa", async () => {
      const { sessao } = await turnoVermelho();
      const resultado = await inserir(client, "leadership_lab.resultado", {
        sessao_id: sessao,
        aderencia_geral: 40,
        agilidade: 50,
        resumo: "Resumo.",
        resposta_ia: "{}"
      });
      expect(
        await tentarInserir(client, "leadership_lab.contestacao", {
          resultado_id: resultado,
          ponto: "skill:gestao-os",
          motivo: ""
        })
      ).toMatchObject({ constraint: "ck_contestacao_textos" });
      expect(
        await tentarInserir(client, "leadership_lab.contestacao", {
          resultado_id: resultado,
          ponto: "skill:gestao-os",
          motivo: "Discordo",
          status: "aceita"
        })
      ).toMatchObject({ constraint: "ck_contestacao_decisao" });
      await inserir(client, "leadership_lab.contestacao", {
        resultado_id: resultado,
        ponto: "skill:gestao-os",
        motivo: "Discordo"
      });
    });
  });

  describe("log_ia", () => {
    it("guarda só metadados e exige o código do erro quando falha", async () => {
      const log = (extra: Colunas = {}): Colunas => ({
        agente: "agente_lab",
        versao_instrucao: "v1",
        modelo: "modelo-de-teste",
        latencia_ms: 850,
        sucesso: true,
        ...extra
      });
      await inserir(
        client,
        "leadership_lab.log_ia",
        log({ tokens_entrada: 900, tokens_saida: 300 })
      );
      await inserir(
        client,
        "leadership_lab.log_ia",
        log({ sucesso: false, codigo_erro: "SAIDA_INVALIDA" })
      );
      expect(
        await tentarInserir(client, "leadership_lab.log_ia", log({ sucesso: false }))
      ).toMatchObject({ constraint: "ck_log_ia_erro" });
      expect(
        await tentarInserir(client, "leadership_lab.log_ia", log({ agente: "outro" }))
      ).toMatchObject({ constraint: "ck_log_ia_agente" });
      expect(
        await tentarInserir(client, "leadership_lab.log_ia", log({ latencia_ms: -5 }))
      ).toMatchObject({ constraint: "ck_log_ia_latencia" });
      expect(
        await tentarInserir(client, "leadership_lab.log_ia", log({ tokens_saida: -1 }))
      ).toMatchObject({ constraint: "ck_log_ia_tokens" });
    });
  });

  describe("vw_painel_participante", () => {
    it("agrega testes, aderência, agilidade e alertas abertos por participante", async () => {
      const ctx = await criarParticipante(client, base);
      const vazio = await criarParticipante(client, base);
      const validador = crypto.randomUUID();

      const concluir = async (aderencia: number, agilidade: number, extra: Colunas) => {
        const sessao = await criarSessao(client, ctx, {
          status: "concluida",
          iniciada_em: "2026-03-02T09:00:00.000Z",
          concluida_em: "2026-03-02T09:10:00.000Z"
        });
        await inserir(client, "leadership_lab.resultado", {
          sessao_id: sessao,
          aderencia_geral: aderencia,
          agilidade,
          resumo: "Resumo.",
          resposta_ia: "{}",
          ...extra
        });
        return sessao;
      };

      const primeira = await concluir(80, 50, {
        status_validacao: "validado",
        validado_por: validador,
        validado_em: APRESENTADA
      });
      await concluir(60, 70, {});
      // Sessão em andamento não conta.
      await criarSessao(client, ctx);
      // Um alerta aberto e um encerrado.
      const turno = await inserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(primeira, 1, { escolha: "C", aderencia: 10, alerta: "vermelho" })
      );
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: primeira,
        cor: "vermelho",
        turno_id: turno
      });
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: primeira,
        cor: "amarelo",
        skill_id: "gestao-os",
        status: "encerrado",
        tratado_por: validador,
        tratado_em: APRESENTADA,
        nota: "Conversado."
      });

      const { rows } = await client.query(
        `SELECT * FROM leadership_lab.vw_painel_participante WHERE participante_id = ANY($1::uuid[])`,
        [[ctx.participanteId, vazio.participanteId]]
      );
      const porId = new Map(rows.map((r) => [r.participante_id, r]));

      expect(porId.get(ctx.participanteId)).toMatchObject({
        testes_feitos: 2,
        testes_validados: 1,
        aderencia_media: 70,
        agilidade_media: 60,
        alertas_abertos: 1
      });
      expect(porId.get(ctx.participanteId).ultimo_teste_em).toBeInstanceOf(Date);
      expect(porId.get(vazio.participanteId)).toMatchObject({
        testes_feitos: 0,
        testes_validados: 0,
        aderencia_media: null,
        agilidade_media: null,
        ultimo_teste_em: null,
        alertas_abertos: 0
      });
    });

    it("não conta alertas de um teste em andamento: a avaliação não pode aparecer antes do fim", async () => {
      const ctx = await criarParticipante(client, base);
      const sessao = await criarSessao(client, ctx); // em andamento
      const turno = await inserir(
        client,
        "leadership_lab.turno",
        turnoRespondido(sessao, 1, { escolha: "C", aderencia: 10, alerta: "vermelho" })
      );
      await inserir(client, "leadership_lab.alerta", {
        sessao_id: sessao,
        cor: "vermelho",
        turno_id: turno
      });
      const alertasAbertos = async () =>
        (
          await client.query(
            `SELECT alertas_abertos FROM leadership_lab.vw_painel_participante WHERE participante_id = $1`,
            [ctx.participanteId]
          )
        ).rows[0].alertas_abertos;

      // O curador já foi avisado (o alerta existe), mas o participante ainda não pode saber.
      expect(await alertasAbertos()).toBe(0);

      // Concluído o teste, o alerta passa a contar.
      await client.query(
        `UPDATE leadership_lab.sessao SET status = 'concluida', concluida_em = now() + interval '1 minute' WHERE id = $1`,
        [sessao]
      );
      await inserir(client, "leadership_lab.resultado", {
        sessao_id: sessao,
        aderencia_geral: 10,
        agilidade: 50,
        resumo: "Resumo.",
        resposta_ia: "{}"
      });
      expect(await alertasAbertos()).toBe(1);
    });
  });

  describe("papel do serviço de IA (leadership-lab-roles.sql)", () => {
    it("enxerga e cria tabelas só em leadership_lab_ia, e nada do RH nem do Lab; é idempotente", async () => {
      await client.query(rolesScript);
      await client.query(rolesScript); // idempotente

      await client.query("SET ROLE lab_ia_rw");
      try {
        // Pode trabalhar no próprio schema.
        await client.query(
          `CREATE TABLE leadership_lab_ia.sessions (id text PRIMARY KEY, state jsonb)`
        );
        await client.query(`INSERT INTO leadership_lab_ia.sessions VALUES ('a', '{}')`);
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM leadership_lab_ia.sessions`
        );
        expect(rows[0].n).toBe(1);
        await client.query(`DROP TABLE leadership_lab_ia.sessions`);

        // Não lê dados de avaliação nem do RH.
        expect(await expectDbError(client, `SELECT * FROM leadership_lab.turno`)).toMatchObject({
          code: sqlState.insufficientPrivilege
        });
        expect(
          await expectDbError(client, `SELECT * FROM leadership_lab.vw_painel_participante`)
        ).toMatchObject({
          code: sqlState.insufficientPrivilege
        });
        expect(await expectDbError(client, `SELECT * FROM "Employee"`)).toMatchObject({
          code: sqlState.insufficientPrivilege
        });
        expect(await expectDbError(client, `SELECT "passwordHash" FROM "User"`)).toMatchObject({
          code: sqlState.insufficientPrivilege
        });
      } finally {
        await client.query("RESET ROLE");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// O que o aplicativo usa de verdade: o client do Prisma
// ---------------------------------------------------------------------------

suite("Prisma client sobre o schema leadership_lab", () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let base: Base;

  beforeAll(async () => {
    db = await createTestDatabase();
    await applyMigrations(db.client);
    base = await criarBase(db.client);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: db.url }) });
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it("lê skills e moldes pelos modelos", async () => {
    expect(await prisma.labSkill.count()).toBe(8);
    const moldes = await prisma.labMolde.findMany({ orderBy: { nivel: "asc" } });
    expect(moldes.map((m) => m.nivel)).toEqual(["coordenador", "encarregado", "supervisor"]);
    expect(moldes.every((m) => !m.ativo && m.tempoLimiteS === null)).toBe(true);
  });

  it("grava um teste inteiro pelo ORM, com relações entre os schemas lab e public", async () => {
    const ctx = await criarParticipante(db.client, base);
    const sessao = await prisma.labSessao.create({
      data: {
        participanteId: ctx.participanteId,
        moldeId: base.moldeId,
        turnos: {
          create: {
            numero: 1,
            texto: "Situação",
            opcoes: [{ id: "A" }, { id: "B" }, { id: "C" }],
            estiloAdequado: "orientacao",
            skills: { create: [{ skillId: "gestao-os" }, { skillId: "comunicacao-cliente" }] }
          }
        }
      },
      include: {
        turnos: { include: { skills: true } },
        participante: { include: { employee: true } }
      }
    });

    expect(sessao.status).toBe("em_andamento");
    expect(sessao.modo).toBe("dinamico");
    expect(sessao.turnos[0]!.skills.map((s) => s.skillId).sort()).toEqual([
      "comunicacao-cliente",
      "gestao-os"
    ]);
    expect(sessao.participante.employee.id).toBe(ctx.employeeId);

    const painel = await prisma.$queryRaw<{ testes_feitos: number }[]>`
      SELECT testes_feitos FROM leadership_lab.vw_painel_participante
       WHERE participante_id = ${ctx.participanteId}::uuid`;
    expect(painel).toEqual([{ testes_feitos: 0 }]);
  });

  it("as regras do banco também valem pelo ORM", async () => {
    const ctx = await criarParticipante(db.client, base);
    const sessao = await prisma.labSessao.create({
      data: { participanteId: ctx.participanteId, moldeId: base.moldeId }
    });
    const turno = await prisma.labTurno.create({
      data: {
        sessaoId: sessao.id,
        numero: 1,
        texto: "Situação",
        opcoes: [{ id: "A" }, { id: "B" }, { id: "C" }],
        estiloAdequado: "apoio"
      }
    });

    await expect(
      prisma.labTurno.update({
        where: { id: turno.id },
        data: { escolha: "A", respondidaEm: new Date(), aderencia: 55 }
      })
    ).rejects.toThrow();

    // O mesmo turno, com um valor da escala, passa.
    const salvo = await prisma.labTurno.update({
      where: { id: turno.id },
      data: { escolha: "A", respondidaEm: new Date(), aderencia: 70 }
    });
    expect(salvo.aderencia).toBe(70);
  });
});
