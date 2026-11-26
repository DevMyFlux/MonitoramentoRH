// Contas de acesso com cargo, nível de governança e área: criar, convidar, editar, listar pendentes
// e as áreas. buildApp() real, JWT real e PostgreSQL real (banco descartável com todas as
// migrações). Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken } from "../auth/token-service.js";
import {
  applyMigrations,
  createTestDatabase,
  integrationEnabled,
  readMigrations
} from "../leadership-lab/db/test-database.js";
import { criarUsuario, inserir } from "../leadership-lab/db/test-fixtures.js";
import {
  type Banco,
  encerrarBanco,
  prepararBanco
} from "../leadership-lab/motor/cenario-de-teste.js";

type Papel = "DEV" | "ADMIN" | "RH" | "COMUM";
type Pessoa = { id: string; token: string };

describe.skipIf(!integrationEnabled)("contas: cargo, nível de governança e área", () => {
  let banco: Banco;
  let app: FastifyInstance;
  let desligarPrisma: () => Promise<void>;
  const papeis = {} as Record<Papel, string>;
  let dev: Pessoa, admin: Pessoa, rh: Pessoa, comum: Pessoa;
  let areaRh: string, areaManutencao: string;

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);
  const tokenDe = (id: string, role: Papel) =>
    createAccessToken({ id, email: `${id}@teste.local`, name: "Pessoa", role, scopes: [] });

  /** Uma conta já existente (como as antigas: sem cargo, nível nem área) com escopo na operação. */
  async function conta(role: Papel, extra: Record<string, unknown> = {}): Promise<Pessoa> {
    const id = await criarUsuario(banco.db.client, banco.base, { roleId: papeis[role], ...extra });
    await inserir(banco.db.client, '"UserScope"', {
      id: crypto.randomUUID(),
      userId: id,
      operationId: role === "DEV" ? null : banco.base.operationId,
      isGlobal: role === "DEV",
      updatedAt: new Date().toISOString()
    });
    return { id, token: tokenDe(id, role) };
  }

  function chamar(
    quem: Pessoa | null,
    metodo: "GET" | "POST" | "PATCH",
    caminho: string,
    corpo?: unknown
  ) {
    return app.inject({
      method: metodo,
      url: `/api/v1${caminho}`,
      ...(quem ? { headers: { authorization: `Bearer ${quem.token}` } } : {}),
      ...(corpo === undefined ? {} : { payload: corpo as object })
    });
  }

  const novaConta = (extra: Record<string, unknown> = {}) => ({
    email: `nova${Math.random().toString(36).slice(2, 8)}@teste.local`,
    name: "Pessoa Nova",
    role: "COMUM",
    password: "Senha-de-teste-1!",
    scopes: [{ operationId: banco.base.operationId, isGlobal: false }],
    cargo: "Supervisor de manutenção",
    nivelGovernanca: "supervisor",
    areaId: areaManutencao,
    ...extra
  });
  const caminhosDosErros = (r: { json: () => { details?: { issues?: { path: string[] }[] } } }) =>
    (r.json().details?.issues ?? []).map((i) => i.path.join("."));

  beforeAll(async () => {
    banco = await prepararBanco();
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../app.js");
    const { prisma } = await import("../../lib/prisma.js");
    desligarPrisma = () => prisma.$disconnect();
    app = await buildApp();
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
    dev = await conta("DEV");
    admin = await conta("ADMIN", { createdBy: dev.id });
    rh = await conta("RH", { createdBy: dev.id });
    comum = await conta("COMUM");
    const areas = await consulta(`SELECT id, slug FROM "Area"`);
    areaRh = areas.find((a) => a.slug === "rh")!.id;
    areaManutencao = areas.find((a) => a.slug === "manutencao")!.id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await desligarPrisma?.();
    await encerrarBanco(banco);
  });

  it("a migração traz as 5 áreas iniciais e as contas antigas seguem como estavam", async () => {
    const areas = await consulta(`SELECT slug FROM "Area" ORDER BY slug`);
    expect(areas.map((a) => a.slug)).toEqual([
      "administrativo",
      "compras",
      "financeiro",
      "manutencao",
      "rh"
    ]);
    const [antiga] = await consulta(
      `SELECT "cargo", "nivelGovernanca", "areaId" FROM "User" WHERE id = $1`,
      [comum.id]
    );
    expect(antiga).toEqual({ cargo: null, nivelGovernanca: null, areaId: null });
  });

  it("criar conta sem cargo, nível e área é recusado, com um erro por campo", async () => {
    const { cargo, nivelGovernanca, areaId, ...semCadastro } = novaConta();
    void cargo;
    void nivelGovernanca;
    void areaId;
    const r = await chamar(dev, "POST", "/users", semCadastro);
    expect(r.statusCode).toBe(400);
    expect(caminhosDosErros(r).sort()).toEqual(["areaId", "cargo", "nivelGovernanca"]);
    expect(
      await consulta(`SELECT count(*)::int AS n FROM "User" WHERE name = 'Pessoa Nova'`)
    ).toEqual([{ n: 0 }]);
  });

  it("recusa cargo curto, nível inventado e área inexistente ou inativa, cada um no seu campo", async () => {
    expect(
      caminhosDosErros(await chamar(dev, "POST", "/users", novaConta({ cargo: "x" })))
    ).toEqual(["cargo"]);
    expect(
      caminhosDosErros(await chamar(dev, "POST", "/users", novaConta({ nivelGovernanca: "chefe" })))
    ).toEqual(["nivelGovernanca"]);
    const inexistente = await chamar(
      dev,
      "POST",
      "/users",
      novaConta({ areaId: crypto.randomUUID() })
    );
    expect(inexistente.statusCode).toBe(400);
    expect(caminhosDosErros(inexistente)).toEqual(["areaId"]);

    const inativa = (await chamar(admin, "POST", "/areas", { nome: "Área Antiga" })).json().data
      .id as string;
    expect((await chamar(admin, "PATCH", `/areas/${inativa}`, { ativa: false })).statusCode).toBe(
      200
    );
    const comInativa = await chamar(dev, "POST", "/users", novaConta({ areaId: inativa }));
    expect(comInativa.statusCode).toBe(400);
    expect(caminhosDosErros(comInativa)).toEqual(["areaId"]);
  });

  it("criar conta completa grava o cadastro e a auditoria na mesma transação", async () => {
    const corpo = novaConta({
      cargo: "  Coordenadora administrativa ",
      nivelGovernanca: "coordenador",
      areaId: areaRh
    });
    const r = await chamar(rh, "POST", "/users", corpo);
    expect(r.statusCode, r.body).toBe(200);
    const usuario = r.json().data.user;
    expect(usuario).toMatchObject({
      cargo: "Coordenadora administrativa",
      nivelGovernanca: "coordenador"
    });
    expect(usuario.area).toMatchObject({ id: areaRh, nome: "RH" });
    const auditoria = await consulta(
      `SELECT "userRole", after FROM "AuditLog" WHERE entity = 'User' AND action = 'CREATE' AND "entityId" = $1`,
      [usuario.id]
    );
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].userRole).toBe("RH");
    expect(auditoria[0].after).toMatchObject({
      cargo: "Coordenadora administrativa",
      areaId: areaRh
    });
  });

  it("se a auditoria falha, a conta também não fica (mesma transação)", async () => {
    await consulta(`
      CREATE FUNCTION falha_auditoria_usuario() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.entity = 'User' AND NEW.action = 'CREATE' THEN RAISE EXCEPTION 'auditoria fora do ar'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER falha_auditoria_usuario BEFORE INSERT ON "AuditLog"
        FOR EACH ROW EXECUTE FUNCTION falha_auditoria_usuario();`);
    try {
      const corpo = novaConta({ email: "transacao@teste.local" });
      expect((await chamar(dev, "POST", "/users", corpo)).statusCode).toBe(500);
      expect(
        await consulta(
          `SELECT count(*)::int AS n FROM "User" WHERE email = 'transacao@teste.local'`
        )
      ).toEqual([{ n: 0 }]);
    } finally {
      await consulta(
        `DROP TRIGGER falha_auditoria_usuario ON "AuditLog"; DROP FUNCTION falha_auditoria_usuario();`
      );
    }
  });

  it("quem pode criar o quê: ADMIN não cria ADMIN nem DEV; RH só COMUM; COMUM nem entra", async () => {
    for (const perfil of ["ADMIN", "DEV"]) {
      const r = await chamar(admin, "POST", "/users", novaConta({ role: perfil }));
      expect(r.statusCode, `ADMIN cria ${perfil}`).toBe(403);
      expect(r.json().code).toBe("ROLE_ELEVATION_FORBIDDEN");
    }
    expect((await chamar(admin, "POST", "/users", novaConta({ role: "RH" }))).statusCode).toBe(200);
    expect((await chamar(rh, "POST", "/users", novaConta({ role: "RH" }))).statusCode).toBe(403);
    expect((await chamar(rh, "POST", "/users", novaConta({ role: "ADMIN" }))).statusCode).toBe(403);
    const doComum = await chamar(comum, "POST", "/users", novaConta());
    expect(doComum.statusCode).toBe(403);
    expect(doComum.json().code).toBe("MODULO_FORBIDDEN");
    // DEV cria qualquer perfil (DEV exige escopo global).
    const dev2 = await chamar(
      dev,
      "POST",
      "/users",
      novaConta({ role: "DEV", scopes: [{ isGlobal: true }] })
    );
    expect(dev2.statusCode, dev2.body).toBe(200);
  });

  it("convite carrega o cadastro e a conta aceita já nasce completa", async () => {
    const semCadastro = await chamar(dev, "POST", "/users/invitations", {
      email: "convidada@teste.local",
      name: "Convidada",
      role: "COMUM",
      scopes: [{ operationId: banco.base.operationId, isGlobal: false }]
    });
    expect(semCadastro.statusCode).toBe(400);
    expect(caminhosDosErros(semCadastro).sort()).toEqual(["areaId", "cargo", "nivelGovernanca"]);

    const convite = await chamar(dev, "POST", "/users/invitations", {
      email: "convidada@teste.local",
      name: "Convidada",
      role: "COMUM",
      scopes: [{ operationId: banco.base.operationId, isGlobal: false }],
      cargo: "Assistente administrativa",
      nivelGovernanca: "assistente",
      areaId: areaRh
    });
    expect(convite.statusCode, convite.body).toBe(200);
    const aceito = await app.inject({
      method: "POST",
      url: "/api/v1/auth/accept-invitation",
      payload: { token: convite.json().data.inviteToken, password: "Senha-de-teste-1!" }
    });
    expect(aceito.statusCode, aceito.body).toBe(200);
    expect(aceito.json().data.user).toMatchObject({
      cargo: "Assistente administrativa",
      nivelGovernanca: "assistente"
    });
  });

  it("a lista mostra o que falta em cada conta e filtra os pendentes", async () => {
    const antiga = await conta("COMUM", { createdBy: admin.id, name: "Conta Antiga" });
    const nova = await chamar(admin, "POST", "/users", novaConta({ name: "Conta Completa" }));
    expect(nova.statusCode).toBe(200);

    const todas = (await chamar(admin, "GET", "/users")).json().data as {
      id: string;
      name: string;
      cadastroIncompleto: string[];
      cargo: string | null;
    }[];
    expect(todas.find((u) => u.id === antiga.id)?.cadastroIncompleto).toEqual([
      "cargo",
      "nivelGovernanca",
      "areaId"
    ]);
    expect(todas.find((u) => u.name === "Conta Completa")).toMatchObject({
      cadastroIncompleto: [],
      cargo: "Supervisor de manutenção"
    });

    const pendentes = (await chamar(admin, "GET", "/users?pendentes=1")).json().data as {
      id: string;
    }[];
    expect(pendentes.map((u) => u.id)).toContain(antiga.id);
    expect(
      pendentes.every((u) => (todas.find((t) => t.id === u.id)?.cadastroIncompleto.length ?? 0) > 0)
    ).toBe(true);
    // Quem não é DEV só vê o que criou: a conta antiga do COMUM (sem criador) não aparece para o ADMIN.
    expect(todas.some((u) => u.id === comum.id)).toBe(false);
  });

  it("completar o cadastro de uma conta antiga: os três campos, auditado antes e depois", async () => {
    const antiga = await conta("COMUM", { createdBy: admin.id, name: "Antiga A Completar" });
    const incompleto = await chamar(admin, "PATCH", `/users/${antiga.id}`, { cargo: "Analista" });
    expect(incompleto.statusCode).toBe(400);
    expect(caminhosDosErros(incompleto).sort()).toEqual(["areaId", "nivelGovernanca"]);

    const ok = await chamar(admin, "PATCH", `/users/${antiga.id}`, {
      cargo: "Analista de compras",
      nivelGovernanca: "assistente",
      areaId: areaRh
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const auditoria = await consulta(
      `SELECT "userRole", before, after FROM "AuditLog" WHERE entity = 'User' AND action = 'UPDATE' AND "entityId" = $1`,
      [antiga.id]
    );
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]!.before).toEqual({ cargo: null, nivelGovernanca: null, areaId: null });
    expect(auditoria[0]!.after).toMatchObject({ cargo: "Analista de compras", areaId: areaRh });
    const lista = (await chamar(admin, "GET", "/users?pendentes=1")).json().data as {
      id: string;
    }[];
    expect(lista.some((u) => u.id === antiga.id)).toBe(false);
  });

  it("editar o cadastro de quem o ator não pode (ou de outro criador) responde 404, igual a 'não existe'", async () => {
    const corpo = { cargo: "Cargo Novo", nivelGovernanca: "supervisor", areaId: areaRh };
    const inexistente = await chamar(admin, "PATCH", `/users/${crypto.randomUUID()}`, corpo);
    const outroAdmin = await chamar(admin, "PATCH", `/users/${admin.id}`, corpo); // ADMIN não edita ADMIN
    const dev1 = await chamar(admin, "PATCH", `/users/${dev.id}`, corpo);
    const doutroCriador = await chamar(rh, "PATCH", `/users/${comum.id}`, corpo); // COMUM sem criador
    for (const r of [outroAdmin, dev1, doutroCriador]) {
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual(inexistente.json());
    }
    // O DEV edita qualquer conta; o COMUM não passa da trava.
    expect((await chamar(dev, "PATCH", `/users/${comum.id}`, corpo)).statusCode).toBe(200);
    expect((await chamar(comum, "PATCH", `/users/${comum.id}`, corpo)).statusCode).toBe(403);
  });

  it("áreas: a equipe lê; só DEV e ADMIN criam e editam; nome repetido (mesmo em maiúsculas) é 409; auditado", async () => {
    expect((await chamar(rh, "GET", "/areas")).statusCode).toBe(200);
    expect((await chamar(comum, "GET", "/areas")).statusCode).toBe(403);
    expect((await chamar(rh, "POST", "/areas", { nome: "Segurança" })).statusCode).toBe(403);

    const criada = await chamar(admin, "POST", "/areas", { nome: "Segurança do Trabalho" });
    expect(criada.statusCode, criada.body).toBe(201);
    expect(criada.json().data).toMatchObject({
      slug: "seguranca-do-trabalho",
      ativa: true,
      usuarios: 0
    });
    const repetida = await chamar(dev, "POST", "/areas", { nome: "segurança do trabalho" });
    expect(repetida.statusCode).toBe(409);
    expect(caminhosDosErros(repetida)).toEqual(["nome"]);
    expect((await chamar(dev, "POST", "/areas", { nome: "RH" })).statusCode).toBe(409);

    const renomeada = await chamar(admin, "PATCH", `/areas/${criada.json().data.id}`, {
      nome: "Segurança e Saúde"
    });
    expect(renomeada.statusCode).toBe(200);
    expect(renomeada.json().data.slug).toBe("seguranca-do-trabalho"); // o slug não muda
    expect(
      (await chamar(rh, "PATCH", `/areas/${criada.json().data.id}`, { ativa: false })).statusCode
    ).toBe(403);
    expect((await chamar(admin, "PATCH", `/areas/${criada.json().data.id}`, {})).statusCode).toBe(
      400
    );

    const auditoria = await consulta(
      `SELECT action FROM "AuditLog" WHERE entity = 'Area' AND "entityId" = $1 ORDER BY "createdAt"`,
      [criada.json().data.id]
    );
    expect(auditoria.map((a) => a.action)).toEqual(["CREATE", "UPDATE"]);
    const lista = (await chamar(rh, "GET", "/areas")).json().data as {
      slug: string;
      usuarios: number;
    }[];
    expect(lista.find((a) => a.slug === "rh")!.usuarios).toBeGreaterThan(0);
  });

  it("a migração 0023 desce sem tocar em outras tabelas e sobe de novo", async () => {
    const outro = await createTestDatabase();
    try {
      // Só até a 0023: as migrações seguintes (a 0025 tem chave para "Area") dependem dela.
      await applyMigrations(outro.client, "0023_contas_cargo_nivel_area");
      const migracao = readMigrations().find((m) => m.name === "0023_contas_cargo_nivel_area")!;
      expect(migracao.down).not.toBeNull();
      const tabelasAntes = (
        await outro.client.query(
          `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
        )
      ).rows[0].n;
      await outro.client.query(migracao.down!);
      const colunas = await outro.client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('cargo','nivelGovernanca','areaId')`
      );
      expect(colunas.rows).toEqual([]);
      const tabelasDepois = (
        await outro.client.query(
          `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
        )
      ).rows[0].n;
      expect(tabelasDepois).toBe(tabelasAntes - 1); // só "Area" some
      await outro.client.query(migracao.up);
      const areas = (await outro.client.query(`SELECT count(*)::int AS n FROM "Area"`)).rows[0].n;
      expect(areas).toBe(5);
    } finally {
      await outro.drop();
    }
  }, 120_000);
});
