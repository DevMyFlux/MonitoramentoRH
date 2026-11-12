// Leadership Lab — ambiente dos testes de integração dos cadastros do RH.
// Só para testes: nenhum código de produção importa este arquivo.
//
// Sobe o aplicativo de verdade (buildApp) sobre um PostgreSQL descartável, com a IA falsa, e
// oferece o que os testes pedem: usuários de qualquer perfil e escopo, operações, colaboradores e
// chamadas HTTP já autenticadas.
import type { FastifyInstance } from "fastify";
import { createAccessToken } from "../../auth/token-service.js";
import { inserir } from "../db/test-fixtures.js";
import { criarColaborador, criarUsuario } from "../db/test-fixtures.js";
import {
  type Banco,
  RelogioFalso,
  configDeTeste,
  encerrarBanco,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { IaFalsa } from "../motor/ia-falsa.js";

export type Papel = "COMUM" | "RH" | "ADMIN" | "DEV";
export type Escopo = {
  companyId?: string;
  operationId?: string;
  unitId?: string;
  isGlobal?: boolean;
};
export type Pessoa = { id: string; token: string };
export type Operacao = { operationId: string; companyId: string; unitId: string };
export type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** O corpo é JSON livre e os testes leem campos aninhados: `any` aqui é de propósito. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RespostaHttp = { status: number; corpo: any };

export const PREFIXO = "/api/v1/leadership-lab";

export class AmbienteDoCadastro {
  private constructor(
    readonly banco: Banco,
    readonly app: FastifyInstance,
    private readonly papeis: Record<Papel, string>,
    private readonly desligarPrisma: () => Promise<void>
  ) {}

  /** A operação que o fixture cria (empresa, cliente e unidade próprias). */
  get operacaoA(): Operacao {
    return this.operacaoDaBase;
  }
  private operacaoDaBase!: Operacao;

  static async subir(
    config: Parameters<typeof configDeTeste>[0] = {}
  ): Promise<AmbienteDoCadastro> {
    const banco = await prepararBanco();
    // A conexão do app (lib/prisma) é criada na primeira importação, lendo DATABASE_URL.
    process.env.DATABASE_URL = banco.db.url;
    const { buildApp } = await import("../../../app.js");
    const { prisma } = await import("../../../lib/prisma.js");
    const app = await buildApp({
      lab: { ia: new IaFalsa(), config: configDeTeste(config), agora: new RelogioFalso().agora }
    });

    // O fixture cria o perfil COMUM; os demais perfis entram aqui.
    const papeis = { COMUM: banco.base.roleId } as Record<Papel, string>;
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

    const ambiente = new AmbienteDoCadastro(banco, app, papeis, () => prisma.$disconnect());
    const { rows } = await banco.db.client.query<{ companyId: string; unitId: string }>(
      `SELECT "companyId", "unitId" FROM "Operation" WHERE id = $1`,
      [banco.base.operationId]
    );
    ambiente.operacaoDaBase = {
      operationId: banco.base.operationId,
      companyId: rows[0]!.companyId,
      unitId: rows[0]!.unitId
    };
    return ambiente;
  }

  async encerrar(): Promise<void> {
    await this.app.close();
    await this.desligarPrisma();
    await encerrarBanco(this.banco);
  }

  consulta = (sql: string, params: unknown[] = []) =>
    this.banco.db.client.query(sql, params).then((r) => r.rows);

  /** Uma operação nova, com empresa, cliente e unidade próprias (logo, fora do escopo das outras). */
  async criarOperacao(nome: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE"): Promise<Operacao> {
    const client = this.banco.db.client;
    const agora = new Date().toISOString();
    const companyId = await inserir(client, '"Company"', {
      id: crypto.randomUUID(),
      name: `Empresa ${nome}`,
      updatedAt: agora
    });
    const clientId = await inserir(client, '"Client"', {
      id: crypto.randomUUID(),
      companyId,
      name: `Cliente ${nome}`,
      updatedAt: agora
    });
    const unitId = await inserir(client, '"Unit"', {
      id: crypto.randomUUID(),
      companyId,
      name: `Unidade ${nome}`,
      updatedAt: agora
    });
    const operationId = await inserir(client, '"Operation"', {
      id: crypto.randomUUID(),
      companyId,
      clientId,
      unitId,
      name: nome,
      status,
      updatedAt: agora
    });
    return { operationId, companyId, unitId };
  }

  /** Um usuário do perfil dado, com os escopos dados (nenhum = sem escopo algum). */
  async pessoa(
    papel: Papel,
    escopos: Escopo[] = [],
    extra: Record<string, unknown> = {}
  ): Promise<Pessoa> {
    const client = this.banco.db.client;
    const id = await criarUsuario(client, this.banco.base, {
      roleId: this.papeis[papel],
      ...extra
    });
    for (const escopo of escopos) {
      await inserir(client, '"UserScope"', {
        id: crypto.randomUUID(),
        userId: id,
        updatedAt: new Date().toISOString(),
        ...escopo
      });
    }
    return {
      id,
      token: createAccessToken({
        id,
        email: `${id}@teste.local`,
        name: "Pessoa",
        role: papel,
        scopes: []
      })
    };
  }

  /** O RH que enxerga tudo, e o que enxerga só a operação dada. */
  rhGlobal = () => this.pessoa("RH", [{ isGlobal: true }]);
  rhDaOperacao = (op: Operacao) =>
    this.pessoa("RH", [
      { companyId: op.companyId, operationId: op.operationId, unitId: op.unitId }
    ]);

  /** Um colaborador na operação dada (padrão: a do fixture). */
  colaborador(extra: Record<string, unknown> = {}, operacao?: Operacao): Promise<string> {
    return criarColaborador(this.banco.db.client, this.banco.base, {
      ...(operacao ? { operationId: operacao.operationId } : {}),
      ...extra
    });
  }

  /** Um usuário comum, ainda sem vínculo. */
  usuarioComum(extra: Record<string, unknown> = {}): Promise<Pessoa> {
    return this.pessoa("COMUM", [], extra);
  }

  async http(
    pessoa: Pessoa | null,
    metodo: Metodo,
    caminho: string,
    corpo?: unknown
  ): Promise<RespostaHttp> {
    const r = await this.app.inject({
      method: metodo,
      url: `${PREFIXO}${caminho}`,
      headers: pessoa ? { authorization: `Bearer ${pessoa.token}` } : {},
      ...(corpo !== undefined ? { payload: corpo as object } : {})
    });
    return { status: r.statusCode, corpo: r.body ? r.json() : null };
  }

  /** Liga um usuário a um colaborador direto no banco (sem passar pela API). */
  async vincular(userId: string, employeeId: string, ativo = true): Promise<string> {
    return inserir(this.banco.db.client, "leadership_lab.participante", {
      user_id: userId,
      employee_id: employeeId,
      ativo
    });
  }

  auditoria(entidade: string, entidadeId: string) {
    return this.consulta(
      `SELECT action, "userId", "userRole", "operationId", before, after
         FROM "AuditLog" WHERE entity = $1 AND "entityId" = $2 ORDER BY "createdAt", id`,
      [entidade, entidadeId]
    );
  }
}
