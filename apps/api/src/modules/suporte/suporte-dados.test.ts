// O assistente de suporte e os dados de pessoas: quem pode, o que recebe e como a consulta é limitada.
// Unitário, com um "banco" falso: confere as consultas montadas (escopo, limite, campos), sem Postgres.
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { IaFalsa } from "../leadership-lab/motor/ia-falsa.js";
import { configDeTeste } from "../leadership-lab/motor/cenario-de-teste.js";
import { MotorDoTeste } from "../leadership-lab/motor/motor.js";
import {
  LIMITE_MAXIMO,
  RESPOSTA_FORA_DO_ESCOPO,
  consultarDados,
  podeConsultarDados
} from "./suporte-dados.js";

const usuario = (role: AuthenticatedUser["role"], escopo: AuthenticatedUser["scopes"] = []) =>
  ({ id: `u-${role}`, email: "a@b.c", name: "Pessoa", role, scopes: escopo }) as AuthenticatedUser;

const global = [{ isGlobal: true }] as AuthenticatedUser["scopes"];
const daOperacao = [{ isGlobal: false, operationId: "op-1" }] as AuthenticatedUser["scopes"];

function bancoFalso() {
  return {
    employee: {
      groupBy: vi.fn().mockResolvedValue([
        { status: "ACTIVE", _count: { _all: 8 } },
        { status: "ON_LEAVE", _count: { _all: 1 } },
        { status: "TERMINATED", _count: { _all: 3 } }
      ]),
      findMany: vi.fn().mockResolvedValue([
        { operationId: "op-1", functionId: "f-1", shift: "DIURNO" },
        { operationId: "op-1", functionId: "f-1", shift: "NOTURNO" },
        { operationId: "op-1", functionId: null, shift: "DIURNO" }
      ]),
      count: vi.fn().mockResolvedValue(3)
    },
    operation: { findMany: vi.fn().mockResolvedValue([{ id: "op-1", name: "Operação Norte" }]) },
    jobFunction: { findMany: vi.fn().mockResolvedValue([{ id: "f-1", name: "Técnico" }]) },
    calendarEvent: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([]) },
    scheduleVersion: { findMany: vi.fn().mockResolvedValue([]) },
    labLogIa: { create: vi.fn().mockResolvedValue({}) }
  };
}
type BancoFalso = ReturnType<typeof bancoFalso>;
const comoDb = (b: BancoFalso) => b as unknown as PrismaClient;

describe("quem pode consultar dados de pessoas", () => {
  it("só DEV, ADMIN e RH", () => {
    expect(podeConsultarDados("DEV")).toBe(true);
    expect(podeConsultarDados("ADMIN")).toBe(true);
    expect(podeConsultarDados("RH")).toBe(true);
    expect(podeConsultarDados("COMUM")).toBe(false);
    expect(podeConsultarDados("")).toBe(false);
  });
});

