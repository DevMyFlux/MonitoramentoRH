// As rotas da simulação local de ponta a ponta: buildApp() real, JWT real, PostgreSQL real e a IA de
// demonstração ramificada. Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import type { FastifyInstance } from "fastify";
import {
  labClassificacaoSchema,
  labEstadoDoTesteSchema,
  labRespostaDoTesteSchema,
  labResultadoSchema,
  labTemasSimuladosSchema
} from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../../auth/token-service.js";
import { IaDemonstracao } from "../demonstracao/ia-demonstracao.js";
import { leitorDoPercurso } from "../demonstracao/leitor.js";
import { integrationEnabled } from "../db/test-database.js";
import { criarCargoComMolde, criarParticipante } from "../db/test-fixtures.js";
import {
  type Banco,
  RelogioFalso,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { idsDasCategorias } from "./catalogo.js";

const PREFIXO = "/api/v1/leadership-lab";

describe.skipIf(!integrationEnabled)("rotas da simulação local", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let relogio: RelogioFalso;
  let desligarPrisma: () => Promise<void>;

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../../app.js");
    const { prisma } = await import("../../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    relogio = new RelogioFalso();
    app = await buildApp({
      lab: {
        ia: new IaDemonstracao(leitorDoPercurso(prisma)),
        config: { ...configDeTeste(), demonstracao: true },
        agora: relogio.agora,
        temasDeSimulacao: idsDasCategorias
      }
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  async function participante() {
    const funcao = await criarCargoComMolde(banco.db.client, "supervisor");
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      colaborador: { functionId: funcao }
    });
    const token = createAccessToken({
      id: ctx.userId,
      email: `${ctx.userId}@teste.local`,
      name: "Pessoa",
      role: "COMUM",
      scopes: []
    });
    return { token };
  }

  const chamar = (token: string | null, metodo: "GET" | "POST", caminho: string, corpo?: unknown) =>
    app.inject({
      method: metodo,
      url: `${PREFIXO}${caminho}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(corpo !== undefined ? { payload: corpo as object } : {})
    });

  it("GET /simulador/temas lista os temas, só com dados de catálogo", async () => {
    const { token } = await participante();
    const r = await chamar(token, "GET", "/simulador/temas");
    expect(r.statusCode).toBe(200);
    const { temas } = labTemasSimuladosSchema.parse(r.json().data);
    expect(temas.length).toBeGreaterThanOrEqual(12);
    expect(Object.keys(temas[0] ?? {}).sort()).toEqual(["descricao", "exemplos", "id", "nome"]);
    expect(r.body).not.toMatch(/aderencia|justificativa|proximo|skills/i);
  });

  it("exige autenticação", async () => {
    expect((await chamar(null, "GET", "/simulador/temas")).statusCode).toBe(401);
    expect(
      (await chamar(null, "POST", "/simulador/classificar", { descricao: "ar" })).statusCode
    ).toBe(401);
  });

  it("POST /simulador/classificar acha o tema do exemplo, sugere ou devolve todos", async () => {
    const { token } = await participante();
    const achou = await chamar(token, "POST", "/simulador/classificar", {
      descricao: "Estou com problema para realizar a manutenção do ar-condicionado"
    });
    expect(achou.statusCode).toBe(200);
    const c = labClassificacaoSchema.parse(achou.json().data);
    expect(c).toMatchObject({ resultado: "encontrado", tema: { id: "climatizacao-ventilacao" } });

    const nada = await chamar(token, "POST", "/simulador/classificar", {
      descricao: "O café da copa acabou"
    });
    const semMatch = labClassificacaoSchema.parse(nada.json().data);
    expect(semMatch.resultado).toBe("sem-correspondencia");
    if (semMatch.resultado === "sem-correspondencia") {
      expect(semMatch.sugestoes.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("recusa descrição vazia, longa demais ou com campo extra", async () => {
    const { token } = await participante();
    for (const corpo of [
      { descricao: "" },
      { descricao: "a".repeat(501) },
      { descricao: "ar condicionado", extra: 1 },
      {}
    ]) {
      const r = await chamar(token, "POST", "/simulador/classificar", corpo);
      expect(r.statusCode, JSON.stringify(corpo).slice(0, 40)).toBe(400);
    }
  });

  it("o texto digitado não é gravado em lugar nenhum do banco", async () => {
    const { token } = await participante();
    const marca = "xyzzy-descricao-secreta-9981";
    await chamar(token, "POST", "/simulador/classificar", {
      descricao: `ar condicionado ${marca}`
    });
    const tabelas = await banco.db.client.query(
      `SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_schema IN ('public','leadership_lab') AND table_type = 'BASE TABLE'`
    );
    for (const t of tabelas.rows) {
      const r = await banco.db.client.query(
        `SELECT 1 FROM "${t.table_schema}"."${t.table_name}" x WHERE x::text LIKE $1 LIMIT 1`,
        [`%${marca}%`]
      );
      expect(r.rowCount, `${t.table_schema}.${t.table_name}`).toBe(0);
    }
  });

  it("uma partida pela API: cena com personagem a cada situação, resultado com a simulação, sem avaliação", async () => {
    const { token } = await participante();
    await chamar(token, "POST", "/termo");
    const abertura = await chamar(token, "POST", "/sessoes", {
      categoriaId: "climatizacao-ventilacao"
    });
    expect(abertura.statusCode, abertura.body).toBe(200);
    const primeira = labRespostaDoTesteSchema.parse(abertura.json().data);
    if (primeira.tipo !== "situacao") throw new Error("situação");
    expect(primeira.situacao.cena).toEqual({
      personagem: "responsavel-assistencial",
      temaNome: "Climatização e ventilação",
      titulo: "Ar-condicionado parado em setor crítico"
    });

    // ler o teste em andamento traz a mesma cena
    const atual = labEstadoDoTesteSchema.parse(
      (await chamar(token, "GET", "/sessoes/atual")).json().data
    );
    expect(atual.tipo === "situacao" && atual.situacao.cena?.personagem).toBe(
      "responsavel-assistencial"
    );

    let ultima = abertura;
    const personagens: string[] = [primeira.situacao.cena?.personagem ?? ""];
    for (const [i, escolha] of ["A", "B", "A", "A", "B"].entries()) {
      relogio.avancar(10_000);
      ultima = await chamar(token, "POST", `/sessoes/${primeira.sessaoId}/respostas`, {
        numero: i + 1,
        escolha
      });
      expect(ultima.statusCode, ultima.body).toBe(200);
      const d = labRespostaDoTesteSchema.parse(ultima.json().data);
      if (d.tipo === "situacao") personagens.push(d.situacao.cena?.personagem ?? "");
      if (d.tipo === "situacao") {
        // Durante o teste, nada da avaliação passa pela rede (o resultado, no fim, é outra história).
        expect(ultima.body).not.toMatch(
          /"aderencia"|"estilo"|"skills"|"alerta"|"linhaVermelha"|"proximo"|"justificativa"/
        );
      }
    }
    // n1, n2a, n3a, n4a e n5b: responsável, técnico, responsável, fornecedor e diretoria
    expect(personagens).toEqual([
      "responsavel-assistencial",
      "tecnico",
      "responsavel-assistencial",
      "fornecedor",
      "diretoria"
    ]);

    const final = labResultadoSchema.parse(ultima.json().data.resultado);
    expect(final.simulacao).toEqual({
      temaNome: "Climatização e ventilação",
      titulo: "Ar-condicionado parado em setor crítico"
    });
    const lido = labResultadoSchema.parse(
      (await chamar(token, "GET", `/sessoes/${primeira.sessaoId}/resultado`)).json().data
    );
    expect(lido.simulacao).toEqual(final.simulacao);
    expect(lido.situacoes).toHaveLength(5);
  });

  it("categoriaId inválido é recusado com LAB_TEMA_INVALIDO", async () => {
    const { token } = await participante();
    await chamar(token, "POST", "/termo");
    const r = await chamar(token, "POST", "/sessoes", { categoriaId: "nao-existe" });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ code: "LAB_TEMA_INVALIDO" });
  });

  it("sem tema, a demonstração geral continua e não traz cena", async () => {
    const { token } = await participante();
    await chamar(token, "POST", "/termo");
    const r = await chamar(token, "POST", "/sessoes");
    const d = labRespostaDoTesteSchema.parse(r.json().data);
    expect(d.tipo === "situacao" && d.situacao.cena).toBeNull();
  });
});
