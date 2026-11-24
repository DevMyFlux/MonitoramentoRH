// Treinamentos Interativos — rotas HTTP de ponta a ponta: buildApp() real, JWT real e PostgreSQL
// real (banco descartável com todas as migrações). Exige LAB_TEST_DATABASE_URL; sem ela, é
// ignorado. Veja leadership-lab/db/test-database.ts.
import { readFileSync } from "node:fs";
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
type Pessoa = { id: string; token: string; participanteId?: string };

const PREFIXO = "/api/v1/treinamentos";
const exemplo = (nome: string) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../../../packages/shared/src/treinamentos/exemplos/${nome}.json`,
        import.meta.url
      ),
      "utf8"
    )
  ) as {
    slug: string;
    questions: { id: string; alternatives: { taken: boolean }[] }[];
    [chave: string]: unknown;
  };
const quadro = exemplo("manutencao-quadro-uti");
const plantao = exemplo("rh-falta-plantao-noturno");

/** A primeira alternativa que cumpre (ou não cumpre) a decisão de cada pergunta. */
const escolhas = (cumpre: boolean) =>
  quadro.questions.map((q) => ({
    perguntaId: q.id,
    alternativa: q.alternatives.findIndex((a) => a.taken === cumpre)
  }));

describe.skipIf(!integrationEnabled)("rotas dos Treinamentos Interativos", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let desligarPrisma: () => Promise<void>;
  let buildApp: typeof import("../../app.js").buildApp;
  const papeis = {} as Record<Papel, string>;
  let admin: Pessoa, dev: Pessoa, rh1: Pessoa, rh2: Pessoa, ana: Pessoa, beto: Pessoa, caio: Pessoa;
  let turmaA: string, turmaB: string;
  let cenarioId: string, versaoId: string, atribuicaoA: string, atribuicaoB: string;

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  const tokenDe = (id: string, role: Papel) =>
    createAccessToken({ id, email: `${id}@teste.local`, name: "Pessoa", role, scopes: [] });

  async function pessoa(role: Papel): Promise<Pessoa> {
    const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[role] });
    return { id, token: tokenDe(id, role) };
  }
  async function participante(turmaId: string): Promise<Pessoa> {
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { roleId: papeis.COMUM }
    });
    // Tabela sem coluna id (o `inserir` dos fixtures faz RETURNING id): SQL direto.
    await banco.db.client.query(
      `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
      [turmaId, ctx.participanteId]
    );
    return {
      id: ctx.userId,
      token: tokenDe(ctx.userId, "COMUM"),
      participanteId: ctx.participanteId
    };
  }
  async function turma(nome: string, curador: Pessoa): Promise<string> {
    return inserir(banco.db.client, "leadership_lab.turma", { nome, curador_id: curador.id });
  }

  function chamar(
    quem: Pessoa,
    metodo: "GET" | "POST",
    caminho: string,
    payload?: unknown,
    alvo: FastifyInstance = app
  ) {
    return alvo.inject({
      method: metodo,
      url: `${PREFIXO}${caminho}`,
      headers: { authorization: `Bearer ${quem.token}` },
      ...(payload === undefined ? {} : { payload: payload as object })
    });
  }

  async function iniciar(quem: Pessoa, atribuicaoId: string): Promise<string> {
    const r = await chamar(quem, "POST", `/atribuicoes/${atribuicaoId}/tentativas`);
    expect(r.statusCode, r.body).toBe(200);
    return r.json().data.tentativa.id as string;
  }
  async function responderTudo(quem: Pessoa, tentativaId: string, cumpre = true) {
    for (const e of escolhas(cumpre)) {
      const r = await chamar(quem, "POST", `/tentativas/${tentativaId}/respostas`, e);
      expect(r.statusCode, r.body).toBe(200);
    }
  }

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    ({ buildApp } = await import("../../app.js"));
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
    rh1 = await pessoa("RH");
    rh2 = await pessoa("RH");
    turmaA = await turma("Turma A", rh1);
    turmaB = await turma("Turma B", rh2);
    ana = await participante(turmaA);
    caio = await participante(turmaA);
    beto = await participante(turmaB);

    const criado = await chamar(admin, "POST", "/cenarios", { conteudo: quadro });
    expect(criado.statusCode, criado.body).toBe(201);
    ({ id: cenarioId, versaoId } = criado.json().data);
    const aprovado = await chamar(admin, "POST", `/cenarios/${cenarioId}/aprovar`, { versaoId });
    expect(aprovado.statusCode, aprovado.body).toBe(200);
    const a = await chamar(admin, "POST", "/atribuicoes", { versaoId, turmaId: turmaA });
    const b = await chamar(admin, "POST", "/atribuicoes", { versaoId, turmaId: turmaB });
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    atribuicaoA = a.json().data.id;
    atribuicaoB = b.json().data.id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  // ---------------------------------------------------------------------------

  it("o participante vê só o que pode: sem `taken`, tom, decisões nem regras, e sem cache", async () => {
    const minhas = await chamar(ana, "GET", "/minhas");
    expect(minhas.statusCode).toBe(200);
    expect(minhas.headers["cache-control"]).toBe("no-store");
    expect(minhas.json().data.abertas.map((x: { atribuicaoId: string }) => x.atribuicaoId)).toEqual(
      [atribuicaoA]
    );

    const leitura = await chamar(ana, "GET", `/atribuicoes/${atribuicaoA}`);
    expect(leitura.statusCode).toBe(200);
    expect(leitura.json().data.tentativa).toBeNull(); // abrir só lê: não inicia nada
    const iniciada = await chamar(ana, "POST", `/atribuicoes/${atribuicaoA}/tentativas`);
    for (const corpo of [leitura.body, iniciada.body])
      for (const proibido of [
        '"taken"',
        '"tone"',
        '"procedure"',
        '"when"',
        '"decision"',
        '"outcomes"'
      ])
        expect(corpo, proibido).not.toContain(proibido);
    expect(iniciada.json().data.retomada).toBe(false);
  });

  it("recarregar retoma a mesma tentativa; dois inícios ao mesmo tempo criam uma só", async () => {
    const [r1, r2] = await Promise.all([
      chamar(caio, "POST", `/atribuicoes/${atribuicaoA}/tentativas`),
      chamar(caio, "POST", `/atribuicoes/${atribuicaoA}/tentativas`)
    ]);
    expect([r1.statusCode, r2.statusCode]).toEqual([200, 200]);
    expect(r1.json().data.tentativa.id).toBe(r2.json().data.tentativa.id);
    const linhas = await consulta(
      `SELECT count(*)::int AS n FROM treinamentos.tentativa t
         JOIN leadership_lab.participante p ON p.id = t.participante_id WHERE p.user_id = $1`,
      [caio.id]
    );
    expect(linhas[0].n).toBe(1);
  });

  it("resposta idempotente; outra alternativa para a mesma pergunta é 409; reação só da escolhida", async () => {
    const tentativa = await iniciar(ana, atribuicaoA);
    const primeira = await chamar(ana, "POST", `/tentativas/${tentativa}/respostas`, {
      perguntaId: "q4",
      alternativa: 2
    });
    expect(primeira.statusCode).toBe(200);
    expect(primeira.json().data.reacao).toMatchObject({
      tone: "warn",
      title: "Vigia não é bloqueio"
    });
    expect(primeira.body).not.toContain('"taken"');

    const repetida = await chamar(ana, "POST", `/tentativas/${tentativa}/respostas`, {
      perguntaId: "q4",
      alternativa: 2
    });
    expect(repetida.statusCode).toBe(200);
    expect(repetida.json().data).toEqual(primeira.json().data);

    const outra = await chamar(ana, "POST", `/tentativas/${tentativa}/respostas`, {
      perguntaId: "q4",
      alternativa: 1
    });
    expect(outra.statusCode).toBe(409);
    expect(outra.json().code).toBe("TREINO_RESPOSTA_JA_DADA");

    const invalida = await chamar(ana, "POST", `/tentativas/${tentativa}/respostas`, {
      perguntaId: "q99",
      alternativa: 0
    });
    expect(invalida.json().code).toBe("TREINO_ESCOLHA_INVALIDA");

    // Recarregar mostra a resposta dada e a reação dela.
    const leitura = await chamar(ana, "GET", `/atribuicoes/${atribuicaoA}`);
    expect(leitura.json().data.tentativa.respostas).toEqual([
      expect.objectContaining({ perguntaId: "q4", alternativa: 2 })
    ]);
  });

  it("concluir sem as 5 respostas é recusado, com as que faltam", async () => {
    const tentativa = await iniciar(ana, atribuicaoA);
    const r = await chamar(ana, "POST", `/tentativas/${tentativa}/concluir`);
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      code: "TREINO_RESPOSTAS_INCOMPLETAS",
      details: { faltam: ["q1", "q2", "q3", "q5"] }
    });
    // O resultado de uma tentativa em andamento não sai.
    const resultado = await chamar(ana, "GET", `/tentativas/${tentativa}/resultado`);
    expect(resultado.json().code).toBe("TREINO_TENTATIVA_EM_ANDAMENTO");
  });

  it("conclui, calcula o desfecho no servidor e entrega decisões e regras para a análise", async () => {
    const tentativa = await iniciar(beto, atribuicaoB);
    await responderTudo(beto, tentativa, true);
    const r = await chamar(beto, "POST", `/tentativas/${tentativa}/concluir`);
    expect(r.statusCode, r.body).toBe(200);
    const data = r.json().data;
    expect(data.desfecho.outcomes.map((o: { nivel: string }) => o.nivel)).toEqual([
      "ok",
      "ok",
      "ok"
    ]);
    expect(data.decisoes.every((d: { cumpriu: boolean }) => d.cumpriu)).toBe(true);
    expect(data.regras.events.length).toBeGreaterThan(0);
    expect(data.participante).toBeUndefined(); // o dono não precisa do próprio nome

    // Concluir de novo devolve o mesmo retrato (idempotente).
    const de_novo = await chamar(beto, "POST", `/tentativas/${tentativa}/concluir`);
    expect(de_novo.json().data.desfecho).toEqual(data.desfecho);
    const nova_resposta = await chamar(beto, "POST", `/tentativas/${tentativa}/respostas`, {
      perguntaId: "q1",
      alternativa: 0
    });
    expect(nova_resposta.json().code).toBe("TREINO_TENTATIVA_ENCERRADA");
  });

  it("/simular recalcula pelo mesmo motor e não grava nada", async () => {
    const tentativa = await iniciar(caio, atribuicaoA);
    await responderTudo(caio, tentativa, true);
    await chamar(caio, "POST", `/tentativas/${tentativa}/concluir`);
    const contar = () =>
      consulta(
        `SELECT (SELECT count(*) FROM treinamentos.tentativa)::int AS t,
                (SELECT count(*) FROM treinamentos.resposta)::int AS r,
                (SELECT count(*) FROM "AuditLog")::int AS a,
                (SELECT resultados::text FROM treinamentos.tentativa WHERE id = $1) AS retrato`,
        [tentativa]
      );
    const antes = await contar();
    const decisoes = { avisar_uti: true, apr: true, epi: true, bloqueio: true, medir: false };
    const r = await chamar(caio, "POST", `/tentativas/${tentativa}/simular`, { decisoes });
    expect(r.statusCode, r.body).toBe(200);
    expect(
      r.json().data.outcomes.map((o: { id: string; nivel: string }) => [o.id, o.nivel])
    ).toEqual([
      ["tecnico", "warn"],
      ["uti", "warn"],
      ["conformidade", "warn"]
    ]);
    expect(await contar()).toEqual(antes);

    const incompleta = await chamar(caio, "POST", `/tentativas/${tentativa}/simular`, {
      decisoes: { medir: false }
    });
    expect(incompleta.json().code).toBe("TREINO_DECISOES_INVALIDAS");
  });

  it("404 uniforme: tentativa de outra pessoa, de fora da turma ou inexistente respondem igual", async () => {
    const tentativaDoBeto = (
      await consulta(
        `SELECT t.id FROM treinamentos.tentativa t JOIN leadership_lab.participante p ON p.id = t.participante_id
          WHERE p.user_id = $1 AND t.status = 'concluida' LIMIT 1`,
        [beto.id]
      )
    )[0].id as string;
    const inexistente = await chamar(ana, "GET", `/tentativas/${crypto.randomUUID()}/resultado`);
    const alheia = await chamar(ana, "GET", `/tentativas/${tentativaDoBeto}/resultado`);
    const foraDaTurma = await chamar(rh1, "GET", `/tentativas/${tentativaDoBeto}/resultado`);
    const atribuicaoAlheia = await chamar(ana, "GET", `/atribuicoes/${atribuicaoB}`);
    for (const r of [inexistente, alheia, foraDaTurma, atribuicaoAlheia]) {
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual(inexistente.json());
    }
    // O curador da turma B vê, com o nome do participante.
    const doCurador = await chamar(rh2, "GET", `/tentativas/${tentativaDoBeto}/resultado`);
    expect(doCurador.statusCode).toBe(200);
    expect(doCurador.json().data.acesso).toBe("curador");
  });

  it("o curador lista só as turmas ativas dele; o DEV vê todas", async () => {
    const titulos = async (quem: Pessoa) =>
      (await chamar(quem, "GET", "/rh/tentativas"))
        .json()
        .data.map((t: { turma: string }) => t.turma);
    expect(new Set(await titulos(rh1))).toEqual(new Set(["Turma A"]));
    expect(new Set(await titulos(rh2))).toEqual(new Set(["Turma B"]));
    expect(new Set(await titulos(dev))).toEqual(new Set(["Turma A", "Turma B"]));
    expect((await chamar(ana, "GET", "/rh/tentativas")).statusCode).toBe(403);

    // Turma desativada some da lista do curador.
    await consulta(`UPDATE leadership_lab.turma SET ativa = false WHERE id = $1`, [turmaB]);
    expect(await titulos(rh2)).toEqual([]);
    await consulta(`UPDATE leadership_lab.turma SET ativa = true WHERE id = $1`, [turmaB]);
  });

  it("validar: dois curadores ao mesmo tempo, um só valida; o outro recebe 409; auditado", async () => {
    const tentativa = (await chamar(rh2, "GET", "/rh/tentativas?situacao=pendentes")).json().data[0]
      .tentativaId as string;
    const [r1, r2] = await Promise.all([
      chamar(rh2, "POST", `/rh/tentativas/${tentativa}/validar`, { nota: "Muito bem." }),
      chamar(dev, "POST", `/rh/tentativas/${tentativa}/validar`, { nota: "Ok." })
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409]);
    const auditoria = await consulta(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE entity = 'treinamentos.tentativa' AND "entityId" = $1`,
      [tentativa]
    );
    expect(auditoria[0].n).toBe(1);
    expect((await chamar(rh1, "POST", `/rh/tentativas/${tentativa}/validar`, {})).statusCode).toBe(
      404
    );
  });

  it("versão aprovada é imutável no banco, não é aprovada duas vezes e só ela é atribuível", async () => {
    const tentativaMudar = await banco.db.client
      .query(`UPDATE treinamentos.cenario_versao SET scene_pack = 'outro' WHERE id = $1`, [
        versaoId
      ])
      .then(() => "passou")
      .catch((e: Error) => e.message);
    expect(tentativaMudar).toMatch(/TREINO_VERSAO_IMUTAVEL/);
    const tentativaApagar = await banco.db.client
      .query(`DELETE FROM treinamentos.cenario_versao WHERE id = $1`, [versaoId])
      .then(() => "passou")
      .catch((e: Error) => e.message);
    expect(tentativaApagar).toMatch(/TREINO_VERSAO_IMUTAVEL/);

    const de_novo = await chamar(admin, "POST", `/cenarios/${cenarioId}/aprovar`, { versaoId });
    expect(de_novo.json().code).toBe("TREINO_VERSAO_JA_APROVADA");

    const v2 = await chamar(admin, "POST", `/cenarios/${cenarioId}/versoes`, { conteudo: quadro });
    expect(v2.statusCode, v2.body).toBe(201);
    expect(v2.json().data.numero).toBe(2);
    const naoAprovada = await chamar(admin, "POST", "/atribuicoes", {
      versaoId: v2.json().data.versaoId,
      turmaId: turmaA
    });
    expect(naoAprovada.json().code).toBe("TREINO_VERSAO_NAO_APROVADA");

    const outroSlug = await chamar(admin, "POST", `/cenarios/${cenarioId}/versoes`, {
      conteudo: plantao
    });
    expect(outroSlug.json().code).toBe("TREINO_SLUG_DIFERENTE");
  });

  it("autoria: validar devolve problemas por caminho; só ADMIN e DEV configuram; slug único", async () => {
    const ruim = structuredClone(quadro) as unknown as Record<string, unknown> & {
      questions: { alternatives: { beat: { tone: string } }[] }[];
    };
    ruim.questions[0]!.alternatives[1]!.beat.tone = "bad";
    const r = await chamar(admin, "POST", "/cenarios/validar", { conteudo: ruim });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toMatchObject({
      valido: false,
      problemas: [{ caminho: "questions.0.alternatives.1.beat.tone" }]
    });
    const criar = await chamar(admin, "POST", "/cenarios", { conteudo: ruim });
    expect(criar.statusCode).toBe(422);

    for (const quem of [ana, rh1])
      expect((await chamar(quem, "GET", "/cenarios")).statusCode).toBe(403);
    expect((await chamar(dev, "GET", "/cenarios")).statusCode).toBe(200);

    const repetido = await chamar(admin, "POST", "/cenarios", { conteudo: quadro });
    expect(repetido.json().code).toBe("TREINO_SLUG_EM_USO");

    const segundo = await chamar(admin, "POST", "/cenarios", { conteudo: plantao });
    expect(segundo.statusCode).toBe(201);
  });

  it("auditoria na mesma transação: se o registro de auditoria falha, a atribuição não fica", async () => {
    await consulta(`
      CREATE FUNCTION pg_temp_falha_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.entity = 'treinamentos.atribuicao' THEN RAISE EXCEPTION 'auditoria fora do ar'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER falha_auditoria BEFORE INSERT ON "AuditLog"
        FOR EACH ROW EXECUTE FUNCTION pg_temp_falha_auditoria();`);
    try {
      const antes = await consulta(`SELECT count(*)::int AS n FROM treinamentos.atribuicao`);
      const r = await chamar(admin, "POST", "/atribuicoes", { versaoId, turmaId: turmaA });
      expect(r.statusCode).toBe(500);
      expect(await consulta(`SELECT count(*)::int AS n FROM treinamentos.atribuicao`)).toEqual(
        antes
      );
    } finally {
      await consulta(
        `DROP TRIGGER falha_auditoria ON "AuditLog"; DROP FUNCTION pg_temp_falha_auditoria();`
      );
    }
    // Sem a falha, a atribuição e a auditoria entram juntas.
    const ok = await chamar(admin, "POST", "/atribuicoes", { versaoId, turmaId: turmaA });
    expect(ok.statusCode).toBe(201);
    const auditada = await consulta(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE entity = 'treinamentos.atribuicao' AND "entityId" = $1`,
      [ok.json().data.id]
    );
    expect(auditada[0].n).toBe(1);
  });

  it("limite de tentativas por dia, quando configurado", async () => {
    const limitado = await buildApp({ treinamentos: { config: { limiteTentativasDia: 1 } } });
    try {
      const novo = await participante(turmaA);
      const primeira = await chamar(
        novo,
        "POST",
        `/atribuicoes/${atribuicaoA}/tentativas`,
        undefined,
        limitado
      );
      expect(primeira.statusCode).toBe(200);
      const id = primeira.json().data.tentativa.id as string;
      for (const e of escolhas(false))
        await chamar(novo, "POST", `/tentativas/${id}/respostas`, e, limitado);
      await chamar(novo, "POST", `/tentativas/${id}/concluir`, undefined, limitado);
      const segunda = await chamar(
        novo,
        "POST",
        `/atribuicoes/${atribuicaoA}/tentativas`,
        undefined,
        limitado
      );
      expect(segunda.statusCode).toBe(429);
      expect(segunda.json().code).toBe("TREINO_LIMITE_DIARIO");
    } finally {
      await limitado.close();
    }
  });
});
