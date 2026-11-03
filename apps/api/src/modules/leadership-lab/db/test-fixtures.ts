// Dados de apoio dos testes de integração do Leadership Lab, em SQL puro: as tabelas do RH
// não têm default de id, e inserir por aqui não depende de nenhum código do aplicativo.
import type pg from "pg";
import { expectDbError } from "./test-database.js";

export type Colunas = Record<string, unknown>;

function montarInsert(tabela: string, colunas: Colunas) {
  const chaves = Object.keys(colunas);
  return {
    sql: `INSERT INTO ${tabela} (${chaves.map((c) => `"${c}"`).join(", ")}) VALUES (${chaves
      .map((_, i) => `$${i + 1}`)
      .join(", ")}) RETURNING id`,
    params: chaves.map((c) => colunas[c])
  };
}

export async function inserir(
  client: pg.Client,
  tabela: string,
  colunas: Colunas
): Promise<string> {
  const { sql, params } = montarInsert(tabela, colunas);
  const { rows } = await client.query<{ id: string }>(sql, params);
  return rows[0]!.id;
}

export function tentarInserir(client: pg.Client, tabela: string, colunas: Colunas) {
  const { sql, params } = montarInsert(tabela, colunas);
  return expectDbError(client, sql, params);
}

export type Base = { roleId: string; operationId: string; moldeId: string };

let contador = 0;
const proximo = () => ++contador;

export async function criarBase(client: pg.Client): Promise<Base> {
  const roleId = await inserir(client, '"Role"', {
    id: crypto.randomUUID(),
    name: "COMUM",
    level: 1,
    description: "Teste",
    updatedAt: new Date().toISOString()
  });
  const agora = new Date().toISOString();
  const companyId = await inserir(client, '"Company"', {
    id: crypto.randomUUID(),
    name: "Empresa",
    updatedAt: agora
  });
  const clientId = await inserir(client, '"Client"', {
    id: crypto.randomUUID(),
    companyId,
    name: "Cliente",
    updatedAt: agora
  });
  const unitId = await inserir(client, '"Unit"', {
    id: crypto.randomUUID(),
    companyId,
    name: "Unidade",
    updatedAt: agora
  });
  const operationId = await inserir(client, '"Operation"', {
    id: crypto.randomUUID(),
    companyId,
    clientId,
    unitId,
    name: "Operação",
    updatedAt: agora
  });
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM leadership_lab.molde WHERE nivel = 'supervisor'`
  );
  return { roleId, operationId, moldeId: rows[0]!.id };
}

export async function criarUsuario(client: pg.Client, base: Base): Promise<string> {
  return inserir(client, '"User"', {
    id: crypto.randomUUID(),
    email: `pessoa${proximo()}@teste.local`,
    name: "Pessoa",
    passwordHash: "x",
    roleId: base.roleId,
    updatedAt: new Date().toISOString()
  });
}

export async function criarColaborador(client: pg.Client, base: Base): Promise<string> {
  return inserir(client, '"Employee"', {
    id: crypto.randomUUID(),
    operationId: base.operationId,
    name: "Colaborador",
    identifier: `MAT${proximo()}`,
    updatedAt: new Date().toISOString()
  });
}

export type Contexto = { base: Base; participanteId: string; userId: string; employeeId: string };

export async function criarParticipante(client: pg.Client, base: Base): Promise<Contexto> {
  const userId = await criarUsuario(client, base);
  const employeeId = await criarColaborador(client, base);
  const participanteId = await inserir(client, "leadership_lab.participante", {
    user_id: userId,
    employee_id: employeeId
  });
  return { base, participanteId, userId, employeeId };
}

export async function criarSessao(
  client: pg.Client,
  ctx: Contexto,
  extra: Colunas = {}
): Promise<string> {
  return inserir(client, "leadership_lab.sessao", {
    participante_id: ctx.participanteId,
    molde_id: ctx.base.moldeId,
    ...extra
  });
}