describe("consultarDados", () => {
  it("resumo: soma só ativos, afastados e férias como vinculados, e traz o detalhe por situação", async () => {
    const b = bancoFalso();
    const r = await consultarDados(comoDb(b), usuario("RH", global), "resumo_colaboradores", null);
    expect(r.colaboradores_vinculados).toBe(3);
    expect(r.por_situacao).toEqual({ ativos: 8, afastados: 1, desligados: 3 });
    expect(r.por_operacao).toEqual([{ nome: "Operação Norte", colaboradores: 3 }]);
    expect(r.por_funcao).toEqual([
      { nome: "Técnico", colaboradores: 2 },
      { nome: "Sem função", colaboradores: 1 }
    ]);
  });

  it("toda consulta de pessoas leva o escopo do usuário (o RH de uma operação não vê as outras)", async () => {
    const b = bancoFalso();
    b.employee.findMany.mockResolvedValue([]);
    await consultarDados(comoDb(b), usuario("RH", daOperacao), "desligados_recentes", 5);
    const onde = b.employee.findMany.mock.calls[0]![0].where;
    expect(onde.status).toBe("TERMINATED");
    expect(onde.operation.OR[0]).toMatchObject({ id: "op-1" });
    // O DEV (e quem tem escopo global) não é limitado a uma operação.
    const g = bancoFalso();
    g.employee.findMany.mockResolvedValue([]);
    await consultarDados(comoDb(g), usuario("DEV", global), "desligados_recentes", 5);
    expect(g.employee.findMany.mock.calls[0]![0].where.operation.OR).toBeUndefined();
  });

  it("desligados: do mais recente ao mais antigo, só os campos necessários, com limite", async () => {
    const b = bancoFalso();
    b.employee.findMany.mockResolvedValue([
      {
        name: "Ana Souza",
        terminationDate: new Date("2026-11-10T00:00:00Z"),
        function: { name: "Técnico" },
        operation: { name: "Operação Norte" }
      },
      {
        name: "Bruno Lima",
        terminationDate: null,
        function: null,
        operation: { name: "Operação Sul" }
      }
    ]);
    const r = await consultarDados(comoDb(b), usuario("ADMIN", global), "desligados_recentes", 99);
    const chamada = b.employee.findMany.mock.calls[0]![0];
    expect(chamada.take).toBe(LIMITE_MAXIMO);
    expect(chamada.orderBy[0]).toEqual({ terminationDate: { sort: "desc", nulls: "last" } });
    expect(Object.keys(chamada.select).sort()).toEqual([
      "function",
      "name",
      "operation",
      "terminationDate"
    ]);
    expect(r.total_de_desligados_no_cadastro).toBe(3);
    expect(r.itens).toEqual([
      {
        nome: "Ana Souza",
        funcao: "Técnico",
        operacao: "Operação Norte",
        ultimo_dia_de_trabalho: "2026-11-10"
      },
      { nome: "Bruno Lima", funcao: null, operacao: "Operação Sul", ultimo_dia_de_trabalho: null }
    ]);
  });

  it("o limite pedido é respeitado entre 1 e o máximo", async () => {
    const b = bancoFalso();
    b.employee.findMany.mockResolvedValue([]);
    await consultarDados(comoDb(b), usuario("RH", global), "admissoes_recentes", 0);
    expect(b.employee.findMany.mock.calls[0]![0].take).toBe(1);
  });

  it("afastamentos em curso: só os que cobrem hoje, de colaboradores do escopo", async () => {
    const b = bancoFalso();
    const agora = new Date("2026-11-19T12:00:00Z");
    b.calendarEvent.findMany.mockResolvedValue([
      {
        title: "Férias",
        startsAt: new Date("2026-11-10T00:00:00Z"),
        endsAt: new Date("2026-11-25T00:00:00Z"),
        employee: { name: "Carla Dias", operation: { name: "Operação Norte" } }
      }
    ]);
    const r = await consultarDados(
      comoDb(b),
      usuario("RH", daOperacao),
      "afastamentos_atuais",
      5,
      agora
    );
    const onde = b.calendarEvent.findMany.mock.calls[0]![0].where;
    expect(onde.startsAt).toEqual({ lte: agora });
    expect(onde.endsAt).toEqual({ gte: agora });
    expect(onde.employee.is.operation.OR[0]).toMatchObject({ id: "op-1" });
    expect(r.itens).toEqual([
      {
        nome: "Carla Dias",
        operacao: "Operação Norte",
        motivo: "Férias",
        de: "2026-11-10",
        ate: "2026-11-25"
      }
    ]);
  });

  it("escalas recentes: situação em português (e nada do dimensionamento do QLP, que está oculto)", async () => {
    const b = bancoFalso();
    b.scheduleVersion.findMany.mockResolvedValue([
      {
        version: 2,
        month: new Date("2026-11-01T00:00:00Z"),
        status: "IN_REVIEW",
        createdAt: new Date("2026-11-05T10:00:00Z"),
        operation: { name: "Operação Norte" }
      },
      {
        version: 1,
        month: new Date("2026-10-01T00:00:00Z"),
        status: "PUBLISHED",
        createdAt: new Date("2026-10-02T10:00:00Z"),
        operation: { name: "Operação Norte" }
      }
    ]);
    const r = await consultarDados(comoDb(b), usuario("ADMIN", global), "escalas_recentes", 5);
    expect(r.itens).toMatchObject([
      { mes: "2026-11", situacao: "em_aprovacao" },
      { mes: "2026-10", situacao: "publicada" }
    ]);
    for (const item of r.itens as object[])
      expect(Object.keys(item)).not.toContain("cobertura_percentual");
  });
});

