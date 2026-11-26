// Treinamentos — a configuração do teste do Lab, de ponta a ponta (banco real, JWT real): regra de
// público, quantidade de cenários, revisão e aprovação em lote, e quem lê ou edita. Exige
// LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import { readdirSync, readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../auth/token-service.js";
import { integrationEnabled } from "../leadership-lab/db/test-database.js";
import { criarParticipante, criarUsuario, inserir } from "../leadership-lab/db/test-fixtures.js";
import {
  type Banco,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "../leadership-lab/motor/cenario-de-teste.js";
import { IaFalsa } from "../leadership-lab/motor/ia-falsa.js";

type Papel = "COMUM" | "RH" | "ADMIN" | "DEV";
type Pessoa = { id: string; token: string; participanteId?: string };
type Bruto = { id: string; publico: string; [chave: string]: unknown };

const TRE = "/api/v1/treinamentos";
const LAB = "/api/v1/leadership-lab";
const PASTA = new URL("../../../../../docs/cenarios-lab/", import.meta.url);
const cenarios = readdirSync(PASTA)
  .filter((n) => n.endsWith(".json") && n !== "_indice.json")
  .sort()
  .map((n) => JSON.parse(readFileSync(new URL(n, PASTA), "utf8")) as Bruto);
const doRh = cenarios.filter((c) => c.publico === "rh");

describe.skipIf(!integrationEnabled)("configuração do teste do Lab", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let desligarPrisma: () => Promise<void>;
  const papeis = {} as Record<Papel, string>;
  let admin: Pessoa, dev: Pessoa, rh: Pessoa, comum: Pessoa;
  let lista: {
    id: string;
    slug: string;
    status: string;
    publico: string | null;
    versoes: { id: string }[];
  }[];
  let turma: string;
  let areaCompras: string;

  const sql = (texto: string, params: unknown[] = []) =>
    banco.db.client.query(texto, params).then((r) => r.rows);
  const tokenDe = (id: string, role: Papel) =>
    createAccessToken({ id, email: `${id}@teste.local`, name: "Pessoa", role, scopes: [] });
  const chamar = (quem: Pessoa, metodo: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
    app.inject({
      method: metodo,
      url,
      headers: { authorization: `Bearer ${quem.token}` },
      ...(payload === undefined ? {} : { payload: payload as object })
    });
  const tre = (q: Pessoa, m: "GET" | "POST" | "PUT", c: string, p?: unknown) =>
    chamar(q, m, `${TRE}${c}`, p);
  const lab = (q: Pessoa, m: "GET" | "POST", c: string, p?: unknown) =>
    chamar(q, m, `${LAB}${c}`, p);

  async function pessoa(role: Papel): Promise<Pessoa> {
    const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[role] });
    return { id, token: tokenDe(id, role) };
  }
  /** Uma pessoa COMUM com vínculo, termo aceito e o cadastro dado. */
  async function participante(nivel: string, areaSlug: string): Promise<Pessoa> {
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { roleId: papeis.COMUM }
    });
    await sql(
      `UPDATE "User" SET "cargo" = 'Cargo', "nivelGovernanca" = $2::"NivelGovernanca",
              "areaId" = (SELECT id FROM "Area" WHERE slug = $3) WHERE id = $1`,
      [ctx.userId, nivel, areaSlug]
    );
    await sql(
      `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2026-1')`,
      [ctx.participanteId]
    );
    return {
      id: ctx.userId,
      token: tokenDe(ctx.userId, "COMUM"),
      participanteId: ctx.participanteId
    };
  }
  const proxima = async (q: Pessoa) => (await lab(q, "GET", "/teste/proxima")).json().data;

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../app.js");
    const { prisma } = await import("../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    app = await buildApp({
      lab: {
        ia: new IaFalsa(),
        config: configDeTeste({ modoDoTeste: "cenarios", cenariosPorTeste: 3 })
      },
      treinamentos: { config: { limiteTentativasDia: null } }
    });
    papeis.COMUM = banco.base.roleId;
    for (const [nome, nivel] of [
      ["RH", 2],
      ["ADMIN", 3],
      ["DEV", 4]
    ] as const)
      papeis[nome] = await inserir(banco.db.client, '"Role"', {
        id: crypto.randomUUID(),
        name: nome,
        level: nivel,
        description: nome,
        updatedAt: new Date().toISOString()
      });
    admin = await pessoa("ADMIN");
    dev = await pessoa("DEV");
    rh = await pessoa("RH");
    comum = await participante("supervisor", "manutencao");
    turma = await inserir(banco.db.client, "leadership_lab.turma", {
      nome: "Turma",
      curador_id: rh.id
    });
    areaCompras = (await sql(`SELECT id FROM "Area" WHERE slug = 'compras'`))[0].id;

    expect((await tre(admin, "POST", "/cenarios/importar", { cenarios })).statusCode).toBe(200);
    lista = (await tre(admin, "GET", "/cenarios")).json().data;
    // 3 cenários do RH aprovados (para o teste das quantidades).
    for (const c of doRh.slice(0, 3)) {
      const e = lista.find((x) => x.slug === c.id)!;
      expect(
        (await tre(admin, "POST", `/cenarios/${e.id}/aprovar`, { versaoId: e.versoes[0]!.id }))
          .statusCode
      ).toBe(200);
    }
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  it("a lista traz o público de cada cenário (coluna), e o RH lê a lista mas não edita", async () => {
    const r = await tre(rh, "GET", "/cenarios");
    expect(r.statusCode, r.body).toBe(200);
    const itens = r.json().data as { slug: string; publico: string | null }[];
    expect(itens).toHaveLength(40);
    for (const c of cenarios) expect(itens.find((i) => i.slug === c.id)!.publico).toBe(c.publico);
    expect((await tre(rh, "POST", "/cenarios/validar", { conteudo: cenarios[0] })).statusCode).toBe(
      403
    );
    expect(
      (await tre(rh, "POST", "/cenarios/importar", { cenarios: [cenarios[0]] })).statusCode
    ).toBe(403);
    expect((await tre(comum, "GET", "/cenarios")).statusCode).toBe(404);
    // O módulo antigo está fechado ao COMUM (ele faz os cenários dentro do teste do Lab): 404 em tudo,
    // com a mesma resposta de uma rota que não existe para ele; sem login, 401.
    for (const [metodo, caminho] of [
      ["GET", "/minhas"],
      ["GET", "/atribuicoes/00000000-0000-4000-8000-000000000000"],
      ["POST", "/tentativas/00000000-0000-4000-8000-000000000000/concluir"],
      ["GET", "/rh/tentativas"]
    ] as const) {
      expect((await tre(comum, metodo, caminho)).statusCode, caminho).toBe(404);
    }
  });

  it("as regras iniciais são as do cadastro de contas; o RH lê, só ADMIN e DEV salvam, o COMUM nada", async () => {
    const r = await tre(rh, "GET", "/configuracao/regras");
    expect(r.statusCode, r.body).toBe(200);
    const { regras, areas } = r.json().data;
    expect(regras).toHaveLength(8);
    expect(areas.map((a: { nome: string }) => a.nome)).toContain("Compras");
    expect(regras).toContainEqual(
      expect.objectContaining({
        nivelGovernanca: "coordenador",
        publico: "coordenador-administrativo"
      })
    );
    expect((await tre(rh, "PUT", "/configuracao/regras", { regras })).statusCode).toBe(403);
    expect((await tre(comum, "GET", "/configuracao/regras")).statusCode).toBe(404);
    expect((await tre(comum, "PUT", "/configuracao/regras", { regras })).statusCode).toBe(404);
  });

  it("salvar as regras muda o público de quem usa o teste (e grava a auditoria)", async () => {
    const coordCompras = await participante("coordenador", "compras");
    // Antes: sem regra de Compras, cai pelo nível (coordenador-administrativo).
    expect((await proxima(coordCompras)).publico).toBe("coordenador-administrativo");
    const { regras } = (await tre(admin, "GET", "/configuracao/regras")).json().data;
    const novas = [
      ...regras,
      { nivelGovernanca: "coordenador", areaId: areaCompras, publico: "rh", ativa: true }
    ];
    const salvar = await tre(admin, "PUT", "/configuracao/regras", { regras: novas });
    expect(salvar.statusCode, salvar.body).toBe(200);
    expect(salvar.json().data).toEqual({ salvas: 9 });
    expect((await proxima(coordCompras)).publico).toBe("rh"); // a regra mais específica vence
    // Desativar volta ao padrão.
    const desativada = novas.map((r, i) => (i === novas.length - 1 ? { ...r, ativa: false } : r));
    await tre(dev, "PUT", "/configuracao/regras", { regras: desativada });
    expect((await proxima(coordCompras)).publico).toBe("coordenador-administrativo");
    const auditoria = await sql(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE entity = 'treinamentos.regra_publico'`
    );
    expect(auditoria[0].n).toBe(2);
    // Voltar as regras originais para os próximos testes.
    await tre(admin, "PUT", "/configuracao/regras", { regras });
  });

  it("regra inválida é recusada: sem nível nem área, público desconhecido, área que não existe", async () => {
    const base = { nivelGovernanca: "supervisor", areaId: null, publico: "rh", ativa: true };
    expect(
      (
        await tre(admin, "PUT", "/configuracao/regras", {
          regras: [{ ...base, nivelGovernanca: null }]
        })
      ).statusCode
    ).toBe(400);
    expect(
      (
        await tre(admin, "PUT", "/configuracao/regras", {
          regras: [{ ...base, publico: "diretoria" }]
        })
      ).statusCode
    ).toBe(400);
    const inexistente = await tre(admin, "PUT", "/configuracao/regras", {
      regras: [{ ...base, areaId: crypto.randomUUID() }]
    });
    expect(inexistente.statusCode).toBe(400);
    expect(inexistente.json().code).toBe("TREINO_AREA_INEXISTENTE");
    // Nada mudou.
    expect((await sql(`SELECT count(*)::int AS n FROM treinamentos.regra_publico`))[0].n).toBe(8);
  });

  it("a quantidade de cenários: por público, por turma (que vence), e sem configuração vale o padrão", async () => {
    const pessoaRh = await participante("assistente", "rh");
    expect(await proxima(pessoaRh)).toMatchObject({ publico: "rh", total: 3 }); // padrão: 3 (há 3 aprovados)
    const q = await tre(admin, "PUT", "/configuracao/quantidades", {
      itens: [{ publico: "rh", turmaId: null, quantidade: 2 }]
    });
    expect(q.statusCode, q.body).toBe(200);
    expect((await proxima(pessoaRh)).total).toBe(2);
    // A turma dela, com uma quantidade própria, vence a do público.
    await sql(
      `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
      [turma, pessoaRh.participanteId]
    );
    await tre(admin, "PUT", "/configuracao/quantidades", {
      itens: [
        { publico: "rh", turmaId: null, quantidade: 2 },
        { publico: "rh", turmaId: turma, quantidade: 1 }
      ]
    });
    expect((await proxima(pessoaRh)).total).toBe(1);
    const lidas = (await tre(rh, "GET", "/configuracao/quantidades")).json().data;
    expect(lidas.padrao).toBe(3);
    expect(lidas.itens).toContainEqual({
      publico: "rh",
      turmaId: turma,
      turma: "Turma",
      quantidade: 1
    });
    // Iniciar respeita a quantidade.
    const iniciada = await lab(pessoaRh, "POST", "/teste", {});
    expect(iniciada.json().data.trilha.total).toBe(1);
    // Sem configuração, volta ao padrão (para quem ainda não começou).
    await tre(admin, "PUT", "/configuracao/quantidades", { itens: [] });
    expect((await sql(`SELECT count(*)::int AS n FROM treinamentos.teste_config`))[0].n).toBe(0);
  });

  it("quantidade inválida é recusada: 0, 11, repetida, turma inexistente; e o RH não edita", async () => {
    const item = { publico: "rh", turmaId: null, quantidade: 3 };
    for (const itens of [[{ ...item, quantidade: 0 }], [{ ...item, quantidade: 11 }], [item, item]])
      expect((await tre(admin, "PUT", "/configuracao/quantidades", { itens })).statusCode).toBe(
        400
      );
    const turmaFalsa = await tre(admin, "PUT", "/configuracao/quantidades", {
      itens: [{ ...item, turmaId: crypto.randomUUID() }]
    });
    expect(turmaFalsa.json().code).toBe("TREINO_TURMA_INEXISTENTE");
    expect((await tre(rh, "PUT", "/configuracao/quantidades", { itens: [item] })).statusCode).toBe(
      403
    );
  });

  it("revisão: rascunho vai para em revisão (uma vez só) e depois pode ser aprovado", async () => {
    const e = lista.find(
      (x) => x.slug === cenarios.find((c) => c.publico === "coordenador-administrativo")!.id
    )!;
    expect(e.status).toBe("rascunho");
    const r = await tre(admin, "POST", `/cenarios/${e.id}/revisao`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data.status).toBe("em_revisao");
    const de_novo = await tre(admin, "POST", `/cenarios/${e.id}/revisao`);
    expect(de_novo.statusCode).toBe(409);
    expect(de_novo.json().code).toBe("TREINO_STATUS_INVALIDO");
    expect((await tre(rh, "POST", `/cenarios/${e.id}/revisao`)).statusCode).toBe(403);
    const aprovada = await tre(admin, "POST", `/cenarios/${e.id}/aprovar`, {
      versaoId: e.versoes[0]!.id
    });
    expect(aprovada.statusCode, aprovada.body).toBe(200);
    expect(
      (await sql(`SELECT status FROM treinamentos.cenario WHERE id = $1`, [e.id]))[0].status
    ).toBe("aprovado");
  });

  it("aprovar em lote: cada item tem o seu resultado; o que já estava aprovado é recusado sem barrar os outros", async () => {
    const alvos = lista
      .filter((x) => cenarios.find((c) => c.id === x.slug)!.publico === "administrativo-geral")
      .slice(0, 3);
    const itens = alvos.map((e) => ({ cenarioId: e.id, versaoId: e.versoes[0]!.id }));
    const primeira = await tre(admin, "POST", "/cenarios/aprovar-em-lote", { itens });
    expect(primeira.statusCode, primeira.body).toBe(200);
    expect(primeira.json().data).toMatchObject({ aprovadas: 3, recusadas: 0 });
    const outro = lista.find(
      (x) =>
        cenarios.find((c) => c.id === x.slug)!.publico === "administrativo-geral" &&
        !alvos.includes(x)
    )!;
    const mista = await tre(admin, "POST", "/cenarios/aprovar-em-lote", {
      itens: [itens[0]!, { cenarioId: outro.id, versaoId: outro.versoes[0]!.id }]
    });
    expect(mista.json().data).toMatchObject({ aprovadas: 1, recusadas: 1 });
    expect(mista.json().data.itens[0]).toMatchObject({
      estado: "recusada",
      codigo: "TREINO_VERSAO_JA_APROVADA"
    });
    expect((await tre(rh, "POST", "/cenarios/aprovar-em-lote", { itens })).statusCode).toBe(403);
    expect((await tre(admin, "POST", "/cenarios/aprovar-em-lote", { itens: [] })).statusCode).toBe(
      400
    );
    // Cada aprovação ficou na auditoria.
    expect(
      (
        await sql(
          `SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'APPROVE' AND entity = 'treinamentos.cenario_versao'`
        )
      )[0].n
    ).toBeGreaterThanOrEqual(8);
  });
});
