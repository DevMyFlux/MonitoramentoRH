// O teste interno (DEV, ADMIN, RH) nunca fica sem saída: não depende do termo de participante e pode
// ser retomado ou reiniciado, inclusive quando há um teste do modo anterior em aberto. O COMUM não
// ganha esses atalhos. Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../../auth/token-service.js";
import { integrationEnabled } from "../db/test-database.js";
import { criarParticipante, criarSessao, inserir } from "../db/test-fixtures.js";
import { type Banco, configDeTeste, encerrarBanco, prepararBanco } from "../motor/cenario-de-teste.js";
import { IaFalsa } from "../motor/ia-falsa.js";
import { readdirSync, readFileSync } from "node:fs";

type Papel = "COMUM" | "DEV" | "ADMIN";
const LAB = "/api/v1/leadership-lab";
const PASTA = new URL("../../../../../../docs/cenarios-lab/", import.meta.url);

describe.skipIf(!integrationEnabled)("teste interno: retomar e reiniciar", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let desligarPrisma: () => Promise<void>;
  const papeis = {} as Record<Papel, string>;

  const sql = (texto: string, params: unknown[] = []) =>
    banco.db.client.query(texto, params).then((r) => r.rows);

  async function pessoa(role: Papel, { termo = false } = {}) {
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { roleId: papeis[role] }
    });
    await sql(
      `UPDATE "User" SET "cargo" = 'Cargo de teste', "nivelGovernanca" = 'supervisor'::"NivelGovernanca",
              "areaId" = (SELECT id FROM "Area" WHERE slug = 'manutencao') WHERE id = $1`,
      [ctx.userId]
    );
    if (termo)
      await sql(
        `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2026-1')`,
        [ctx.participanteId]
      );
    const token = createAccessToken({
      id: ctx.userId,
      email: `${ctx.userId}@teste.local`,
      name: "Pessoa",
      role,
      scopes: []
    });
    const chamar = (metodo: "GET" | "POST", caminho: string, payload?: object) =>
      app.inject({
        method: metodo,
        url: `${LAB}${caminho}`,
        headers: { authorization: `Bearer ${token}` },
        ...(payload ? { payload } : {})
      });
    return { ...ctx, token, chamar };
  }
  const sessoesDe = (participanteId: string) =>
    sql(
      `SELECT id, status, modo FROM leadership_lab.sessao WHERE participante_id = $1 ORDER BY iniciada_em, modo`,
      [participanteId]
    );

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../../app.js");
    const { prisma } = await import("../../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    app = await buildApp({
      lab: {
        ia: new IaFalsa(),
        config: configDeTeste({ modoDoTeste: "cenarios", cenariosPorTeste: 1 })
      }
    });
    papeis.COMUM = banco.base.roleId;
    for (const [nome, nivel] of [
      ["DEV", 4],
      ["ADMIN", 3]
    ] as const)
      papeis[nome] = await inserir(banco.db.client, '"Role"', {
        id: crypto.randomUUID(),
        name: nome,
        level: nivel,
        description: nome,
        updatedAt: new Date().toISOString()
      });
    const admin = await pessoa("ADMIN");
    const cenarios = readdirSync(PASTA)
      .filter((n) => n.startsWith("supervisor-") && n.endsWith(".json"))
      .slice(0, 2)
      .map((n) => JSON.parse(readFileSync(new URL(n, PASTA), "utf8")) as object);
    const importados = await app.inject({
      method: "POST",
      url: "/api/v1/treinamentos/cenarios/importar",
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { cenarios }
    });
    expect(importados.statusCode, importados.body).toBe(200);
    // Aprova direto no banco: o fluxo de aprovação já tem os testes dele.
    await sql(`UPDATE treinamentos.cenario_versao SET aprovado_em = now(), aprovado_por = $1`, [
      admin.userId
    ]);
    await sql(`UPDATE treinamentos.cenario SET status = 'aprovado'`);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    if (banco) await encerrarBanco(banco);
  });

  it("o DEV começa o teste interno sem o termo de ciência, e o painel não o bloqueia por isso", async () => {
    const dev = await pessoa("DEV");
    const antes = await dev.chamar("GET", "/teste/proxima");
    expect(antes.json().data).toMatchObject({ tipo: "sem-teste", podeIniciar: true });
    const painel = await dev.chamar("GET", "/painel");
    expect(painel.json().data.acao.tipo, painel.body).toBe("iniciar");
    const inicio = await dev.chamar("POST", "/teste", {});
    expect(inicio.statusCode, inicio.body).toBe(200);
    expect(inicio.json().data.trilha.origem).toBe("interno");
  });

  it("o COMUM continua precisando do termo e não reinicia: um teste só, que ele retoma", async () => {
    const sem = await pessoa("COMUM");
    expect((await sem.chamar("POST", "/teste", {})).json().code).toBe("LAB_TERMO_PENDENTE");

    const comum = await pessoa("COMUM", { termo: true });
    const um = (await comum.chamar("POST", "/teste", {})).json().data;
    const negado = await comum.chamar("POST", "/teste/reiniciar");
    expect(negado.statusCode, negado.body).toBe(403);
    const dois = (await comum.chamar("POST", "/teste", {})).json().data;
    expect(dois.trilha.sessaoId).toBe(um.trilha.sessaoId);
    expect(await sessoesDe(comum.participanteId)).toHaveLength(1);
  });

  it("o DEV retoma o teste aberto ou o reinicia: o anterior é cancelado, com auditoria", async () => {
    const dev = await pessoa("DEV");
    const velho = (await dev.chamar("POST", "/teste", {})).json().data;
    const retomado = (await dev.chamar("POST", "/teste", {})).json().data;
    expect(retomado.trilha.sessaoId).toBe(velho.trilha.sessaoId);

    const r = await dev.chamar("POST", "/teste/reiniciar");
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data).toEqual({ encerrado: true });
    expect(await sessoesDe(dev.participanteId)).toMatchObject([{ status: "cancelada" }]);
    const auditoria = await sql(
      `SELECT "userRole", entity FROM "AuditLog" WHERE "entityId" = $1`,
      [velho.trilha.sessaoId]
    );
    expect(auditoria).toEqual([{ userRole: "DEV", entity: "LabSessao" }]);

    // A tentativa abandonada não aceita mais nada.
    const pergunta = velho.cenario.questions[0].id;
    const resposta = await dev.chamar("POST", `/teste/${velho.tentativa.id}/respostas`, {
      perguntaId: pergunta,
      alternativa: 0
    });
    expect(resposta.json().code, resposta.body).toBe("LAB_SESSAO_ENCERRADA");
    const concluir = await dev.chamar("POST", `/teste/${velho.tentativa.id}/concluir`);
    expect(concluir.json().code, concluir.body).toBe("LAB_SESSAO_ENCERRADA");

    const novo = (await dev.chamar("POST", "/teste", {})).json().data;
    expect(novo.trilha.sessaoId).not.toBe(velho.trilha.sessaoId);
    // E o novo vai até o fim.
    for (const q of novo.cenario.questions)
      await dev.chamar("POST", `/teste/${novo.tentativa.id}/respostas`, {
        perguntaId: q.id,
        alternativa: 0
      });
    const fim = await dev.chamar("POST", `/teste/${novo.tentativa.id}/concluir`);
    expect(fim.json().data.resultadoDaSessao, fim.body).toBe(novo.trilha.sessaoId);
  });

  it("um teste do modo anterior em aberto deixa de ser um beco sem saída para o DEV", async () => {
    const dev = await pessoa("DEV");
    await criarSessao(banco.db.client, dev);
    const preso = (await dev.chamar("GET", "/teste/proxima")).json().data;
    expect(preso).toMatchObject({ tipo: "sem-teste", motivo: "teste-legado-em-andamento" });

    expect((await dev.chamar("POST", "/teste/reiniciar")).statusCode).toBe(200);
    const livre = (await dev.chamar("GET", "/teste/proxima")).json().data;
    expect(livre).toMatchObject({ tipo: "sem-teste", podeIniciar: true, motivo: null });
    expect((await dev.chamar("POST", "/teste", {})).statusCode).toBe(200);
  });

  it("reiniciar sem teste aberto não faz nada", async () => {
    const dev = await pessoa("DEV");
    const r = await dev.chamar("POST", "/teste/reiniciar");
    expect(r.json().data, r.body).toEqual({ encerrado: false });
  });
});