describe("motor.suporte: o assistente com dados", () => {
  const ENTRADA = (mensagem: string) => ({
    mensagem,
    historico: [],
    pagina: { caminho: "/colaboradores", titulo: "Colaboradores" }
  });
  const ator = (role: AuthenticatedUser["role"]) => ({
    userId: `u-${role}`,
    role,
    participanteId: null,
    permissoes: []
  });
  const aviso = { warn: vi.fn(), info: vi.fn() };

  function montar(
    consulta: "desligados_recentes" | "resumo_colaboradores" | null = "desligados_recentes"
  ) {
    const b = bancoFalso();
    b.employee.findMany.mockResolvedValue([
      {
        name: "Ana Souza",
        terminationDate: new Date("2026-11-10T00:00:00Z"),
        function: { name: "Técnico" },
        operation: { name: "Operação Norte" }
      }
    ]);
    const ia = new IaFalsa();
    ia.consultaDoSuporte = consulta;
    ia.respostaDoSuporte = "Segundo o cadastro";
    const motor = new MotorDoTeste({ db: comoDb(b), ia, config: configDeTeste(), logger: aviso });
    return { b, ia, motor };
  }

  it("RH com escopo: a IA pede a consulta, a API executa e a segunda chamada leva os dados", async () => {
    const { b, ia, motor } = montar();
    const resposta = await motor.suporte(
      ator("RH"),
      usuario("RH", daOperacao),
      ENTRADA("Quem foi desligado recentemente?")
    );
    expect(resposta.desfecho).toBe("respondida");
    expect(resposta.resposta).toContain("Segundo o cadastro");
    expect(resposta.resposta).toContain("Ana Souza");
    expect(ia.chamadas.suporte).toBe(2);
    const segundo = JSON.parse(ia.corposPorAlvo.suporte[1]!);
    expect(segundo.dados.consulta).toBe("desligados_recentes");
    expect(b.employee.findMany.mock.calls[0]![0].where.operation.OR[0]).toMatchObject({
      id: "op-1"
    });
    // Rastro de quem consultou o quê, sem o conteúdo.
    expect(aviso.info).toHaveBeenCalledWith(
      { userId: "u-RH", perfil: "RH", consulta: "desligados_recentes" },
      "suporte: consulta de dados"
    );
  });

  it.each(["ADMIN", "DEV"] as const)("%s também recebe os dados", async (perfil) => {
    const { motor } = montar();
    const r = await motor.suporte(ator(perfil), usuario(perfil, global), ENTRADA("Quem saiu?"));
    expect(r.desfecho).toBe("respondida");
    expect(r.resposta).toContain("Ana Souza");
  });

  it("perfil COMUM: recusa com a mensagem fixa, não consulta o banco e a IA não vê nada", async () => {
    const { b, ia, motor } = montar();
    const r = await motor.suporte(
      ator("COMUM"),
      usuario("COMUM", daOperacao),
      ENTRADA("Quantos funcionários temos?")
    );
    // O COMUM só conversa sobre o Leadership Lab: a pergunta de dados é "fora do escopo".
    expect(r).toEqual({ desfecho: "fora_do_escopo", resposta: RESPOSTA_FORA_DO_ESCOPO });
    expect(r.resposta).toMatch(/RH/);
    expect(ia.chamadas.suporte).toBe(1);
    expect(b.employee.findMany).not.toHaveBeenCalled();
    expect(b.employee.groupBy).not.toHaveBeenCalled();
    expect(b.employee.count).not.toHaveBeenCalled();
  });

  it("pergunta de uso (sem dados) é respondida na primeira chamada, para qualquer perfil", async () => {
    const { ia, motor } = montar(null);
    const r = await motor.suporte(ator("COMUM"), usuario("COMUM"), ENTRADA("Como gero a escala?"));
    expect(r.desfecho).toBe("respondida");
    expect(ia.chamadas.suporte).toBe(1);
  });

  it("falha ao consultar o banco: resposta amigável, sem expor o erro", async () => {
    const { b, motor } = montar();
    b.employee.findMany.mockRejectedValue(new Error("connection refused 10.0.0.5"));
    const r = await motor.suporte(ator("RH"), usuario("RH", global), ENTRADA("Quem saiu?"));
    expect(r.resposta).toBe(
      "Não consegui consultar esses dados agora. Tente de novo em instantes."
    );
    expect(r.resposta).not.toMatch(/10\.0\.0\.5|connection/);
  });

  it("a IA fora do ar: 502; ADMIN e DEV recebem o motivo técnico, os demais não", async () => {
    const { ia, motor } = montar(null);
    ia.falharNa("suporte", "erro", 3);
    await expect(
      motor.suporte(ator("ADMIN"), usuario("ADMIN", global), ENTRADA("Oi"))
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "SUPORTE_IA_INDISPONIVEL",
      details: { falha: "TRANSPORTE" }
    });
    await expect(
      motor.suporte(ator("RH"), usuario("RH", global), ENTRADA("Oi"))
    ).rejects.toMatchObject({
      statusCode: 502
    });
    const erro = await motor
      .suporte(ator("COMUM"), usuario("COMUM"), ENTRADA("Oi"))
      .catch((e: unknown) => e);
    expect((erro as { details?: object }).details).not.toHaveProperty("motivo");
  });

  it("o estado do serviço: ok sem sonda, desatualizado sem o agente, indisponível se não responde", async () => {
    const { ia, motor } = montar(null);
    expect((await motor.estadoDoSuporte()).estado).toBe("ok");
    ia.saude = async () => ({ servico: "lab-ia", versao_instrucao: "v1" });
    expect(await motor.estadoDoSuporte()).toMatchObject({ estado: "desatualizado", versao: "v1" });
    ia.saude = async () => ({
      versao_instrucao: "v2",
      agentes: ["facilitador", "suporte"],
      recursos_suporte: ["escopo", "pessoa", "meus_resultados", "fora_do_escopo"]
    });
    expect(await motor.estadoDoSuporte()).toMatchObject({ estado: "ok", versao: "v2" });
    ia.saude = async () => {
      throw new Error("a IA respondeu HTTP 503");
    };
    expect(await motor.estadoDoSuporte()).toMatchObject({
      estado: "indisponivel",
      detalhe: "a IA respondeu HTTP 503"
    });
  });
});
