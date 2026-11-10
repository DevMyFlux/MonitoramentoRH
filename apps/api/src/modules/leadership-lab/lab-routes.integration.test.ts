// Rotas HTTP do Leadership Lab, de ponta a ponta: buildApp() real, JWT real, PostgreSQL real e a
// IA falsa. Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Veja db/test-database.ts.
import type { FastifyInstance } from "fastify";
import {
  labAceiteDoTermoSchema,
  labEstadoDoTesteSchema,
  labPainelSchema,
  labRespostaDoTesteSchema,
  labResultadoSchema,
  labTermoSchema
} from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../auth/token-service.js";
import { integrationEnabled } from "./db/test-database.js";
import {
  criarCargoComMolde,
  criarParticipante,
  criarUsuario,
  inserir
} from "./db/test-fixtures.js";
import {
  type Banco,
  RelogioFalso,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "./motor/cenario-de-teste.js";
import { ClienteIaHttp } from "./motor/cliente-ia-http.js";
import { CANARIO_JUSTIFICATIVA, IaFalsa, roteiroPadrao } from "./motor/ia-falsa.js";
import { type ServicoIaFalso, subirServicoIaFalso } from "./motor/servico-ia-falso.js";

type Papel = "COMUM" | "RH" | "ADMIN" | "DEV";
type Usuario = { id: string; token: string; participanteId: string | null };

const PREFIXO = "/api/v1/leadership-lab";

describe.skipIf(!integrationEnabled)("rotas do Leadership Lab", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let ia: IaFalsa;
  let relogio: RelogioFalso;
  let desligarPrisma: () => Promise<void>;
  let papeis: Record<Papel, string>;
  let servico: ServicoIaFalso | undefined;
  let appHttp: FastifyInstance | undefined;

  beforeAll(async () => {
    banco = await prepararBanco();
    // A conexão do app (lib/prisma) é criada na primeira importação, lendo DATABASE_URL.
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../app.js");
    const { prisma } = await import("../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();

    ia = new IaFalsa();
    relogio = new RelogioFalso();
    app = await buildApp({ lab: { ia, config: configDeTeste(), agora: relogio.agora } });

    // O fixture cria o perfil COMUM; os demais perfis entram aqui.
    papeis = { COMUM: banco.base.roleId } as Record<Papel, string>;
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
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await appHttp?.close();
    await servico?.fechar();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  // -------------------------------------------------------------------------
  // Apoio
  // -------------------------------------------------------------------------

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  function tokenDe(id: string, papel: Papel): string {
    return createAccessToken({
      id,
      email: `${id}@teste.local`,
      name: "Pessoa",
      role: papel,
      scopes: []
    });
  }

  /** Um participante (perfil COMUM) vinculado a um colaborador de cargo de supervisor. */
  async function participante(): Promise<Usuario> {
    const funcao = await criarCargoComMolde(banco.db.client, "supervisor");
    const ctx = await criarParticipante(banco.db.client, banco.base, {
      colaborador: { functionId: funcao }
    });
    return {
      id: ctx.userId,
      token: tokenDe(ctx.userId, "COMUM"),
      participanteId: ctx.participanteId
    };
  }

  /** Um usuário de qualquer perfil, sem vínculo com colaborador. */
  async function semVinculo(papel: Papel): Promise<Usuario> {
    const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[papel] });
    return { id, token: tokenDe(id, papel), participanteId: null };
  }

  function chamar(
    servidor: FastifyInstance,
    token: string | null,
    metodo: "GET" | "POST",
    caminho: string,
    corpo?: unknown
  ) {
    return servidor.inject({
      method: metodo,
      url: `${PREFIXO}${caminho}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(corpo !== undefined ? { payload: corpo as object } : {})
    });
  }
  const http = (token: string | null, metodo: "GET" | "POST", caminho: string, corpo?: unknown) =>
    chamar(app, token, metodo, caminho, corpo);

  /** Aceita o termo e inicia; devolve o corpo (data) da abertura. */
  async function iniciar(u: Usuario) {
    await http(u.token, "POST", "/termo");
    const r = await http(u.token, "POST", "/sessoes");
    expect(r.statusCode, r.body).toBe(200);
    return r.json().data as { sessaoId: string; situacao: { numero: number } };
  }

  const aguardar = (ms: number) => relogio.avancar(ms);

  // -------------------------------------------------------------------------
  describe("autenticação", () => {
    const rotas: Array<["GET" | "POST", string]> = [
      ["GET", "/painel"],
      ["GET", "/termo"],
      ["POST", "/termo"],
      ["GET", "/moldes"],
      ["POST", "/sessoes"],
      ["GET", "/sessoes/atual"],
      ["POST", `/sessoes/${crypto.randomUUID()}/respostas`],
      ["POST", `/sessoes/${crypto.randomUUID()}/tempo-esgotado`],
      ["GET", `/sessoes/${crypto.randomUUID()}/resultado`]
    ];

    it.each(rotas)("%s %s exige autenticação", async (metodo, caminho) => {
      const semToken = await http(null, metodo, caminho);
      expect(semToken.statusCode).toBe(401);
      expect(semToken.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });

      const lixo = await http("isto.nao.e.um.token", metodo, caminho);
      expect(lixo.statusCode).toBe(401);

      // Token bem assinado de um usuário que não existe.
      const fantasma = await http(tokenDe(crypto.randomUUID(), "COMUM"), metodo, caminho);
      expect(fantasma.statusCode).toBe(401);
      expect(fantasma.json()).toMatchObject({ code: "INVALID_ACCESS_TOKEN" });
    });

    it("nenhuma resposta do Lab, nem de erro, fica em cache; os cabeçalhos de segurança continuam", async () => {
      const u = await participante();
      for (const r of [
        await http(null, "GET", "/termo"),
        await http(u.token, "GET", "/termo"),
        await http(u.token, "GET", "/moldes"),
        await http(u.token, "POST", "/sessoes") // erro: sem o termo
      ]) {
        expect(r.headers["cache-control"]).toBe("no-store");
        expect(r.headers["x-content-type-options"]).toBe("nosniff");
        expect(r.headers["content-type"]).toMatch(/application\/json/);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("uma partida pela API", () => {
    it("termo, moldes, sessão, cinco respostas e resultado, no formato { data }", async () => {
      const u = await participante();

      // Termo
      const antes = await http(u.token, "GET", "/termo");
      expect(antes.statusCode).toBe(200);
      expect(antes.json()).toEqual({
        data: { versaoAtual: "2026-1", aceito: false, aceitoEm: null }
      });

      const semTermo = await http(u.token, "POST", "/sessoes");
      expect(semTermo.statusCode).toBe(403);
      expect(semTermo.json()).toMatchObject({ code: "LAB_TERMO_PENDENTE" });

      const aceite = await http(u.token, "POST", "/termo");
      expect(aceite.statusCode).toBe(200);
      expect(aceite.json().data).toMatchObject({ versaoTermo: "2026-1" });
      expect(new Date(aceite.json().data.aceitoEm).getTime()).not.toBeNaN();
      expect((await http(u.token, "GET", "/termo")).json().data).toMatchObject({ aceito: true });

      // Moldes
      const moldes = (await http(u.token, "GET", "/moldes")).json().data;
      expect(moldes.moldes.map((m: { nivel: string }) => m.nivel)).toEqual([
        "encarregado",
        "supervisor",
        "coordenador"
      ]);
      expect(moldes.moldes.find((m: { doMeuCargo: boolean }) => m.doMeuCargo)).toMatchObject({
        nivel: "supervisor",
        disponivel: true,
        tempoLimiteS: 60
      });

      // Sessão e respostas
      const abertura = await http(u.token, "POST", "/sessoes");
      expect(abertura.statusCode).toBe(200);
      const { sessaoId } = abertura.json().data;
      expect(abertura.json().data).toMatchObject({ tipo: "situacao", totalSituacoes: 5 });

      let ultima = abertura;
      for (const [i, escolha] of ["A", "B", "C", "B", "A"].entries()) {
        aguardar(10_000);
        ultima = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: i + 1,
          escolha
        });
        expect(ultima.statusCode, ultima.body).toBe(200);
        expect(ultima.json().data.tipo).toBe(i < 4 ? "situacao" : "resultado");
      }

      // Resultado
      const lido = await http(u.token, "GET", `/sessoes/${sessaoId}/resultado`);
      expect(lido.statusCode).toBe(200);
      expect(lido.json().data).toEqual(ultima.json().data.resultado);
      expect(lido.json().data).toMatchObject({
        aderenciaGeral: 76,
        agilidade: 88.33,
        statusValidacao: "aguardando_validacao"
      });
    });

    it("durante o teste a aderência, o estilo, as skills, o alerta e a justificativa não passam pela rede", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      const corposDuranteOTeste: string[] = [];
      for (const [i, escolha] of ["A", "A", "A", "A"].entries()) {
        aguardar(10_000);
        const r = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: i + 1,
          escolha
        });
        corposDuranteOTeste.push(r.body);
      }
      const tudo = corposDuranteOTeste.join("\n");

      expect(tudo).not.toContain(CANARIO_JUSTIFICATIVA);
      for (const chave of [
        "aderencia",
        "estilo",
        "estilo_adequado",
        "estiloAdequado",
        "skills",
        "alerta",
        "justificativa",
        "agilidade",
        "niveisPorSkill"
      ]) {
        expect(tudo, chave).not.toContain(`"${chave}"`);
      }
    });

    it("repetir a mesma requisição devolve exatamente o mesmo corpo, sem nova chamada à IA", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      aguardar(10_000);
      const antes = ia.chamadas.turno;
      const primeira = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "B"
      });
      const segunda = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "B"
      });

      expect(segunda.statusCode).toBe(200);
      expect(segunda.body).toBe(primeira.body);
      expect(ia.chamadas.turno - antes).toBe(1);

      const outra = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "C"
      });
      expect(outra.statusCode).toBe(409);
      expect(outra.json()).toMatchObject({ code: "LAB_RESPOSTA_DIVERGENTE" });
    });

    it("o aviso de tempo esgotado só vale quando o relógio do servidor concorda", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      aguardar(20_000);

      const cedo = await http(u.token, "POST", `/sessoes/${sessaoId}/tempo-esgotado`, {
        numero: 1
      });
      expect(cedo.statusCode).toBe(409);
      expect(cedo.json()).toMatchObject({
        code: "LAB_TEMPO_NAO_ESGOTADO",
        details: { tempoRestanteMs: 40_000 }
      });

      aguardar(40_000);
      const tarde = await http(u.token, "POST", `/sessoes/${sessaoId}/tempo-esgotado`, {
        numero: 1
      });
      expect(tarde.statusCode).toBe(200);
      expect(tarde.json().data).toMatchObject({ tipo: "situacao", tempoEsgotadoNaAnterior: true });
    });

    it("retomar: POST /sessoes de novo devolve o teste em andamento", async () => {
      const u = await participante();
      const primeira = await iniciar(u);
      aguardar(15_000);
      const retomada = (await http(u.token, "POST", "/sessoes")).json().data;
      expect(retomada.sessaoId).toBe(primeira.sessaoId);
      expect(retomada.situacao.tempoRestanteMs).toBe(45_000);
    });
  });

  // -------------------------------------------------------------------------
  describe("GET /painel", () => {
    it("participante novo: 200 no formato { data }, tudo vazio e o botão de iniciar", async () => {
      const u = await participante();
      await http(u.token, "POST", "/termo");
      const r = await http(u.token, "GET", "/painel");

      expect(r.statusCode).toBe(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      const { data } = r.json();
      expect(Object.keys(data).sort()).toEqual([
        "acao",
        "alertas",
        "demonstracao",
        "evolucao",
        "indicadores",
        "skills",
        "sugestoes",
        "termo",
        "tipoDePerfil"
      ]);
      expect(data.termo).toMatchObject({ versaoAtual: "2026-1", aceito: true });
      expect(data.acao).toMatchObject({ tipo: "iniciar", molde: { nivel: "supervisor" } });
      expect(data.indicadores).toMatchObject({ testesFeitos: 0, aderenciaMedia: null });
      expect(data.skills).toHaveLength(8);
      expect(data.tipoDePerfil).toEqual({
        disponivel: false,
        testesFeitos: 0,
        testesNecessarios: 3
      });
    });

    it("sem aceitar o termo, o painel responde e avisa (não é erro)", async () => {
      const u = await participante();
      const r = await http(u.token, "GET", "/painel");
      expect(r.statusCode).toBe(200);
      expect(r.json().data).toMatchObject({
        termo: { aceito: false, aceitoEm: null },
        acao: { tipo: "indisponivel", motivo: "termo-pendente" }
      });
    });

    it("depois de um teste: os números, as datas em ISO e nada da avaliação por situação", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      for (const [i, escolha] of ["A", "B", "C", "B", "A"].entries()) {
        aguardar(10_000);
        await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, { numero: i + 1, escolha });
      }
      const r = await http(u.token, "GET", "/painel");
      const { data } = r.json();

      expect(data.indicadores).toMatchObject({
        testesFeitos: 1,
        aderenciaMedia: 76,
        agilidadeMedia: 88.33
      });
      expect(new Date(data.indicadores.ultimoTesteEm).toISOString()).toBe(
        data.indicadores.ultimoTesteEm
      );
      expect(data.evolucao.pontos).toHaveLength(1);
      expect(data.evolucao.pontos[0]).toMatchObject({
        sessaoId,
        aderenciaGeral: 76,
        nSituacoes: 5
      });
      expect(data.skills.find((s: { skillId: string }) => s.skillId === "gestao-os")).toMatchObject(
        { nivel: 5, nEvidencias: 1 }
      );
      expect(data.sugestoes.itens).toHaveLength(1);
      // As justificativas só existem no resultado, nunca no painel.
      expect(r.body).not.toContain(CANARIO_JUSTIFICATIVA);
      expect(r.body).not.toContain('"justificativa"');
    });

    it("com um teste em andamento e linha vermelha já gravada, a resposta da rede não revela nada", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      const anterior = ia.roteiro;
      ia.roteiro = {
        ...roteiroPadrao,
        aderencia: (n, e) => (n === 1 && e === "C" ? 10 : roteiroPadrao.aderencia(n, e))
      };
      try {
        aguardar(10_000);
        await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, { numero: 1, escolha: "C" });
      } finally {
        ia.roteiro = anterior;
      }
      // O alerta existe no banco (o curador já pode ser avisado)...
      const alertas = await consulta(
        `SELECT cor, status FROM leadership_lab.alerta WHERE sessao_id = $1`,
        [sessaoId]
      );
      expect(alertas).toEqual([{ cor: "vermelho", status: "aberto" }]);

      // ...mas o painel do participante não o mostra: só diz que o teste está em andamento.
      const r = await http(u.token, "GET", "/painel");
      const { data } = r.json();
      expect(data.acao).toMatchObject({ tipo: "continuar", sessaoId, situacaoAtual: 2 });
      expect(data.alertas).toEqual([]);
      expect(data.indicadores.testesFeitos).toBe(0);
      expect(r.body).not.toContain("vermelho");
      expect(r.body).not.toContain(CANARIO_JUSTIFICATIVA);
    });

    it("o painel é só do próprio participante: dois usuários, dois painéis", async () => {
      const ana = await participante();
      const bia = await participante();
      const { sessaoId } = await iniciar(ana);
      for (const n of [1, 2, 3, 4, 5]) {
        aguardar(10_000);
        await http(ana.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: n,
          escolha: "A"
        });
      }
      await http(bia.token, "POST", "/termo");
      expect((await http(ana.token, "GET", "/painel")).json().data.indicadores.testesFeitos).toBe(
        1
      );
      const deBia = (await http(bia.token, "GET", "/painel")).json().data;
      expect(deBia.indicadores.testesFeitos).toBe(0);
      expect(deBia.evolucao.pontos).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // O front valida cada resposta com estes mesmos schemas (packages/shared). Aqui a API prova que
  // o que ela realmente envia, numa partida inteira, obedece a eles.
  describe("contrato com o front", () => {
    it("toda resposta de uma partida inteira obedece aos schemas compartilhados", async () => {
      const u = await participante();
      const ler = <T>(schema: { parse(dado: unknown): T }, r: { json(): { data: unknown } }) =>
        schema.parse(r.json().data);

      // Antes do termo: o painel responde e o botão fica indisponível.
      const antes = ler(labPainelSchema, await http(u.token, "GET", "/painel"));
      expect(antes.acao).toMatchObject({ tipo: "indisponivel", motivo: "termo-pendente" });
      expect(ler(labTermoSchema, await http(u.token, "GET", "/termo")).aceito).toBe(false);

      ler(labAceiteDoTermoSchema, await http(u.token, "POST", "/termo"));
      expect(ler(labTermoSchema, await http(u.token, "GET", "/termo")).aceito).toBe(true);
      expect(ler(labPainelSchema, await http(u.token, "GET", "/painel")).acao.tipo).toBe("iniciar");

      // Em andamento: o painel diz "continuar" e a leitura do teste devolve a situação.
      const aberto = ler(labRespostaDoTesteSchema, await http(u.token, "POST", "/sessoes"));
      if (aberto.tipo !== "situacao") throw new Error("esperava a situação 1");
      expect(ler(labPainelSchema, await http(u.token, "GET", "/painel")).acao).toMatchObject({
        tipo: "continuar",
        sessaoId: aberto.sessaoId,
        situacaoAtual: 1
      });
      expect(ler(labEstadoDoTesteSchema, await http(u.token, "GET", "/sessoes/atual"))).toEqual(
        aberto
      );

      // Cinco respostas, a última devolve o resultado.
      let atual = aberto;
      for (const [i, escolha] of ["A", "B", "C", "B", "A"].entries()) {
        aguardar(10_000);
        const r = ler(
          labRespostaDoTesteSchema,
          await http(u.token, "POST", `/sessoes/${aberto.sessaoId}/respostas`, {
            numero: i + 1,
            escolha
          })
        );
        if (i < 4) {
          if (r.tipo !== "situacao") throw new Error(`esperava a situação ${i + 2}`);
          atual = r;
        } else {
          expect(r.tipo).toBe("resultado");
        }
      }
      expect(atual.situacao.numero).toBe(5);

      const resultado = ler(
        labResultadoSchema,
        await http(u.token, "GET", `/sessoes/${aberto.sessaoId}/resultado`)
      );
      expect(resultado.situacoes).toHaveLength(5);

      // Depois do teste: o painel já mostra o teste concluído.
      const depois = ler(labPainelSchema, await http(u.token, "GET", "/painel"));
      expect(depois.indicadores.testesFeitos).toBe(1);
      expect(depois.evolucao.pontos).toHaveLength(1);
      expect(depois.acao.tipo).toBe("iniciar");
    });

    it("o tempo esgotado também devolve uma resposta do contrato", async () => {
      const u = await participante();
      const { sessaoId, situacao } = await iniciar(u);
      aguardar(61_000);

      const r = await http(u.token, "POST", `/sessoes/${sessaoId}/tempo-esgotado`, {
        numero: situacao.numero
      });

      expect(r.statusCode).toBe(200);
      const lida = labRespostaDoTesteSchema.parse(r.json().data);
      expect(lida).toMatchObject({ tipo: "situacao", tempoEsgotadoNaAnterior: true });
    });
  });

  // -------------------------------------------------------------------------
  describe("GET /sessoes/atual", () => {
    it("sem teste em andamento: 404 no formato de erro padrão, e nenhum teste é começado", async () => {
      const u = await participante();
      await http(u.token, "POST", "/termo");

      const r = await http(u.token, "GET", "/sessoes/atual");

      expect(r.statusCode).toBe(404);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.json()).toEqual({
        code: "LAB_SEM_TESTE_EM_ANDAMENTO",
        message: "Você não tem um teste em andamento.",
        details: {}
      });
      const sessoes = await consulta(
        `SELECT 1 FROM leadership_lab.sessao WHERE participante_id = $1`,
        [u.participanteId]
      );
      expect(sessoes).toHaveLength(0);
    });

    it("com teste em andamento: devolve o mesmo corpo que POST /sessoes e ler não muda nada", async () => {
      const u = await participante();
      await http(u.token, "POST", "/termo");
      const aberto = await http(u.token, "POST", "/sessoes");

      const primeira = await http(u.token, "GET", "/sessoes/atual");
      const segunda = await http(u.token, "GET", "/sessoes/atual");

      expect(primeira.statusCode).toBe(200);
      expect(primeira.headers["cache-control"]).toBe("no-store");
      expect(primeira.json()).toEqual(aberto.json());
      expect(segunda.json()).toEqual(primeira.json());
      const sessoes = await consulta(
        `SELECT 1 FROM leadership_lab.sessao WHERE participante_id = $1`,
        [u.participanteId]
      );
      expect(sessoes).toHaveLength(1);
    });

    it("depois de uma resposta: a próxima situação, com a consequência, e nada da avaliação", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      aguardar(10_000);
      const resposta = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "A"
      });

      const r = await http(u.token, "GET", "/sessoes/atual");

      expect(r.json()).toEqual(resposta.json());
      expect(r.json().data).toMatchObject({ tipo: "situacao", situacao: { numero: 2 } });
      expect(r.body).not.toContain(CANARIO_JUSTIFICATIVA);
      expect(r.body).not.toContain("aderencia");
    });

    it("cada participante lê só o próprio teste", async () => {
      const ana = await participante();
      const bia = await participante();
      await iniciar(ana);
      await http(bia.token, "POST", "/termo");

      expect((await http(ana.token, "GET", "/sessoes/atual")).statusCode).toBe(200);
      expect((await http(bia.token, "GET", "/sessoes/atual")).statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe("erros no formato padrão", () => {
    it.each([
      ["campo a mais, como a aderência", { numero: 1, escolha: "A", aderencia: 100 }],
      ["escolha fora de A, B e C", { numero: 1, escolha: "Z" }],
      ["número como texto", { numero: "1", escolha: "A" }],
      ["sem a escolha", { numero: 1 }],
      ["campo livre em branco", { numero: 1, escolha: "A", textoLivre: "   " }]
    ])("400 VALIDATION_ERROR para %s", async (_nome, corpo) => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      const antes = ia.chamadas.turno;
      const r = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, corpo);
      expect(r.statusCode).toBe(400);
      expect(r.json()).toMatchObject({
        code: expect.stringMatching(/VALIDATION_ERROR|REQUEST_ERROR/),
        message: expect.any(String)
      });
      expect(ia.chamadas.turno).toBe(antes);
    });

    it("corpo que não é um objeto JSON é recusado: 400 (texto ou lista) e 415 (sem tipo de conteúdo)", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      const enviar = (tipo: string, corpo: string) =>
        app.inject({
          method: "POST",
          url: `${PREFIXO}/sessoes/${sessaoId}/respostas`,
          headers: { authorization: `Bearer ${u.token}`, "content-type": tipo },
          payload: corpo
        });
      expect((await enviar("application/json", '"texto"')).statusCode).toBe(400);
      expect((await enviar("application/json", "[1, 2]")).statusCode).toBe(400);
      expect((await enviar("text/plain", "A")).statusCode).toBe(400);
      const semTipo = await app.inject({
        method: "POST",
        url: `${PREFIXO}/sessoes/${sessaoId}/respostas`,
        headers: { authorization: `Bearer ${u.token}` },
        payload: "A"
      });
      expect(semTipo.statusCode).toBe(415);
    });

    it("corpo grande demais é recusado antes de qualquer processamento", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      const r = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "A",
        textoLivre: "x".repeat(20_000)
      });
      expect(r.statusCode).toBe(413);
    });

    it("JSON malformado é 400, não 500", async () => {
      const u = await participante();
      const r = await app.inject({
        method: "POST",
        url: `${PREFIXO}/sessoes/${crypto.randomUUID()}/respostas`,
        headers: { authorization: `Bearer ${u.token}`, "content-type": "application/json" },
        payload: "{ não é json"
      });
      expect(r.statusCode).toBe(400);
    });

    it("sessão mal formada, inexistente e alheia dão o mesmo 404", async () => {
      const ana = await participante();
      const bia = await participante();
      const { sessaoId } = await iniciar(ana);
      aguardar(10_000);

      const respostas = [
        await http(bia.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: 1,
          escolha: "A"
        }),
        await http(bia.token, "POST", `/sessoes/${crypto.randomUUID()}/respostas`, {
          numero: 1,
          escolha: "A"
        }),
        await http(bia.token, "POST", `/sessoes/nao-e-uuid/respostas`, { numero: 1, escolha: "A" })
      ];
      for (const r of respostas) {
        expect(r.statusCode).toBe(404);
        expect(r.json()).toMatchObject({ code: "LAB_NOT_FOUND" });
      }
      expect(respostas[0]!.body).toBe(respostas[1]!.body);
      expect(respostas[1]!.body).toBe(respostas[2]!.body);
    });

    it("falha da IA vira 502 no formato padrão, e repetir conclui", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      aguardar(10_000);
      ia.falharNa("turno", "erro");

      const falha = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "B"
      });
      expect(falha.statusCode).toBe(502);
      expect(falha.json()).toMatchObject({ code: "LAB_IA_INDISPONIVEL" });
      expect(falha.body).not.toContain("503"); // o detalhe técnico fica no log, não na resposta

      const repetida = await http(u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
        numero: 1,
        escolha: "B"
      });
      expect(repetida.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  describe("permissões", () => {
    const rotasDoParticipante: Array<["GET" | "POST", string, unknown?]> = [
      ["GET", "/painel"],
      ["GET", "/termo"],
      ["POST", "/termo"],
      ["GET", "/moldes"],
      ["POST", "/sessoes"],
      ["GET", "/sessoes/atual"],
      ["POST", `/sessoes/${crypto.randomUUID()}/respostas`, { numero: 1, escolha: "A" }],
      ["POST", `/sessoes/${crypto.randomUUID()}/tempo-esgotado`, { numero: 1 }]
    ];

    it.each(["RH", "ADMIN"] as const)(
      "%s não usa nenhuma rota do participante: 403",
      async (papel) => {
        const u = await semVinculo(papel);
        for (const [metodo, caminho, corpo] of rotasDoParticipante) {
          const r = await http(u.token, metodo, caminho, corpo);
          expect(r.statusCode, `${metodo} ${caminho}`).toBe(403);
          expect(r.json()).toMatchObject({ code: "LAB_FORBIDDEN" });
        }
      }
    );

    it("usuário COMUM ainda não vinculado a um colaborador: 403 com orientação", async () => {
      const u = await semVinculo("COMUM");
      const r = await http(u.token, "POST", "/sessoes");
      expect(r.statusCode).toBe(403);
      expect(r.json()).toMatchObject({
        code: "LAB_SEM_VINCULO",
        message: expect.stringContaining("RH")
      });
    });

    it("o resultado de um teste: só o dono e o curador da turma dele", async () => {
      const dono = await participante();
      const outro = await participante();
      const curadorId = await criarUsuario(banco.db.client, banco.base, { roleId: papeis.RH });
      const curador: Usuario = {
        id: curadorId,
        token: tokenDe(curadorId, "RH"),
        participanteId: null
      };
      const curadorDeFora = await semVinculo("RH");
      const admin = await semVinculo("ADMIN");

      const { sessaoId } = await iniciar(dono);
      for (const n of [1, 2, 3, 4, 5]) {
        aguardar(10_000);
        await http(dono.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: n,
          escolha: "A"
        });
      }
      const turma = await inserir(banco.db.client, "leadership_lab.turma", {
        nome: "T",
        curador_id: curadorId
      });
      await consulta(
        `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
        [turma, dono.participanteId]
      );

      const caminho = `/sessoes/${sessaoId}/resultado`;
      expect((await http(dono.token, "GET", caminho)).statusCode).toBe(200);
      expect((await http(curador.token, "GET", caminho)).statusCode).toBe(200);
      for (const intruso of [outro, curadorDeFora]) {
        const r = await http(intruso.token, "GET", caminho);
        expect(r.statusCode).toBe(404);
        expect(r.json()).toMatchObject({ code: "LAB_NOT_FOUND" });
      }
      expect((await http(admin.token, "GET", caminho)).statusCode).toBe(403);
    });

    it("o resultado só existe depois do último turno", async () => {
      const u = await participante();
      const { sessaoId } = await iniciar(u);
      const r = await http(u.token, "GET", `/sessoes/${sessaoId}/resultado`);
      expect(r.statusCode).toBe(409);
      expect(r.json()).toMatchObject({ code: "LAB_TESTE_EM_ANDAMENTO" });
    });
  });

  // -------------------------------------------------------------------------
  describe("a cadeia inteira, com o cliente HTTP real falando com o serviço de IA", () => {
    const TOKEN_DO_SERVICO = "token-de-servico-da-cadeia";
    let iaDoServico: IaFalsa;

    async function montar(tokenDoCliente: string) {
      // Cada teste da cadeia sobe o seu serviço; o anterior é fechado.
      await appHttp?.close();
      await servico?.fechar();
      iaDoServico = new IaFalsa();
      servico = await subirServicoIaFalso(iaDoServico, TOKEN_DO_SERVICO);
      const { buildApp } = await import("../../app.js");
      appHttp = await buildApp({
        lab: {
          ia: new ClienteIaHttp({ baseUrl: servico.url, token: tokenDoCliente, timeoutMs: 3000 }),
          config: configDeTeste(),
          agora: relogio.agora
        }
      });
    }

    it("uma partida inteira passa pelas rotas, pelo motor, pelo cliente HTTP e pelo serviço", async () => {
      await montar(TOKEN_DO_SERVICO);
      iaDoServico.decisaoDaGuarda = "mascarar";
      const u = await participante();
      await chamar(appHttp!, u.token, "POST", "/termo");
      const abertura = await chamar(appHttp!, u.token, "POST", "/sessoes");
      expect(abertura.statusCode, abertura.body).toBe(200);
      const { sessaoId } = abertura.json().data;

      let ultima = abertura;
      for (const n of [1, 2, 3, 4, 5]) {
        aguardar(10_000);
        ultima = await chamar(appHttp!, u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: n,
          escolha: "A",
          ...(n === 2 ? { textoLivre: "Chamaria o eletricista para ajudar." } : {})
        });
        expect(ultima.statusCode, ultima.body).toBe(200);
      }
      expect(ultima.json().data.tipo).toBe("resultado");

      // O serviço recebeu as chamadas documentadas, na ordem, sempre com o token de serviço.
      const caminhos = servico!.requisicoes.map((r) => r.caminho);
      expect(caminhos).toEqual([
        "/teste/sessoes",
        "/teste/turnos",
        "/agentes/guarda",
        "/teste/turnos",
        "/teste/turnos",
        "/teste/turnos",
        "/teste/turnos"
      ]);
      for (const r of servico!.requisicoes) {
        expect(r.metodo).toBe("POST");
        expect(r.cabecalhos["x-servico-token"]).toBe(TOKEN_DO_SERVICO);
        expect(r.cabecalhos["authorization"]).toBeUndefined();
      }
      // E nada pessoal viajou: nem o usuário, nem o colaborador, nem o id do banco.
      const enviado = JSON.stringify(servico!.requisicoes.map((r) => r.corpo));
      for (const pessoal of [u.id, u.participanteId!, sessaoId, `${u.id}@teste.local`]) {
        expect(enviado).not.toContain(pessoal);
      }
    });

    it("a conversa com o facilitador passa pela Guarda e pelo serviço, e só depois do resultado", async () => {
      await montar(TOKEN_DO_SERVICO);
      iaDoServico.respostaDaConversa = "Seu ponto forte foi a comunicação.";
      const u = await participante();
      await chamar(appHttp!, u.token, "POST", "/termo");
      const { sessaoId } = (await chamar(appHttp!, u.token, "POST", "/sessoes")).json().data;
      const caminho = `/sessoes/${sessaoId}/conversa`;

      // Durante o teste, não.
      const cedo = await chamar(appHttp!, u.token, "POST", caminho, { mensagem: "Oi" });
      expect(cedo.statusCode).toBe(409);
      expect(cedo.json()).toMatchObject({ code: "LAB_TESTE_EM_ANDAMENTO" });

      for (const n of [1, 2, 3, 4, 5]) {
        aguardar(10_000);
        await chamar(appHttp!, u.token, "POST", `/sessoes/${sessaoId}/respostas`, {
          numero: n,
          escolha: "A"
        });
      }

      const r = await chamar(appHttp!, u.token, "POST", caminho, {
        mensagem: "Qual foi o meu ponto forte?"
      });
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().data).toEqual({
        desfecho: "respondida",
        resposta: "Seu ponto forte foi a comunicação."
      });
      expect(r.headers["cache-control"]).toBe("no-store");

      const caminhos = servico!.requisicoes.map((x) => x.caminho).slice(-2);
      expect(caminhos).toEqual(["/agentes/guarda", "/agentes/facilitador"]);
      const enviado = JSON.stringify(servico!.requisicoes.at(-1)!.corpo);
      for (const pessoal of [u.id, u.participanteId!, sessaoId, `${u.id}@teste.local`]) {
        expect(enviado).not.toContain(pessoal);
      }

      // Campo desconhecido, outro perfil e sessão alheia.
      expect(
        (await chamar(appHttp!, u.token, "POST", caminho, { mensagem: "Oi", aderencia: 1 }))
          .statusCode
      ).toBe(400);
      const outro = await participante();
      expect(
        (await chamar(appHttp!, outro.token, "POST", caminho, { mensagem: "Oi" })).statusCode
      ).toBe(404);
      const admin = await semVinculo("ADMIN");
      expect(
        (await chamar(appHttp!, admin.token, "POST", caminho, { mensagem: "Oi" })).statusCode
      ).toBe(403);
    });

    it("token de serviço errado: o serviço recusa (401) e o participante recebe 502, sem o segredo", async () => {
      await montar("token-errado");
      const u = await participante();
      await chamar(appHttp!, u.token, "POST", "/termo");
      const r = await chamar(appHttp!, u.token, "POST", "/sessoes");

      expect(r.statusCode).toBe(502);
      expect(r.json()).toMatchObject({ code: "LAB_IA_INDISPONIVEL" });
      expect(r.body).not.toContain("token-errado");
      expect(r.body).not.toContain(TOKEN_DO_SERVICO);
      const [log] = await consulta(
        `SELECT codigo_erro, sucesso FROM leadership_lab.log_ia WHERE sessao_id IS NULL ORDER BY criado_em DESC LIMIT 1`
      );
      expect(log).toEqual({ codigo_erro: "TRANSPORTE", sucesso: false });
    });
  });
});
