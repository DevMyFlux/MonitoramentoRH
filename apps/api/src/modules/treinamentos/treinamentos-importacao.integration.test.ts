// Treinamentos — importação em lote dos cenários do Lab (docs/cenarios-lab), de ponta a ponta:
// buildApp() real, JWT real e PostgreSQL descartável. Exige LAB_TEST_DATABASE_URL; sem ela, é
// ignorado. Confere: os 40 entram como RASCUNHO, repetir não duplica, o inválido volta com o
// caminho do problema, só ADMIN e DEV importam, e um cenário importado (aprovado e atribuído) é
// jogado por um participante SEM vazar o gabarito.
import { readdirSync, readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../auth/token-service.js";
import { integrationEnabled } from "../leadership-lab/db/test-database.js";
import { criarParticipante, criarUsuario, inserir } from "../leadership-lab/db/test-fixtures.js";
import {
  type Banco,
  encerrarBanco,
  prepararBanco
} from "../leadership-lab/motor/cenario-de-teste.js";

type Papel = "COMUM" | "RH" | "ADMIN" | "DEV";
type Pessoa = { id: string; token: string };
type Bruto = {
  id: string;
  questions: { id: string; alternatives: { taken: boolean }[] }[];
  [chave: string]: unknown;
};

const PREFIXO = "/api/v1/treinamentos";
const PASTA = new URL("../../../../../docs/cenarios-lab/", import.meta.url);
const arquivos = readdirSync(PASTA)
  .filter((n) => n.endsWith(".json") && n !== "_indice.json")
  .sort();
const cenarios = arquivos.map((n) => JSON.parse(readFileSync(new URL(n, PASTA), "utf8")) as Bruto);

describe.skipIf(!integrationEnabled)("importação em lote dos cenários do Lab", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let desligarPrisma: () => Promise<void>;
  const papeis = {} as Record<Papel, string>;
  let admin: Pessoa, dev: Pessoa, rh: Pessoa, ana: Pessoa;
  let turma: string;

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);
  const tokenDe = (id: string, role: Papel) =>
    createAccessToken({ id, email: `${id}@teste.local`, name: "Pessoa", role, scopes: [] });

  async function pessoa(role: Papel): Promise<Pessoa> {
    const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[role] });
    return { id, token: tokenDe(id, role) };
  }
  const chamar = (quem: Pessoa, metodo: "GET" | "POST", caminho: string, payload?: unknown) =>
    app.inject({
      method: metodo,
      url: `${PREFIXO}${caminho}`,
      headers: { authorization: `Bearer ${quem.token}` },
      ...(payload === undefined ? {} : { payload: payload as object })
    });

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../app.js");
    const { prisma } = await import("../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    app = await buildApp({ treinamentos: { config: { limiteTentativasDia: null } } });

    papeis.COMUM = banco.base.roleId;
    for (const [nome, nivel] of [
      ["RH", 2],
      ["ADMIN", 3],
      ["DEV", 4]
    ] as const) {
      papeis[nome] = await inserir(banco.db.client, '"Role"', {
        id: crypto.randomUUID(),
        name: nome,
        level: nivel,
        description: nome,
        updatedAt: new Date().toISOString()
      });
    }
    admin = await pessoa("ADMIN");
    dev = await pessoa("DEV");
    rh = await pessoa("RH");
    turma = await inserir(banco.db.client, "leadership_lab.turma", {
      nome: "Turma do Lab",
      curador_id: rh.id
    });
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { roleId: papeis.COMUM }
    });
    await banco.db.client.query(
      `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
      [turma, ctx.participanteId]
    );
    ana = { id: ctx.userId, token: tokenDe(ctx.userId, "COMUM") };
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  it("só ADMIN e DEV importam: RH e COMUM não", async () => {
    for (const quem of [rh, ana]) {
      const r = await chamar(quem, "POST", "/cenarios/importar", { cenarios: [cenarios[0]] });
      expect([403, 404], `${quem.id} ${r.body}`).toContain(r.statusCode);
    }
    const nenhum = await consulta("SELECT count(*)::int AS n FROM treinamentos.cenario");
    expect(nenhum[0].n).toBe(0);
  });

  it("os 40 entram como rascunho, versão 1, sem nenhuma aprovação", async () => {
    expect(cenarios).toHaveLength(40);
    const r = await chamar(admin, "POST", "/cenarios/importar", { cenarios });
    expect(r.statusCode, r.body).toBe(200);
    const { criados, jaExistem, invalidos, itens } = r.json().data;
    expect({ criados, jaExistem, invalidos }).toEqual({ criados: 40, jaExistem: 0, invalidos: 0 });
    expect(itens.map((i: { slug: string }) => i.slug)).toEqual(cenarios.map((c) => c.id));

    const linhas = await consulta(
      `SELECT c.status, count(*)::int AS n, count(v.aprovado_em)::int AS aprovadas, min(v.numero) AS menor, max(v.numero) AS maior
         FROM treinamentos.cenario c JOIN treinamentos.cenario_versao v ON v.cenario_id = c.id
        GROUP BY c.status`
    );
    expect(linhas).toEqual([{ status: "rascunho", n: 40, aprovadas: 0, menor: 1, maior: 1 }]);
    const pacotes = await consulta("SELECT DISTINCT scene_pack FROM treinamentos.cenario_versao");
    expect(pacotes.map((p) => p.scene_pack)).toEqual(["escritorio-gestao"]);
    // O conteúdo guardado já está no formato do projeto (slug, resumo, público, exemplo).
    const guardado = await consulta(
      `SELECT conteudo FROM treinamentos.cenario_versao v JOIN treinamentos.cenario c ON c.id = v.cenario_id WHERE c.slug = $1`,
      [cenarios[0]!.id]
    );
    expect(guardado[0].conteudo).toMatchObject({
      slug: cenarios[0]!.id,
      publico: cenarios[0]!.publico,
      exemplo: true
    });
    expect(guardado[0].conteudo).not.toHaveProperty("locale");
  });

  it("a auditoria registra cada criação", async () => {
    const auditoria = await consulta(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE entity = 'treinamentos.cenario' AND action = 'CREATE'`
    );
    expect(auditoria[0].n).toBe(40);
  });

  it("importar de novo não duplica: todos voltam como 'já existe'", async () => {
    const r = await chamar(dev, "POST", "/cenarios/importar", { cenarios });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data).toMatchObject({ criados: 0, jaExistem: 40, invalidos: 0 });
    const total = await consulta("SELECT count(*)::int AS n FROM treinamentos.cenario");
    expect(total[0].n).toBe(40);
  });

  it("o inválido volta com o caminho do problema e não impede os outros", async () => {
    const defeituoso = structuredClone(cenarios[0]!) as Bruto & {
      questions: { alternatives: { beat: { title: string } }[] }[];
    };
    defeituoso.id = "sup-defeituoso";
    defeituoso.questions[2]!.alternatives[1]!.beat.title = "";
    const novo = structuredClone(cenarios[1]!);
    novo.id = "sup-novo-valido";
    const r = await chamar(admin, "POST", "/cenarios/importar", {
      cenarios: [defeituoso, "lixo", novo]
    });
    expect(r.statusCode, r.body).toBe(200);
    const { criados, invalidos, itens } = r.json().data;
    expect({ criados, invalidos }).toEqual({ criados: 1, invalidos: 2 });
    expect(itens[0]).toMatchObject({ indice: 0, estado: "invalido", slug: "sup-defeituoso" });
    expect(itens[0].problemas.map((p: { caminho: string }) => p.caminho)).toContain(
      "questions.2.alternatives.1.beat.title"
    );
    expect(itens[1]).toMatchObject({ indice: 1, estado: "invalido", slug: null });
    expect(itens[2]).toMatchObject({ indice: 2, estado: "criado", slug: "sup-novo-valido" });
  });

  it("o endpoint de validar aceita o formato do pacote e devolve o público", async () => {
    const r = await chamar(admin, "POST", "/cenarios/validar", { conteudo: cenarios[3] });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data).toMatchObject({
      valido: true,
      resumo: {
        slug: cenarios[3]!.id,
        publico: cenarios[3]!.publico,
        scenePack: "escritorio-gestao"
      }
    });
  });

  it("um cenário importado, aprovado e atribuído é jogado até o fim sem vazar o gabarito", async () => {
    const alvo = cenarios[5]!;
    const lista = await chamar(admin, "GET", "/cenarios");
    const cenario = (
      lista.json().data as { id: string; slug: string; versoes: { id: string }[] }[]
    ).find((c) => c.slug === alvo.id)!;
    const versaoId = cenario.versoes[0]!.id;
    expect(
      (await chamar(admin, "POST", `/cenarios/${cenario.id}/aprovar`, { versaoId })).statusCode
    ).toBe(200);
    const atribuida = await chamar(admin, "POST", "/atribuicoes", { versaoId, turmaId: turma });
    expect(atribuida.statusCode, atribuida.body).toBe(201);
    const atribuicaoId = atribuida.json().data.id as string;

    const leitura = await chamar(ana, "GET", `/atribuicoes/${atribuicaoId}`);
    const iniciada = await chamar(ana, "POST", `/atribuicoes/${atribuicaoId}/tentativas`);
    expect(iniciada.statusCode, iniciada.body).toBe(200);
    const tentativa = iniciada.json().data.tentativa.id as string;
    const reacoes: string[] = [];
    for (const q of alvo.questions) {
      const r = await chamar(ana, "POST", `/tentativas/${tentativa}/respostas`, {
        perguntaId: q.id,
        alternativa: q.alternatives.findIndex((a) => a.taken)
      });
      expect(r.statusCode, r.body).toBe(200);
      reacoes.push(r.body);
    }
    for (const corpo of [leitura.body, iniciada.body, ...reacoes])
      for (const proibido of ['"taken"', '"procedure"', '"outcomes"', '"decision"', '"when"'])
        expect(corpo, proibido).not.toContain(proibido);
    // O quadro de cena que o participante recebe é o do pacote novo.
    expect(leitura.json().data.cenario.scenePack).toBe("escritorio-gestao");

    const concluida = await chamar(ana, "POST", `/tentativas/${tentativa}/concluir`);
    expect(concluida.statusCode, concluida.body).toBe(200);
    const resultado = await chamar(ana, "GET", `/tentativas/${tentativa}/resultado`);
    expect(resultado.statusCode, resultado.body).toBe(200);
    const niveis = (resultado.json().data.desfecho.outcomes as { nivel: string }[]).map(
      (o) => o.nivel
    );
    expect(new Set(niveis)).toEqual(new Set(["ok"])); // todas as decisões cumpridas
  });

  it("um rascunho importado NÃO aparece para o participante (só o aprovado e atribuído)", async () => {
    const minhas = await chamar(ana, "GET", "/minhas");
    expect(minhas.statusCode).toBe(200);
    const abertas = minhas.json().data.abertas as unknown[];
    expect(abertas).toHaveLength(1); // só a atribuição do teste anterior
  });
});
