// O acompanhamento unificado e as contestações com análise e deferimento, de ponta a ponta:
// buildApp() real, JWT real e PostgreSQL descartável. Exige LAB_TEST_DATABASE_URL.
// Confere quem vê o quê (RH só as turmas dele; ADMIN e DEV tudo; COMUM nada), que teste interno fica
// à parte, que a exportação respeita os mesmos filtros e que deferir uma contestação libera uma nova
// tentativa sem apagar o resultado original.
import { readdirSync, readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  labAcompanhamentoCenariosSchema,
  labAcompanhamentoPessoaDetalheSchema,
  labAcompanhamentoPessoasSchema,
  labAcompanhamentoResumoSchema
} from "@my-flux/shared";
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
type Pessoa = { id: string; token: string; participanteId: string | null; nome: string };
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
const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!integrationEnabled)("acompanhamento do Lab e contestações", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let relogio: RelogioFalso;
  let desligarPrisma: () => Promise<void>;
  const papeis = {} as Record<Papel, string>;
  let admin: Pessoa;
  let dev: Pessoa;
  let rh: Pessoa;
  let outroRh: Pessoa;
  let nomeSeq = 0;

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

  async function pessoa(role: Papel, vinculo = true): Promise<Pessoa> {
    const nome = `Pessoa ${role} ${++nomeSeq}`;
    if (!vinculo) {
      const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[role] });
      return { id, token: tokenDe(id, role), participanteId: null, nome };
    }
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      usuario: { roleId: papeis[role] },
      colaborador: { name: nome }
    });
    await sql(
      `UPDATE "User" SET "cargo" = 'Cargo de teste', "nivelGovernanca" = 'supervisor'::"NivelGovernanca",
              "areaId" = (SELECT id FROM "Area" WHERE slug = 'manutencao') WHERE id = $1`,
      [ctx.userId]
    );
    await sql(
      `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2026-1')`,
      [ctx.participanteId]
    );
    return {
      id: ctx.userId,
      token: tokenDe(ctx.userId, role),
      participanteId: ctx.participanteId,
      nome
    };
  }

  async function turmaDe(curador: Pessoa, membros: Pessoa[], nome = "Turma de teste") {
    const [t] = await sql(
      `INSERT INTO leadership_lab.turma (nome, curador_id) VALUES ($1, $2) RETURNING id`,
      [nome, curador.id]
    );
    for (const m of membros)
      await sql(
        `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
        [t.id, m.participanteId]
      );
    return t.id as string;
  }

  const escolhas = (slug: string, cumpre: boolean) =>
    porId.get(slug)!.questions.map((q) => ({
      perguntaId: q.id,
      alternativa: q.alternatives.findIndex((a) => a.taken === cumpre)
    }));
  type Estado = {
    trilha: { sessaoId: string };
    cenario: { slug: string };
    tentativa: { id: string };
  };
  /** Joga a trilha inteira e devolve a sessão e o id do resultado. */
  async function jogarTrilha(quem: Pessoa, cumpre = true) {
    const r = await lab(quem, "POST", "/teste", {});
    expect(r.statusCode, r.body).toBe(200);
    let estado: Estado | null = r.json().data as Estado;
    const sessaoId = estado.trilha.sessaoId;
    while (estado) {
      for (const e of escolhas(estado.cenario.slug, cumpre)) {
        const x = await lab(quem, "POST", `/teste/${estado.tentativa.id}/respostas`, e);
        expect(x.statusCode, x.body).toBe(200);
        relogio.avancar(10_000);
      }
      const c = await lab(quem, "POST", `/teste/${estado.tentativa.id}/concluir`);
      expect(c.statusCode, c.body).toBe(200);
      estado = c.json().data.proximo as Estado | null;
    }
    const [res] = await sql(`SELECT id FROM leadership_lab.resultado WHERE sessao_id = $1`, [
      sessaoId
    ]);
    return { sessaoId, resultadoId: res.id as string };
  }

  const acomp = (quem: Pessoa, caminho: string) => lab(quem, "GET", `/acompanhamento/${caminho}`);

  // Os personagens (montados uma vez):
  //  ana (turma do rh, cumpre tudo), bia (turma do rh, descumpre tudo), caio (turma do outroRh),
  //  tina (ADMIN que testa: sessão "interno").
  let ana: Pessoa;
  let bia: Pessoa;
  let caio: Pessoa;
  let tina: Pessoa;
  let turmaDoRh: string;
  let turmaDoOutro: string;

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../../app.js");
    const { prisma } = await import("../../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    relogio = new RelogioFalso();
    app = await buildApp({
      lab: {
        ia: new IaFalsa(),
        // Um teste por dia: é o que mostra que deferir a contestação libera uma nova tentativa.
        config: configDeTeste({ modoDoTeste: "cenarios", cenariosPorTeste: 3, limiteTestesDia: 1 }),
        agora: relogio.agora
      },
      treinamentos: { config: { limiteTentativasDia: null } }
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
    admin = await pessoa("ADMIN", false);
    dev = await pessoa("DEV", false);
    rh = await pessoa("RH", false);
    outroRh = await pessoa("RH", false);

    const imp = await chamar(admin, "POST", `${TRE}/cenarios/importar`, { cenarios });
    expect(imp.statusCode, imp.body).toBe(200);
    const lista = await chamar(admin, "GET", `${TRE}/cenarios`);
    const existentes = lista.json().data as {
      id: string;
      slug: string;
      versoes: { id: string }[];
    }[];
    for (const c of doPublico) {
      const e = existentes.find((x) => x.slug === c.id)!;
      const r = await chamar(admin, "POST", `${TRE}/cenarios/${e.id}/aprovar`, {
        versaoId: e.versoes[0]!.id
      });
      expect(r.statusCode, r.body).toBe(200);
    }

    ana = await pessoa("COMUM");
    bia = await pessoa("COMUM");
    caio = await pessoa("COMUM");
    tina = await pessoa("ADMIN");
    turmaDoRh = await turmaDe(rh, [ana, bia], "Turma do RH");
    turmaDoOutro = await turmaDe(outroRh, [caio], "Turma do outro RH");
    await jogarTrilha(ana, true);
    await jogarTrilha(bia, false);
    await jogarTrilha(caio, true);
    await jogarTrilha(tina, true);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  // -------------------------------------------------------------------------
  // Quem pode
  // -------------------------------------------------------------------------

  describe("quem pode", () => {
    it("sem login é 401; quem faz o teste (COMUM) é 403 em todas as visões", async () => {
      for (const caminho of [
        "resumo",
        "pessoas",
        "cenarios",
        "exportar",
        `pessoas/${INEXISTENTE}`
      ]) {
        const r = await app.inject({ method: "GET", url: `${LAB}/acompanhamento/${caminho}` });
        expect(r.statusCode, caminho).toBe(401);
        expect((await acomp(ana, caminho)).statusCode, caminho).toBe(403);
      }
    });

    it("RH, ADMIN e DEV entram", async () => {
      for (const quem of [rh, admin, dev]) {
        for (const caminho of ["resumo", "pessoas", "cenarios", "exportar"]) {
          expect((await acomp(quem, caminho)).statusCode, `${quem.nome} ${caminho}`).toBe(200);
        }
      }
    });

    it("rejeita filtro inválido (400)", async () => {
      for (const q of ["publico=nada", "turmaId=x", "de=ontem", "status=feito", "visao=x"]) {
        expect((await acomp(rh, `resumo?${q}`)).statusCode, q).toBe(400);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Visibilidade
  // -------------------------------------------------------------------------

  describe("visibilidade", () => {
    const nomes = async (quem: Pessoa, filtro = "") => {
      const r = await acomp(quem, `pessoas${filtro}`);
      expect(r.statusCode, r.body).toBe(200);
      return labAcompanhamentoPessoasSchema.parse(r.json().data).pessoas.map((p) => p.nome);
    };

    it("o RH vê só as pessoas das turmas ativas dele", async () => {
      expect((await nomes(rh)).sort()).toEqual([ana.nome, bia.nome].sort());
      expect(await nomes(outroRh)).toEqual([caio.nome]);
    });

    it("ADMIN e DEV veem todos os participantes; o teste interno (de ADMIN) não é participante", async () => {
      for (const quem of [admin, dev]) {
        const n = await nomes(quem);
        expect(n).toEqual(expect.arrayContaining([ana.nome, bia.nome, caio.nome]));
        expect(n).not.toContain(tina.nome);
      }
    });

    it("filtrar por uma turma que não é do RH não mostra ninguém (e não revela nada)", async () => {
      expect(await nomes(rh, `?turmaId=${turmaDoOutro}`)).toEqual([]);
      expect(await nomes(rh, `?turmaId=${turmaDoRh}`)).toHaveLength(2);
      expect(await nomes(admin, `?turmaId=${turmaDoOutro}`)).toEqual([caio.nome]);
    });

    it("turma desativada deixa de valer para o RH", async () => {
      const dele = await pessoa("COMUM");
      const t = await turmaDe(rh, [dele], "Turma que será encerrada");
      expect(await nomes(rh)).toContain(dele.nome);
      await sql(`UPDATE leadership_lab.turma SET ativa = false WHERE id = $1`, [t]);
      expect(await nomes(rh)).not.toContain(dele.nome);
    });

    it("a pessoa: o RH abre a da turma dele (200) e recebe 404 para a de fora, igual a 'não existe'", async () => {
      expect((await acomp(rh, `pessoas/${ana.participanteId}`)).statusCode).toBe(200);
      const fora = await acomp(rh, `pessoas/${caio.participanteId}`);
      const nada = await acomp(rh, `pessoas/${INEXISTENTE}`);
      expect(fora.statusCode).toBe(404);
      expect(nada.statusCode).toBe(404);
      expect(fora.json()).toEqual(nada.json());
      expect((await acomp(admin, `pessoas/${caio.participanteId}`)).statusCode).toBe(200);
      expect((await acomp(dev, `pessoas/${caio.participanteId}`)).statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Visão geral
  // -------------------------------------------------------------------------

  describe("visão geral", () => {
    const resumo = async (quem: Pessoa, filtro = "") => {
      const r = await acomp(quem, `resumo${filtro}`);
      expect(r.statusCode, r.body).toBe(200);
      return labAcompanhamentoResumoSchema.parse(r.json().data);
    };

    it("o RH: totais, funil e turma só das pessoas dele; interno fica de fora", async () => {
      const r = await resumo(rh);
      expect(r.totais).toMatchObject({ participantes: 2, iniciaram: 2, emAndamento: 0 });
      expect(r.totais.concluidas).toBe(2);
      // Ana cumpriu tudo (100) e Bia nada (0): a média está entre elas.
      expect(r.totais.aderenciaMedia).toBeGreaterThan(0);
      expect(r.totais.aderenciaMedia).toBeLessThan(100);
      expect(r.funil).toEqual({ cadastrados: 2, iniciaram: 2, concluiram: 2 });
      expect(r.porTurma).toEqual([
        expect.objectContaining({ turmaId: turmaDoRh, participantes: 2, concluiram: 2 })
      ]);
      expect(r.internos).toEqual({ sessoes: 0, concluidas: 0 });
      expect(r.opcoes.turmas.map((t) => t.id)).toEqual([turmaDoRh]);
    });

    it("ADMIN e DEV: o interno aparece à parte e não entra nas médias nem no funil", async () => {
      const r = await resumo(admin);
      expect(r.internos.sessoes).toBeGreaterThanOrEqual(1);
      expect(r.totais.participantes).toBeGreaterThanOrEqual(3);
      // Tina (ADMIN) testou: nem ela é "participante" nem conta nas métricas.
      const semFiltro = await resumo(dev);
      expect(semFiltro.totais.concluidas).toBe(r.totais.concluidas);
    });

    it("os filtros mudam o recorte: status, público, período e turma", async () => {
      expect((await resumo(rh, "?status=em_andamento")).totais.participantes).toBe(0);
      expect((await resumo(rh, `?publico=${PUBLICO}`)).totais.concluidas).toBe(2);
      expect((await resumo(rh, "?publico=rh")).totais.concluidas).toBe(0);
      expect((await resumo(rh, "?de=2099-01-01")).totais.participantes).toBe(0);
      expect((await resumo(rh, "?ate=2000-01-01")).totais.participantes).toBe(0);
      expect((await resumo(rh, "?nivel=diretoria")).totais.participantes).toBe(0);
      expect((await resumo(rh, "?nivel=supervisor")).totais.participantes).toBe(2);
      expect((await resumo(rh, `?turmaId=${turmaDoOutro}`)).totais.participantes).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Uma pessoa
  // -------------------------------------------------------------------------

  describe("a pessoa", () => {
    it("mostra a linha do tempo com os cenários, as 5 decisões, os desfechos e os tempos", async () => {
      const r = await acomp(rh, `pessoas/${ana.participanteId}`);
      const d = labAcompanhamentoPessoaDetalheSchema.parse(r.json().data);
      expect(d.pessoa).toMatchObject({ nome: ana.nome, nivel: "supervisor", sessoes: 1 });
      expect(d.sessoes).toHaveLength(1);
      const sessao = d.sessoes[0]!;
      expect(sessao).toMatchObject({
        origem: "participante",
        status: "concluida",
        publico: PUBLICO
      });
      expect(sessao.cenarios).toHaveLength(3);
      for (const c of sessao.cenarios) {
        expect(c.decisoes).toHaveLength(5);
        expect(c.decisoes.every((x) => x.cumpriu)).toBe(true);
        expect(c.respostas).toHaveLength(5);
        expect(c.respostas.every((x) => x.texto !== "")).toBe(true);
        expect(c.desfechos.length).toBeGreaterThan(0);
        expect(c.tempoTotalMs).toBeGreaterThan(0);
      }
      expect(sessao.aderenciaGeral).toBe(100);
    });

    it("compara com o grupo só entre participantes (o interno fica de fora)", async () => {
      const r = await acomp(rh, `pessoas/${ana.participanteId}`);
      const d = labAcompanhamentoPessoaDetalheSchema.parse(r.json().data);
      // O RH enxerga Ana e Bia: o grupo dele é a Bia (0%). Caio e Tina não entram.
      expect(d.comparacao).toMatchObject({
        publico: PUBLICO,
        pessoas: 2,
        aderenciaDaPessoa: 100,
        aderenciaDoGrupo: 0
      });
      // O ADMIN enxerga Caio também (100%): o grupo da Ana tem Bia (0) e Caio (100).
      const todos = labAcompanhamentoPessoaDetalheSchema.parse(
        (await acomp(admin, `pessoas/${ana.participanteId}`)).json().data
      );
      expect(todos.comparacao).toMatchObject({ pessoas: 3, aderenciaDoGrupo: 50 });
    });

    it("sem teste concluído, não há comparação", async () => {
      const nova = await pessoa("COMUM");
      await turmaDe(rh, [nova], "Turma da nova");
      const d = labAcompanhamentoPessoaDetalheSchema.parse(
        (await acomp(rh, `pessoas/${nova.participanteId}`)).json().data
      );
      expect(d).toMatchObject({ sessoes: [], comparacao: null });
    });
  });

  // -------------------------------------------------------------------------
  // Cenários
  // -------------------------------------------------------------------------

  describe("cenários", () => {
    it("mostra as decisões mais descumpridas e as alternativas mais escolhidas", async () => {
      const r = await acomp(rh, "cenarios");
      expect(r.statusCode, r.body).toBe(200);
      const { cenarios: lista } = labAcompanhamentoCenariosSchema.parse(r.json().data);
      expect(lista.length).toBeGreaterThan(0);
      for (const c of lista) {
        // Ana cumpriu, Bia não: metade das decisões foi descumprida em cada cenário feito por ambas.
        expect(c.decisoes).toHaveLength(5);
        const taxas = c.decisoes.map((d) => d.taxaDeDescumprimento);
        expect([...taxas].sort((a, b) => b - a)).toEqual(taxas);
        for (const p of c.perguntas) {
          const total = p.alternativas.reduce((s, a) => s + a.escolhas, 0);
          expect(total).toBe(c.vezes);
          expect(p.alternativas[0]!.escolhas).toBeGreaterThanOrEqual(
            p.alternativas.at(-1)!.escolhas
          );
        }
      }
      expect(lista.some((c) => c.decisoes.some((d) => d.descumpridas > 0))).toBe(true);
    });

    it("o RH não vê as respostas de quem é de fora da turma dele", async () => {
      const dele = labAcompanhamentoCenariosSchema.parse((await acomp(rh, "cenarios")).json().data);
      const todos = labAcompanhamentoCenariosSchema.parse(
        (await acomp(admin, "cenarios")).json().data
      );
      const soma = (l: typeof dele) => l.cenarios.reduce((s, c) => s + c.vezes, 0);
      expect(soma(todos)).toBeGreaterThan(soma(dele));
      // Interno nunca entra: 3 cenários por teste de participante.
      expect(soma(dele) % 3).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Exportação
  // -------------------------------------------------------------------------

  describe("exportação CSV", () => {
    it("usa os mesmos filtros e a mesma visibilidade: o RH não exporta quem não vê", async () => {
      const r = await acomp(rh, "exportar");
      expect(r.statusCode).toBe(200);
      expect(r.headers["content-type"]).toContain("text/csv");
      expect(r.headers["content-disposition"]).toContain("acompanhamento-lab-sessoes-");
      expect(r.body.charCodeAt(0)).toBe(0xfeff);
      const linhas = r.body.trim().split("\r\n");
      expect(linhas[0]).toContain("Nome;Identificador");
      expect(r.body).toContain(ana.nome);
      expect(r.body).toContain(bia.nome);
      expect(r.body).not.toContain(caio.nome);
      expect(r.body).not.toContain(tina.nome);
      // Uma linha por sessão de participante da turma.
      const tela = labAcompanhamentoPessoasSchema.parse((await acomp(rh, "pessoas")).json().data);
      expect(linhas.length - 1).toBe(tela.pessoas.reduce((s, p) => s + p.sessoes, 0));
    });

    it("o filtro vale também na exportação", async () => {
      const r = await acomp(rh, "exportar?publico=rh");
      expect(r.body.trim().split("\r\n")).toHaveLength(1);
      const admi = await acomp(admin, `exportar?turmaId=${turmaDoOutro}`);
      expect(admi.body).toContain(caio.nome);
      expect(admi.body).not.toContain(ana.nome);
    });

    it("a visão de cenários traz uma linha por decisão", async () => {
      const r = await acomp(rh, "exportar?visao=cenarios");
      expect(r.statusCode).toBe(200);
      const linhas = r.body.trim().split("\r\n");
      expect(linhas[0]).toContain("Cenário;Versão");
      expect(linhas.length).toBeGreaterThan(5);
      expect(r.headers["content-disposition"]).toContain("-cenarios-");
    });
  });

  // -------------------------------------------------------------------------
  // Contestações
  // -------------------------------------------------------------------------

  describe("contestações: análise, decisão e nova tentativa", () => {
    const contestar = (quem: Pessoa, resultadoId: string) =>
      lab(quem, "POST", `/resultados/${resultadoId}/contestacoes`, {
        ponto: "Cenário 2",
        motivo: "O cliente já tinha sido avisado antes."
      });
    const decidir = (quem: Pessoa, id: string, corpo: unknown) =>
      lab(quem, "POST", `/contestacoes/${id}/decisao`, corpo);
    const analisar = (quem: Pessoa, id: string) => lab(quem, "POST", `/contestacoes/${id}/analise`);
    const estado = async (id: string) =>
      (
        await sql(`SELECT status, nota_decisao FROM leadership_lab.contestacao WHERE id = $1`, [id])
      )[0];

    it("aberta -> em análise -> deferida: exige justificativa, registra e libera nova tentativa sem apagar o original", async () => {
      const dele = await pessoa("COMUM");
      await turmaDe(rh, [dele], "Turma da contestação");
      const teste = await jogarTrilha(dele, true);
      // O limite do dia está cumprido: não pode iniciar outro.
      const antes = await lab(dele, "GET", "/teste/proxima");
      expect(antes.json().data).toMatchObject({ podeIniciar: false, motivo: "limite-diario" });

      const criada = await contestar(dele, teste.resultadoId);
      expect(criada.statusCode, criada.body).toBe(200);
      const id = criada.json().data.id as string;

      // Em análise: só o RH (ou ADMIN/DEV) passa; o dono vê o novo estado.
      expect((await analisar(dele, id)).statusCode).toBe(403);
      expect((await analisar(outroRh, id)).statusCode).toBe(404);
      const em = await analisar(rh, id);
      expect(em.statusCode, em.body).toBe(200);
      expect(em.json().data.status).toBe("em_analise");
      expect((await analisar(rh, id)).statusCode).toBe(409);
      const vista = await lab(dele, "GET", `/resultados/${teste.resultadoId}/contestacoes`);
      expect(vista.json().data[0]).toMatchObject({ status: "em_analise", nota: null });

      // Decidir exige a justificativa.
      for (const corpo of [{ decisao: "aceita" }, { decisao: "aceita", nota: "  " }]) {
        expect((await decidir(rh, id, corpo)).statusCode).toBe(400);
      }
      expect((await estado(id))!.status).toBe("em_analise");
      expect((await decidir(dele, id, { decisao: "aceita", nota: "x" })).statusCode).toBe(403);

      const [resultadoAntes] = await sql(
        `SELECT aderencia_geral, agilidade, resumo, contestacao_deferida_em FROM leadership_lab.resultado WHERE id = $1`,
        [teste.resultadoId]
      );
      expect(resultadoAntes.contestacao_deferida_em).toBeNull();

      const d = await decidir(rh, id, {
        decisao: "aceita",
        nota: "Procede: o aviso consta no registro."
      });
      expect(d.statusCode, d.body).toBe(200);
      expect(d.json().data).toMatchObject({
        status: "aceita",
        nota: "Procede: o aviso consta no registro."
      });
      expect((await decidir(rh, id, { decisao: "rejeitada", nota: "x" })).statusCode).toBe(409);

      // O resultado original continua igual; só fica marcado.
      const [resultadoDepois] = await sql(
        `SELECT aderencia_geral, agilidade, resumo, contestacao_deferida_em FROM leadership_lab.resultado WHERE id = $1`,
        [teste.resultadoId]
      );
      expect(resultadoDepois.contestacao_deferida_em).not.toBeNull();
      expect({
        aderencia_geral: resultadoDepois.aderencia_geral,
        agilidade: resultadoDepois.agilidade,
        resumo: resultadoDepois.resumo
      }).toEqual({
        aderencia_geral: resultadoAntes.aderencia_geral,
        agilidade: resultadoAntes.agilidade,
        resumo: resultadoAntes.resumo
      });

      // E a pessoa pode refazer o teste agora.
      const depois = await lab(dele, "GET", "/teste/proxima");
      expect(depois.json().data).toMatchObject({ podeIniciar: true, motivo: null });
      const novo = await lab(dele, "POST", "/teste", {});
      expect(novo.statusCode, novo.body).toBe(200);
      expect(novo.json().data.trilha.sessaoId).not.toBe(teste.sessaoId);

      // A trilha de auditoria guarda a análise e a decisão (sem o texto da justificativa).
      const trilha = await sql(
        `SELECT action, after FROM "AuditLog" WHERE entity = 'LabContestacao' AND "entityId" = $1 ORDER BY "createdAt", id`,
        [id]
      );
      expect(trilha.map((t) => t.action)).toEqual(["CREATE", "UPDATE", "APPROVE"]);
      expect(trilha[2]!.after).toMatchObject({ status: "aceita", liberaNovaTentativa: true });
    });

    it("o teste anulado continua à vista, marcado, e sai das médias", async () => {
      const antes = labAcompanhamentoResumoSchema.parse((await acomp(admin, "resumo")).json().data);
      const dele = await pessoa("COMUM");
      await turmaDe(rh, [dele], "Turma da anulação");
      const teste = await jogarTrilha(dele, false);
      const cheio = labAcompanhamentoResumoSchema.parse((await acomp(admin, "resumo")).json().data);
      expect(cheio.totais.concluidas).toBe(antes.totais.concluidas + 1);

      const id = (await contestar(dele, teste.resultadoId)).json().data.id as string;
      await decidir(admin, id, { decisao: "aceita", nota: "Deferida pelo administrador." });
      const depois = labAcompanhamentoResumoSchema.parse(
        (await acomp(admin, "resumo")).json().data
      );
      expect(depois.totais.concluidas).toBe(antes.totais.concluidas);

      const d = labAcompanhamentoPessoaDetalheSchema.parse(
        (await acomp(rh, `pessoas/${dele.participanteId}`)).json().data
      );
      expect(d.sessoes[0]).toMatchObject({ contestadoDeferido: true, aderenciaGeral: 0 });
      expect(d.contestacoes[0]).toMatchObject({ status: "aceita" });
    });

    it("indeferida não libera nova tentativa; DEV também decide", async () => {
      const dele = await pessoa("COMUM");
      await turmaDe(rh, [dele], "Turma do indeferimento");
      const teste = await jogarTrilha(dele, true);
      const id = (await contestar(dele, teste.resultadoId)).json().data.id as string;
      const d = await decidir(dev, id, { decisao: "rejeitada", nota: "O registro não confirma." });
      expect(d.statusCode, d.body).toBe(200);
      expect(d.json().data.status).toBe("rejeitada");
      const [r] = await sql(
        `SELECT contestacao_deferida_em FROM leadership_lab.resultado WHERE id = $1`,
        [teste.resultadoId]
      );
      expect(r.contestacao_deferida_em).toBeNull();
      expect((await lab(dele, "GET", "/teste/proxima")).json().data).toMatchObject({
        podeIniciar: false,
        motivo: "limite-diario"
      });
    });

    it("ninguém decide a contestação do próprio resultado", async () => {
      // Tina (ADMIN) tem teste interno; um DEV com vínculo não decide a contestação do próprio.
      const eu = await pessoa("DEV");
      const teste = await jogarTrilha(eu, true);
      await sql(
        `INSERT INTO leadership_lab.contestacao (resultado_id, ponto, motivo) VALUES ($1, 'x', 'y')`,
        [teste.resultadoId]
      );
      const [c] = await sql(`SELECT id FROM leadership_lab.contestacao WHERE resultado_id = $1`, [
        teste.resultadoId
      ]);
      const r = await decidir(eu, c.id, { decisao: "aceita", nota: "Eu mesmo." });
      expect(r.statusCode).toBe(404);
      expect((await estado(c.id))!.status).toBe("pendente");
    });

    it("o banco recusa decidir sem justificativa e estado fora da lista", async () => {
      const [c] = await sql(`SELECT id FROM leadership_lab.contestacao LIMIT 1`);
      await expect(
        sql(
          `UPDATE leadership_lab.contestacao SET status = 'aceita', decidido_por = $2, decidido_em = now(), nota_decisao = '  ' WHERE id = $1`,
          [c.id, rh.id]
        )
      ).rejects.toMatchObject({ constraint: "ck_contestacao_justificativa" });
      await expect(
        sql(
          `UPDATE leadership_lab.contestacao SET status = 'deferida', decidido_por = $2, decidido_em = now(), nota_decisao = 'ok' WHERE id = $1`,
          [c.id, rh.id]
        )
      ).rejects.toMatchObject({ constraint: "ck_contestacao_status" });
    });
  });
});
