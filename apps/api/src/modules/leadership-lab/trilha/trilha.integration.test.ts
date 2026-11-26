// O teste do Lab por cenários (a trilha), de ponta a ponta: buildApp() real, JWT real e PostgreSQL
// descartável. Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Confere a escolha dos cenários pelo
// público, o gabarito que nunca sai, a retomada, a idempotência, o resultado calculado no servidor,
// a origem (participante x interno) e o que o banco recusa.
import { readdirSync, readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../../auth/token-service.js";
import { integrationEnabled } from "../db/test-database.js";
import { criarParticipante, criarUsuario, inserir } from "../db/test-fixtures.js";
import {
  type Banco,
  RelogioFalso,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { IaFalsa } from "../motor/ia-falsa.js";

type Papel = "COMUM" | "RH" | "ADMIN" | "DEV";
type Pessoa = { id: string; token: string; participanteId: string | null };
type Bruto = {
  id: string;
  publico: string;
  questions: { id: string; alternatives: { taken: boolean }[] }[];
  [chave: string]: unknown;
};

const LAB = "/api/v1/leadership-lab";
const TRE = "/api/v1/treinamentos";
const PASTA = new URL("../../../../../../docs/cenarios-lab/", import.meta.url);
const cenarios = readdirSync(PASTA)
  .filter((n) => n.endsWith(".json") && n !== "_indice.json")
  .sort()
  .map((n) => JSON.parse(readFileSync(new URL(n, PASTA), "utf8")) as Bruto);
const porId = new Map(cenarios.map((c) => [c.id, c]));
const PUBLICO = "supervisor-manutencao-adm";
const doPublico = cenarios.filter((c) => c.publico === PUBLICO);

describe.skipIf(!integrationEnabled)("o teste do Lab por cenários (a trilha)", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let legado: FastifyInstance;
  let relogio: RelogioFalso;
  let desligarPrisma: () => Promise<void>;
  const papeis = {} as Record<Papel, string>;
  let admin: Pessoa;
  let rh: Pessoa;

  const sql = (texto: string, params: unknown[] = []) =>
    banco.db.client.query(texto, params).then((r) => r.rows);
  const tokenDe = (id: string, role: Papel) =>
    createAccessToken({ id, email: `${id}@teste.local`, name: "Pessoa", role, scopes: [] });
  const chamar = (
    quem: Pessoa,
    metodo: "GET" | "POST",
    url: string,
    payload?: unknown,
    alvo: FastifyInstance = app
  ) =>
    alvo.inject({
      method: metodo,
      url,
      headers: { authorization: `Bearer ${quem.token}` },
      ...(payload === undefined ? {} : { payload: payload as object })
    });
  const lab = (quem: Pessoa, metodo: "GET" | "POST", caminho: string, payload?: unknown) =>
    chamar(quem, metodo, `${LAB}${caminho}`, payload);

  /** Cadastro da conta: cargo, nível de governança e área (o público sai daí). */
  async function comCadastro(userId: string, nivel: string, areaSlug: string) {
    await sql(
      `UPDATE "User" SET "cargo" = 'Cargo de teste', "nivelGovernanca" = $2::"NivelGovernanca",
              "areaId" = (SELECT id FROM "Area" WHERE slug = $3) WHERE id = $1`,
      [userId, nivel, areaSlug]
    );
  }
  async function aceitarTermo(participanteId: string) {
    await sql(
      `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2026-1')`,
      [participanteId]
    );
  }
  /** Uma pessoa com vínculo no Lab, termo aceito e cadastro (padrão: supervisor de manutenção). */
  async function pessoa(
    role: Papel,
    cadastro: { nivel: string; area: string } | null = { nivel: "supervisor", area: "manutencao" },
    termo = true
  ): Promise<Pessoa> {
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { roleId: papeis[role] }
    });
    if (cadastro) await comCadastro(ctx.userId, cadastro.nivel, cadastro.area);
    if (termo) await aceitarTermo(ctx.participanteId);
    return { id: ctx.userId, token: tokenDe(ctx.userId, role), participanteId: ctx.participanteId };
  }
  async function semVinculo(role: Papel): Promise<Pessoa> {
    const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[role] });
    return { id, token: tokenDe(id, role), participanteId: null };
  }

  /** As alternativas que cumprem (ou não) a decisão de cada pergunta do cenário. */
  const escolhas = (slug: string, cumpre: boolean) =>
    porId.get(slug)!.questions.map((q) => ({
      perguntaId: q.id,
      alternativa: q.alternatives.findIndex((a) => a.taken === cumpre)
    }));

  type Estado = {
    tipo: "cenario";
    trilha: { sessaoId: string; total: number; atual: number; publico: string; origem: string };
    cenario: { slug: string; scenePack: string; questions: { id: string }[] };
    tentativa: { id: string; respostas: { perguntaId: string }[] };
  };
  async function iniciar(quem: Pessoa, payload: unknown = {}): Promise<Estado> {
    const r = await lab(quem, "POST", "/teste", payload);
    expect(r.statusCode, r.body).toBe(200);
    return r.json().data as Estado;
  }
  /** Responde as 5 perguntas do cenário atual e conclui; devolve a resposta de concluir. */
  async function jogarCenario(quem: Pessoa, estado: Estado, cumpre = true) {
    for (const e of escolhas(estado.cenario.slug, cumpre)) {
      const r = await lab(quem, "POST", `/teste/${estado.tentativa.id}/respostas`, e);
      expect(r.statusCode, r.body).toBe(200);
      relogio.avancar(10_000);
    }
    const c = await lab(quem, "POST", `/teste/${estado.tentativa.id}/concluir`);
    expect(c.statusCode, c.body).toBe(200);
    return c.json().data as {
      ordem: number;
      desfecho: { outcomes: { nivel: string }[] };
      proximo: Estado | null;
      resultadoDaSessao: string | null;
    };
  }
  /** Joga a trilha inteira e devolve a sessão e os slugs jogados. */
  async function jogarTrilha(quem: Pessoa, payload: unknown = {}, cumpre = true) {
    let estado: Estado | null = await iniciar(quem, payload);
    const sessaoId = estado.trilha.sessaoId;
    const slugs: string[] = [];
    let resultadoDaSessao: string | null = null;
    while (estado) {
      slugs.push(estado.cenario.slug);
      const c = await jogarCenario(quem, estado, cumpre);
      estado = c.proximo;
      resultadoDaSessao = c.resultadoDaSessao;
    }
    return { sessaoId, slugs, resultadoDaSessao };
  }

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../../app.js");
    const { prisma } = await import("../../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    relogio = new RelogioFalso();
    const cfg = (extra = {}) =>
      configDeTeste({ modoDoTeste: "cenarios", cenariosPorTeste: 3, ...extra });
    app = await buildApp({
      lab: { ia: new IaFalsa(), config: cfg(), agora: relogio.agora },
      treinamentos: { config: { limiteTentativasDia: null } }
    });
    legado = await buildApp({
      lab: {
        ia: new IaFalsa(),
        config: configDeTeste({ modoDoTeste: "legado" }),
        agora: relogio.agora
      }
    });

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
    admin = await semVinculo("ADMIN");
    rh = await semVinculo("RH");

    // Os cenários: os 40 importados como rascunho; os 10 do público de supervisores e 3 do RH, aprovados.
    const imp = await chamar(admin, "POST", `${TRE}/cenarios/importar`, { cenarios });
    expect(imp.statusCode, imp.body).toBe(200);
    const lista = await chamar(admin, "GET", `${TRE}/cenarios`);
    const existentes = lista.json().data as {
      id: string;
      slug: string;
      versoes: { id: string }[];
    }[];
    const aprovar = [...doPublico, ...cenarios.filter((c) => c.publico === "rh").slice(0, 3)];
    for (const c of aprovar) {
      const e = existentes.find((x) => x.slug === c.id)!;
      const r = await chamar(admin, "POST", `${TRE}/cenarios/${e.id}/aprovar`, {
        versaoId: e.versoes[0]!.id
      });
      expect(r.statusCode, r.body).toBe(200);
    }
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await legado?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  // -------------------------------------------------------------------------
  // Quem pode iniciar e o público
  // -------------------------------------------------------------------------

  it("antes de iniciar, GET /teste/proxima só lê: diz o público da conta e quantos cenários terá", async () => {
    const ana = await pessoa("COMUM");
    const r = await lab(ana, "GET", "/teste/proxima");
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data).toMatchObject({
      tipo: "sem-teste",
      podeIniciar: true,
      motivo: null,
      publico: PUBLICO,
      total: 3,
      publicosEscolhiveis: []
    });
    expect(
      await sql(`SELECT count(*)::int AS n FROM leadership_lab.sessao WHERE participante_id = $1`, [
        ana.participanteId
      ])
    ).toEqual([{ n: 0 }]);
  });

  it("termo pendente e cadastro incompleto impedem o início (com o motivo)", async () => {
    const semTermo = await pessoa("COMUM", undefined, false);
    expect((await lab(semTermo, "GET", "/teste/proxima")).json().data).toMatchObject({
      podeIniciar: false,
      motivo: "termo-pendente"
    });
    expect((await lab(semTermo, "POST", "/teste", {})).json().code).toBe("LAB_TERMO_PENDENTE");

    const incompleta = await pessoa("COMUM", null);
    expect((await lab(incompleta, "GET", "/teste/proxima")).json().data).toMatchObject({
      podeIniciar: false,
      motivo: "cadastro-incompleto"
    });
    const r = await lab(incompleta, "POST", "/teste", {});
    expect(r.statusCode).toBe(409);
    expect(r.json().code).toBe("LAB_CADASTRO_INCOMPLETO");
  });

  it("quem não tem vínculo com colaborador é barrado (403), de qualquer perfil", async () => {
    for (const role of ["COMUM", "RH", "ADMIN", "DEV"] as const) {
      const quem = await semVinculo(role);
      for (const [metodo, caminho] of [
        ["GET", "/teste/proxima"],
        ["POST", "/teste"]
      ] as const) {
        const r = await lab(quem, metodo, caminho, metodo === "POST" ? {} : undefined);
        expect(r.statusCode, `${role} ${caminho}`).toBe(403);
        expect(r.json().code).toBe("LAB_SEM_VINCULO");
      }
    }
  });

  it("o COMUM não escolhe o público: o do cadastro é o do servidor (403 se tentar)", async () => {
    const ana = await pessoa("COMUM");
    const r = await lab(ana, "POST", "/teste", { publico: "rh" });
    expect(r.statusCode).toBe(403);
    expect(r.json().code).toBe("LAB_PUBLICO_DEFINIDO_PELO_SERVIDOR");
  });

  it("público sem nenhum cenário aprovado: 409 com o motivo, e nada é criado", async () => {
    const coord = await pessoa("COMUM", { nivel: "coordenador", area: "administrativo" });
    expect((await lab(coord, "GET", "/teste/proxima")).json().data).toMatchObject({
      podeIniciar: false,
      motivo: "sem-cenarios",
      publico: "coordenador-administrativo"
    });
    const r = await lab(coord, "POST", "/teste", {});
    expect(r.statusCode).toBe(409);
    expect(r.json().code).toBe("LAB_SEM_CENARIOS");
    expect(
      await sql(`SELECT count(*)::int AS n FROM leadership_lab.sessao WHERE participante_id = $1`, [
        coord.participanteId
      ])
    ).toEqual([{ n: 0 }]);
  });

  // -------------------------------------------------------------------------
  // A trilha e o gabarito
  // -------------------------------------------------------------------------

  it("inicia a trilha: 3 cenários aprovados do público, sessão por cenários com origem participante, e SEM gabarito", async () => {
    const ana = await pessoa("COMUM");
    const estado = await iniciar(ana);
    expect(estado.trilha).toMatchObject({
      total: 3,
      atual: 1,
      publico: PUBLICO,
      origem: "participante"
    });
    expect(estado.cenario.scenePack).toBe("escritorio-gestao");
    expect(doPublico.map((c) => c.id)).toContain(estado.cenario.slug);

    const linhas = await sql(
      `SELECT s.modo, s.origem, s.publico, s.status, c.ordem, c.status AS st
         FROM leadership_lab.sessao s JOIN leadership_lab.tentativa_cenario c ON c.sessao_id = s.id
        WHERE s.participante_id = $1 ORDER BY c.ordem`,
      [ana.participanteId]
    );
    expect(linhas).toEqual([
      {
        modo: "cenarios",
        origem: "participante",
        publico: PUBLICO,
        status: "em_andamento",
        ordem: 1,
        st: "em_andamento"
      },
      {
        modo: "cenarios",
        origem: "participante",
        publico: PUBLICO,
        status: "em_andamento",
        ordem: 2,
        st: "pendente"
      },
      {
        modo: "cenarios",
        origem: "participante",
        publico: PUBLICO,
        status: "em_andamento",
        ordem: 3,
        st: "pendente"
      }
    ]);
    const slugs = await sql(
      `SELECT c.conteudo->>'slug' AS slug FROM leadership_lab.tentativa_cenario t
         JOIN treinamentos.cenario_versao v ON v.id = t.cenario_versao_id
         JOIN treinamentos.cenario_versao c ON c.id = v.id
         JOIN leadership_lab.sessao s ON s.id = t.sessao_id WHERE s.participante_id = $1`,
      [ana.participanteId]
    );
    expect(new Set(slugs.map((l) => l.slug)).size).toBe(3);

    // Nada do gabarito, em nenhuma das respostas de leitura.
    const proxima = await lab(ana, "GET", "/teste/proxima");
    for (const corpo of [JSON.stringify(estado), proxima.body])
      for (const proibido of [
        '"taken"',
        '"beat"',
        '"tone"',
        '"procedure"',
        '"outcomes"',
        '"decision"',
        '"when"',
        '"levels"'
      ])
        expect(corpo, proibido).not.toContain(proibido);
  });

  it("iniciar de novo (ou dois cliques ao mesmo tempo) retoma a mesma trilha: uma só em andamento", async () => {
    const beto = await pessoa("COMUM");
    const [a, b] = await Promise.all([iniciar(beto), iniciar(beto)]);
    expect(a.trilha.sessaoId).toBe(b.trilha.sessaoId);
    expect((await iniciar(beto)).trilha.sessaoId).toBe(a.trilha.sessaoId);
    expect(
      (
        await sql(
          `SELECT count(*)::int AS n FROM leadership_lab.sessao WHERE participante_id = $1 AND status = 'em_andamento'`,
          [beto.participanteId]
        )
      )[0].n
    ).toBe(1);
    expect((await lab(beto, "GET", "/teste/proxima")).json().data.trilha.sessaoId).toBe(
      a.trilha.sessaoId
    );
  });

  it("responder: só a reação da escolhida; a mesma resposta é idempotente; outra alternativa é 409; recarregar retoma", async () => {
    const caio = await pessoa("COMUM");
    const estado = await iniciar(caio);
    const [primeira] = escolhas(estado.cenario.slug, true);
    const url = `/teste/${estado.tentativa.id}/respostas`;
    const r1 = await lab(caio, "POST", url, primeira);
    expect(r1.statusCode, r1.body).toBe(200);
    expect(Object.keys(r1.json().data).sort()).toEqual([
      "alternativa",
      "perguntaId",
      "reacao",
      "respondidas"
    ]);
    expect(r1.body).not.toContain('"taken"');
    const repetida = await lab(caio, "POST", url, primeira);
    expect(repetida.statusCode).toBe(200);
    expect(repetida.json().data).toEqual(r1.json().data);
    const outra = await lab(caio, "POST", url, {
      ...primeira,
      alternativa: (primeira!.alternativa + 1) % 4
    });
    expect(outra.statusCode).toBe(409);
    expect(outra.json().code).toBe("LAB_RESPOSTA_JA_DADA");
    expect(
      (await lab(caio, "POST", url, { perguntaId: "nao-existe", alternativa: 0 })).json().code
    ).toBe("LAB_ESCOLHA_INVALIDA");
    expect((await lab(caio, "POST", url, { perguntaId: "q1", alternativa: 9 })).statusCode).toBe(
      400
    );

    // Recarregar: a leitura traz a resposta já dada (com a reação) e continua na próxima pergunta.
    const retomada = (await lab(caio, "GET", "/teste/proxima")).json().data as Estado;
    expect(retomada.tentativa.respostas.map((x) => x.perguntaId)).toEqual([primeira!.perguntaId]);
    expect(retomada.tentativa.id).toBe(estado.tentativa.id);
  });

  it("concluir sem as 5 respostas é 409; a tentativa de outra pessoa é 404, igual a 'não existe'", async () => {
    const dani = await pessoa("COMUM");
    const intrusa = await pessoa("COMUM");
    const estado = await iniciar(dani);
    const incompleto = await lab(dani, "POST", `/teste/${estado.tentativa.id}/concluir`);
    expect(incompleto.statusCode).toBe(409);
    expect(incompleto.json().code).toBe("LAB_RESPOSTAS_INCOMPLETAS");

    const [e] = escolhas(estado.cenario.slug, true);
    const alheio = await lab(intrusa, "POST", `/teste/${estado.tentativa.id}/respostas`, e);
    const inexistente = await lab(intrusa, "POST", `/teste/${crypto.randomUUID()}/respostas`, e);
    expect(alheio.statusCode).toBe(404);
    expect(alheio.json()).toEqual(inexistente.json());
    expect((await lab(intrusa, "POST", `/teste/${estado.tentativa.id}/concluir`)).statusCode).toBe(
      404
    );
  });

  // -------------------------------------------------------------------------
  // O resultado
  // -------------------------------------------------------------------------

  it("a trilha completa: o resultado é calculado no servidor (tudo cumprido = 100%) e só o dono o lê", async () => {
    const eva = await pessoa("COMUM");
    const outra = await pessoa("COMUM");
    const { sessaoId, slugs, resultadoDaSessao } = await jogarTrilha(eva);
    expect(slugs).toHaveLength(3);
    expect(resultadoDaSessao).toBe(sessaoId);

    const r = await lab(eva, "GET", `/teste/${sessaoId}/resultado`);
    expect(r.statusCode, r.body).toBe(200);
    const res = r.json().data;
    expect(res).toMatchObject({
      modo: "cenarios",
      sessaoId,
      origem: "participante",
      publico: PUBLICO,
      aderenciaGeral: 100,
      statusValidacao: "aguardando_validacao",
      experimental: true
    });
    // Em cada cenário a 1ª resposta vem na hora (0 s) e as outras 4 após 10 s: 8 s em média = 1 - 8/60.
    expect(res.agilidade).toBeCloseTo(86.67, 1);
    expect(res.cenarios).toHaveLength(3);
    for (const c of res.cenarios) {
      expect(c.decisoes.every((d: { cumpriu: boolean }) => d.cumpriu)).toBe(true);
      expect(c.respostas).toHaveLength(5);
      expect(c.desfecho.outcomes.map((o: { nivel: string }) => o.nivel)).toEqual(
        c.desfecho.outcomes.map(() => "ok")
      );
    }

    // O mesmo resultado pelo caminho antigo, e nenhum acesso do colega.
    const antigo = await lab(eva, "GET", `/sessoes/${sessaoId}/resultado`);
    expect(antigo.json().data.modo).toBe("cenarios");
    for (const caminho of [`/teste/${sessaoId}/resultado`, `/sessoes/${sessaoId}/resultado`]) {
      const alheio = await lab(outra, "GET", caminho);
      expect(alheio.statusCode, caminho).toBe(404);
    }

    // Em linhas do banco: uma sessão concluída com um resultado só, e 15 respostas gravadas.
    expect(
      await sql(
        `SELECT s.status, count(DISTINCT r.id)::int AS resultados FROM leadership_lab.sessao s LEFT JOIN leadership_lab.resultado r ON r.sessao_id = s.id WHERE s.id = $1 GROUP BY s.status`,
        [sessaoId]
      )
    ).toEqual([{ status: "concluida", resultados: 1 }]);
    expect(
      (
        await sql(
          `SELECT count(*)::int AS n FROM leadership_lab.resposta_cenario x JOIN leadership_lab.tentativa_cenario t ON t.id = x.tentativa_cenario_id WHERE t.sessao_id = $1`,
          [sessaoId]
        )
      )[0].n
    ).toBe(15);
  });

  it("nenhuma decisão cumprida = aderência 0 e as saídas ruins; concluir de novo devolve o mesmo (idempotente)", async () => {
    const fabio = await pessoa("COMUM");
    let estado: Estado | null = await iniciar(fabio);
    const sessaoId = estado.trilha.sessaoId;
    const primeiro = estado.tentativa.id;
    let ultimo!: Awaited<ReturnType<typeof jogarCenario>>;
    while (estado) {
      ultimo = await jogarCenario(fabio, estado, false);
      estado = ultimo.proximo;
    }
    const res = (await lab(fabio, "GET", `/teste/${sessaoId}/resultado`)).json().data;
    expect(res.aderenciaGeral).toBe(0);
    expect(
      res.cenarios[0].desfecho.outcomes.every((o: { nivel: string }) => o.nivel === "bad")
    ).toBe(true);
    const de_novo = await lab(fabio, "POST", `/teste/${primeiro}/concluir`);
    expect(de_novo.statusCode).toBe(200);
    expect(de_novo.json().data.desfecho).toEqual(res.cenarios[0].desfecho);
    expect(
      (
        await sql(`SELECT count(*)::int AS n FROM leadership_lab.resultado WHERE sessao_id = $1`, [
          sessaoId
        ])
      )[0].n
    ).toBe(1);
  });

  it("não repete cenário enquanto houver inédito; só depois do ciclo recomeça pelos mais antigos", async () => {
    const gil = await pessoa("COMUM");
    const t1 = await jogarTrilha(gil);
    const t2 = await jogarTrilha(gil);
    const t3 = await jogarTrilha(gil);
    const nove = [...t1.slugs, ...t2.slugs, ...t3.slugs];
    expect(new Set(nove).size).toBe(9); // nenhum repetido nas três primeiras
    const t4 = await jogarTrilha(gil);
    const faltante = doPublico.map((c) => c.id).find((id) => !nove.includes(id))!;
    expect(t4.slugs).toContain(faltante); // o único inédito entra
    expect(new Set(t4.slugs).size).toBe(3); // e ninguém se repete na mesma trilha
    // Os outros dois vêm do começo do ciclo (os mais antigos).
    const outros = t4.slugs.filter((s) => s !== faltante);
    for (const s of outros) expect(t1.slugs).toContain(s);
  });

  // -------------------------------------------------------------------------
  // Origem: participante x interno
  // -------------------------------------------------------------------------

  it("DEV, ADMIN e RH com vínculo fazem o teste com origem 'interno' e podem escolher o público", async () => {
    for (const role of ["DEV", "ADMIN", "RH"] as const) {
      const quem = await pessoa(role, null); // sem cadastro: precisa escolher
      const antes = (await lab(quem, "GET", "/teste/proxima")).json().data;
      expect(antes, role).toMatchObject({ tipo: "sem-teste", podeIniciar: true });
      expect(antes.publicosEscolhiveis).toHaveLength(4);
      const sem = await lab(quem, "POST", "/teste", {});
      expect(sem.json().code, role).toBe("LAB_CADASTRO_INCOMPLETO");
      const estado = await iniciar(quem, { publico: "rh" });
      expect(estado.trilha, role).toMatchObject({ origem: "interno", publico: "rh", total: 3 });
      expect(
        (
          await sql(`SELECT origem FROM leadership_lab.sessao WHERE id = $1`, [
            estado.trilha.sessaoId
          ])
        )[0].origem
      ).toBe("interno");
    }
  });

  it("resultado interno: o dono, o RH, o ADMIN e o DEV leem; nenhum COMUM lê; e ele não entra na revisão do curador", async () => {
    const turmaId = await inserir(banco.db.client, "leadership_lab.turma", {
      nome: "Turma",
      curador_id: rh.id
    });
    const testador = await pessoa("ADMIN");
    await sql(
      `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
      [turmaId, testador.participanteId]
    );
    const aluna = await pessoa("COMUM");
    await sql(
      `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
      [turmaId, aluna.participanteId]
    );
    const dele = await jogarTrilha(testador);
    const dela = await jogarTrilha(aluna);

    const leitores = { dono: testador, rh, admin, comumAlheio: aluna };
    expect((await lab(leitores.dono, "GET", `/teste/${dele.sessaoId}/resultado`)).statusCode).toBe(
      200
    );
    expect((await lab(leitores.rh, "GET", `/teste/${dele.sessaoId}/resultado`)).statusCode).toBe(
      200
    );
    expect((await lab(leitores.admin, "GET", `/teste/${dele.sessaoId}/resultado`)).statusCode).toBe(
      200
    );
    expect(
      (await lab(leitores.comumAlheio, "GET", `/teste/${dele.sessaoId}/resultado`)).statusCode
    ).toBe(404);

    // O curador da turma vê o resultado de PARTICIPANTE (a aluna), e a revisão lista só ele.
    expect((await lab(rh, "GET", `/teste/${dela.sessaoId}/resultado`)).statusCode).toBe(200);
    const revisao = await lab(rh, "GET", "/revisao?status=todos");
    expect(revisao.statusCode, revisao.body).toBe(200);
    const sessoes = (revisao.json().data as { sessaoId?: string }[]).map((i) => i.sessaoId);
    expect(sessoes).toContain(dela.sessaoId);
    expect(sessoes).not.toContain(dele.sessaoId);
    // E o resultado interno também não pode ser validado pelo curador (para ele, não existe).
    const resultadoDele = (
      await sql(`SELECT id FROM leadership_lab.resultado WHERE sessao_id = $1`, [dele.sessaoId])
    )[0].id;
    expect((await lab(rh, "GET", `/revisao/${resultadoDele}`)).statusCode).toBe(404);
  });

  // -------------------------------------------------------------------------
  // O painel e o modo
  // -------------------------------------------------------------------------

  it("o painel informa o modo, continua a trilha (cenário atual de N) e conta as respostas do teste concluído", async () => {
    const hugo = await pessoa("COMUM");
    expect((await lab(hugo, "GET", "/painel")).json().data).toMatchObject({
      modoDoTeste: "cenarios",
      acao: { tipo: "iniciar" }
    });
    const estado = await iniciar(hugo);
    expect((await lab(hugo, "GET", "/painel")).json().data.acao).toMatchObject({
      tipo: "continuar",
      sessaoId: estado.trilha.sessaoId,
      situacaoAtual: 1,
      totalSituacoes: 3
    });
    const c = await jogarCenario(hugo, estado);
    expect((await lab(hugo, "GET", "/painel")).json().data.acao).toMatchObject({
      situacaoAtual: 2,
      totalSituacoes: 3
    });
    let atual = c.proximo;
    while (atual) atual = (await jogarCenario(hugo, atual)).proximo;
    const painel = (await lab(hugo, "GET", "/painel")).json().data;
    expect(painel.indicadores).toMatchObject({ testesFeitos: 1, aderenciaMedia: 100 });
    expect(painel.evolucao.pontos).toHaveLength(1);
    expect(painel.evolucao.pontos[0]).toMatchObject({ aderenciaGeral: 100, nSituacoes: 15 });
  });

  it("cadastro incompleto: o painel avisa o motivo em vez de oferecer o botão", async () => {
    const ines = await pessoa("COMUM", null);
    expect((await lab(ines, "GET", "/painel")).json().data.acao).toMatchObject({
      tipo: "indisponivel",
      motivo: "cadastro-incompleto"
    });
  });

  it("no modo cenarios o teste da IA não inicia; no legado a trilha não existe", async () => {
    const jan = await pessoa("COMUM");
    const antigo = await lab(jan, "POST", "/sessoes", {});
    expect(antigo.statusCode).toBe(409);
    expect(antigo.json().code).toBe("LAB_MODO_CENARIOS");
    for (const [metodo, caminho] of [
      ["GET", "/teste/proxima"],
      ["POST", "/teste"]
    ] as const) {
      const r = await chamar(
        jan,
        metodo,
        `${LAB}${caminho}`,
        metodo === "POST" ? {} : undefined,
        legado
      );
      expect(r.statusCode, caminho).toBe(409);
      expect(r.json().code).toBe("LAB_MODO_LEGADO");
    }
    expect(
      (await chamar(jan, "GET", `${LAB}/painel`, undefined, legado)).json().data.modoDoTeste
    ).toBe("legado");
  });

  // -------------------------------------------------------------------------
  // O que o banco garante
  // -------------------------------------------------------------------------

  it("o banco recusa resposta em cenário pendente ou concluído, e não deixa alterar nem apagar uma resposta", async () => {
    const kaue = await pessoa("COMUM");
    const estado = await iniciar(kaue);
    const pendente = (
      await sql(
        `SELECT id FROM leadership_lab.tentativa_cenario WHERE sessao_id = $1 AND status = 'pendente' ORDER BY ordem LIMIT 1`,
        [estado.trilha.sessaoId]
      )
    )[0].id;
    await expect(
      sql(
        `INSERT INTO leadership_lab.resposta_cenario (tentativa_cenario_id, pergunta_id, alternativa) VALUES ($1, 'q1', 0)`,
        [pendente]
      )
    ).rejects.toThrow(/nao esta em andamento/);

    const [e] = escolhas(estado.cenario.slug, true);
    await lab(kaue, "POST", `/teste/${estado.tentativa.id}/respostas`, e);
    await expect(
      sql(
        `UPDATE leadership_lab.resposta_cenario SET alternativa = 3 WHERE tentativa_cenario_id = $1`,
        [estado.tentativa.id]
      )
    ).rejects.toThrow(/nao pode ser alterada/);
    await expect(
      sql(`DELETE FROM leadership_lab.resposta_cenario WHERE tentativa_cenario_id = $1`, [
        estado.tentativa.id
      ])
    ).rejects.toThrow(/nao pode ser alterada/);
    // Dois cenários em andamento na mesma sessão: o índice único parcial recusa.
    await expect(
      sql(
        `UPDATE leadership_lab.tentativa_cenario SET status = 'em_andamento', iniciada_em = now() WHERE id = $1`,
        [pendente]
      )
    ).rejects.toThrow(/ux_tentativa_cenario_em_andamento_por_sessao/);
  });
});
