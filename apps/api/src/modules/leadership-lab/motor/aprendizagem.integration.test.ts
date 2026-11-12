// Motor: o espaço de aprendizagem (facilitador fora do teste), contra PostgreSQL real e IA falsa.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import type { LabAtor } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import {
  type Banco,
  type Cenario,
  encerrarBanco,
  jogar,
  novoCenario,
  prepararBanco
} from "./cenario-de-teste.js";
import { RESPOSTA_BLOQUEADA } from "./conversa.js";

describe.skipIf(!integrationEnabled)("motor: espaço de aprendizagem", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const perguntar = (c: Cenario, mensagem = "O que é feedback?") =>
    c.motor.aprender(c.ator, { mensagem });
  const corpoEnviado = (c: Cenario, i = 0) =>
    JSON.parse(c.ia.corposPorAlvo.conversa[i]!) as Record<string, unknown>;

  it("responde no modo aprendizagem, sem resultado, com o contexto do cargo e as fontes", async () => {
    const c = await novoCenario(banco);
    c.ia.respostaDaConversa = "Feedback é informação para melhorar.";
    c.ia.fontesDaConversa = [
      {
        id: "sebrae-escuta-ativa",
        titulo: "Escuta ativa",
        instituicao: "Sebrae",
        tipo: "material_educacional",
        url: null,
        validada: false
      }
    ];
    const r = await perguntar(c);
    expect(r).toMatchObject({
      desfecho: "respondida",
      resposta: "Feedback é informação para melhorar."
    });
    expect(r.fontes.map((f) => f.id)).toEqual(["sebrae-escuta-ativa"]);

    const corpo = corpoEnviado(c);
    expect(corpo).toMatchObject({ modo: "aprendizagem", molde: "supervisor", resultado: null });
    expect(corpo.contexto).toMatchObject({ rubrica_versao: expect.any(String), perfil: null });
    expect(c.ia.chamadas.guarda).toBe(1);
  });

  it("não grava a conversa: só metadados em log_ia, sem sessão", async () => {
    const c = await novoCenario(banco);
    await perguntar(c, "Como dar um feedback difícil?");
    const linhas = await banco.prisma.labLogIa.findMany({
      where: { agente: "facilitador", sessaoId: null },
      orderBy: { criadoEm: "desc" },
      take: 1
    });
    expect(linhas[0]).toMatchObject({ sucesso: true, modelo: "modelo-falso" });
    expect(JSON.stringify(linhas[0])).not.toContain("feedback");
  });

  it("com um teste em andamento, recusa e a IA não é chamada (nada de pista durante o teste)", async () => {
    const c = await novoCenario(banco);
    await c.motor.iniciar(c.ator);
    await expect(perguntar(c)).rejects.toMatchObject({
      statusCode: 409,
      code: "LAB_APRENDIZAGEM_BLOQUEADA"
    });
    expect(c.ia.chamadas.conversa).toBe(0);
    expect(c.ia.chamadas.guarda).toBe(0);
  });

  it("depois de concluir o teste, volta a responder; o perfil individual vai resumido, sem identificação", async () => {
    const c = await novoCenario(banco);
    await jogar(c, ["C", "C", "C", "C", "C"]);
    await perguntar(c);
    const enviado = c.ia.corposPorAlvo.conversa[0]!;
    const corpo = JSON.parse(enviado) as { contexto: { perfil: { skills: unknown[] } | null } };
    expect(corpo.contexto.perfil?.skills.length).toBeGreaterThan(0);
    for (const proibido of [
      c.ctx.userId,
      c.ctx.participanteId,
      "@",
      "matricula",
      "tempo_resposta"
    ]) {
      expect(enviado.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });

  it("o perfil de um participante nunca aparece na conversa de outro", async () => {
    const a = await novoCenario(banco);
    await jogar(a, ["C", "C", "C", "C", "C"]);
    const b = await novoCenario(banco);
    await perguntar(b);
    expect((corpoEnviado(b).contexto as { perfil: unknown }).perfil).toBeNull();
  });

  it("limite por hora: depois do teto recusa com 429, e a janela libera com o tempo", async () => {
    const c = await novoCenario(banco, { config: { limiteConversasHora: 2 } });
    await perguntar(c);
    await perguntar(c);
    await expect(perguntar(c)).rejects.toMatchObject({
      statusCode: 429,
      code: "LAB_CONVERSA_LIMITE"
    });
    expect(c.ia.chamadas.conversa).toBe(2);
    c.relogio.avancar(3_600_001);
    await expect(perguntar(c)).resolves.toMatchObject({ desfecho: "respondida" });
  });

  it("o limite de um participante não consome o de outro", async () => {
    const a = await novoCenario(banco, { config: { limiteConversasHora: 1 } });
    const b = await novoCenario(banco, { config: { limiteConversasHora: 1 } });
    await perguntar(a);
    await expect(perguntar(b)).resolves.toMatchObject({ desfecho: "respondida" });
  });

  it("a Guarda bloqueia ou cai: falha fechada, nada vai à IA", async () => {
    const c = await novoCenario(banco);
    c.ia.decisaoDaGuarda = "bloquear";
    expect(await perguntar(c, "Meu CPF é 123")).toEqual({
      desfecho: "bloqueada",
      resposta: RESPOSTA_BLOQUEADA,
      fontes: []
    });
    c.ia.decisaoDaGuarda = "seguir";
    c.ia.falharNa("guarda", "erro");
    expect((await perguntar(c)).desfecho).toBe("bloqueada");
    expect(c.ia.chamadas.conversa).toBe(0);
  });

  it("falha do facilitador vira erro de IA recuperável e é registrada; depois tenta de novo", async () => {
    const c = await novoCenario(banco);
    c.ia.falharNa("conversa", "erro");
    await expect(perguntar(c)).rejects.toMatchObject({ code: "LAB_IA_INDISPONIVEL" });
    const falhas = await banco.prisma.labLogIa.count({
      where: { agente: "facilitador", sucesso: false, sessaoId: null }
    });
    expect(falhas).toBeGreaterThan(0);
    await expect(perguntar(c)).resolves.toMatchObject({ desfecho: "respondida" });
  });

  it("resposta fora do contrato é recusada, não repassada", async () => {
    const c = await novoCenario(banco);
    c.ia.falharNa("conversa", "invalida");
    await expect(perguntar(c)).rejects.toMatchObject({ code: "LAB_IA_RESPOSTA_INVALIDA" });
  });

  it("permissões: curador/RH não usam o espaço; sem cargo ou mapeamento, mensagem clara", async () => {
    const c = await novoCenario(banco);
    const curador: LabAtor = {
      userId: c.ctx.userId,
      role: "RH",
      participanteId: null,
      permissoes: []
    };
    await expect(c.motor.aprender(curador, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 403
    });
    const semCargo = await novoCenario(banco, { nivel: null });
    await expect(perguntar(semCargo)).rejects.toMatchObject({ statusCode: expect.any(Number) });
    expect(semCargo.ia.chamadas.conversa).toBe(0);
  });

  it("entrada fora do formato (campo extra, mensagem vazia ou longa) é recusada antes da IA", async () => {
    const c = await novoCenario(banco);
    for (const entrada of [
      { mensagem: "" },
      { mensagem: "x".repeat(501) },
      { mensagem: "Oi", participante_id: c.ctx.participanteId }
    ]) {
      await expect(c.motor.aprender(c.ator, entrada)).rejects.toThrow();
    }
    expect(c.ia.chamadas.guarda).toBe(0);
  });
});
