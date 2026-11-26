// Assistente de suporte do MY FLUX (motor.suporte). PostgreSQL real; exige LAB_TEST_DATABASE_URL
// (sem ela, é ignorado).
import type { LabAtor } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { type Banco, encerrarBanco, novoCenario, prepararBanco } from "./cenario-de-teste.js";
import { RESPOSTA_DO_SUPORTE_BLOQUEADA } from "./motor.js";

const ENTRADA = {
  mensagem: "Como gero a escala?",
  historico: [],
  pagina: { caminho: "/escalas", titulo: "Escalas" }
};

describe.skipIf(!integrationEnabled)("assistente de suporte", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  /** O usuário autenticado correspondente ao ator (perfil e id), sem escopo: só o perfil importa aqui. */
  const usuarioDe = (a: LabAtor) =>
    ({
      id: a.userId,
      email: "a@b.c",
      name: "Pessoa",
      role: a.role,
      scopes: []
    }) as AuthenticatedUser;

  const semVinculo = (role: LabAtor["role"]): LabAtor => ({
    userId: crypto.randomUUID(),
    role,
    participanteId: null,
    permissoes: []
  });

  it("qualquer perfil usa, mesmo sem vínculo com o Lab; manda o perfil e a tela, e registra o consumo", async () => {
    const c = await novoCenario(banco);
    for (const role of ["RH", "ADMIN", "DEV", "COMUM"] as const) {
      expect(await c.motor.suporte(semVinculo(role), usuarioDe(semVinculo(role)), ENTRADA)).toEqual(
        {
          desfecho: "respondida",
          resposta: "Resposta do suporte falso."
        }
      );
    }
    const corpos = c.ia.corposPorAlvo.suporte.map((c) => JSON.parse(c));
    // O COMUM vai com escopo "lab" (a IA só recebe o guia do Leadership Lab); os demais, sem limite.
    expect(corpos.at(-1)).toEqual({
      mensagem: "Como gero a escala?",
      historico: [],
      perfil: "COMUM",
      pagina: { caminho: "/escalas", titulo: "Escalas" },
      escopo: "lab"
    });
    for (const corpo of corpos.slice(0, -1)) expect(corpo).not.toHaveProperty("escopo");
    const logs = await consulta(
      "SELECT count(*)::int AS n FROM leadership_lab.log_ia WHERE agente = 'suporte' AND sucesso"
    );
    expect(logs[0].n).toBeGreaterThanOrEqual(4);
  });

  it("a mensagem bloqueada pela Guarda não chega à IA", async () => {
    const c = await novoCenario(banco);
    c.ia.decisaoDaGuarda = "bloquear";
    expect(await c.motor.suporte(semVinculo("RH"), usuarioDe(semVinculo("RH")), ENTRADA)).toEqual({
      desfecho: "bloqueada",
      resposta: RESPOSTA_DO_SUPORTE_BLOQUEADA
    });
    expect(c.ia.chamadas.suporte).toBe(0);
  });

  it("com um teste em andamento, o participante não recebe ajuda", async () => {
    const c = await novoCenario(banco);
    await c.motor.iniciar(c.ator);
    await expect(c.motor.suporte(c.ator, usuarioDe(c.ator), ENTRADA)).rejects.toMatchObject({
      statusCode: 409,
      code: "SUPORTE_DURANTE_O_TESTE"
    });
    expect(c.ia.chamadas.suporte).toBe(0);
  });

  it("falha da IA vira 502 e fica no log como falha", async () => {
    const c = await novoCenario(banco);
    c.ia.falharNa("suporte", "erro");
    await expect(
      c.motor.suporte(semVinculo("RH"), usuarioDe(semVinculo("RH")), ENTRADA)
    ).rejects.toMatchObject({
      statusCode: 502
    });
  });

  it("respeita o teto de mensagens por hora, por usuário", async () => {
    const c = await novoCenario(banco, { config: { limiteConversasHora: 2 } });
    const ator = semVinculo("RH");
    await c.motor.suporte(ator, usuarioDe(ator), ENTRADA);
    await c.motor.suporte(ator, usuarioDe(ator), ENTRADA);
    await expect(c.motor.suporte(ator, usuarioDe(ator), ENTRADA)).rejects.toMatchObject({
      statusCode: 429
    });
    // Outro usuário tem a sua cota.
    await expect(
      c.motor.suporte(semVinculo("RH"), usuarioDe(semVinculo("RH")), ENTRADA)
    ).resolves.toBeTruthy();
  });
});
