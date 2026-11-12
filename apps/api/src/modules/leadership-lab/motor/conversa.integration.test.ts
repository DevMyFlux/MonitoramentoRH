// Motor: a conversa com o facilitador, contra PostgreSQL real e a IA falsa.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import { type LabAtor, labConversaLimites } from "@my-flux/shared";
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
import type { RespostaDoTeste } from "./visoes.js";

function sessaoDe(respostas: RespostaDoTeste[]): string {
  return (respostas.at(-1) as RespostaDoTeste).sessaoId;
}

describe.skipIf(!integrationEnabled)("motor do teste: conversa com o facilitador", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  async function concluido(): Promise<{ c: Cenario; sessaoId: string }> {
    const c = await novoCenario(banco);
    const respostas = await jogar(c, ["A", "B", "C", "B", "A"]);
    return { c, sessaoId: sessaoDe(respostas) };
  }

  const perguntar = (c: Cenario, sessaoId: string, entrada: unknown) =>
    c.motor.conversar(c.ator, sessaoId, entrada);

  it("responde sobre o resultado e só manda à IA o que o participante já viu", async () => {
    const { c, sessaoId } = await concluido();
    c.ia.respostaDaConversa = "Você foi bem na comunicação.";

    const r = await perguntar(c, sessaoId, { mensagem: "Como fui no geral?" });
    expect(r).toEqual({
      desfecho: "respondida",
      resposta: "Você foi bem na comunicação.",
      fontes: []
    });

    const enviado = c.ia.corposPorAlvo.conversa[0]!;
    const corpo = JSON.parse(enviado) as Record<string, unknown>;
    expect(corpo.molde).toBe("supervisor");
    expect(corpo.mensagem).toBe("Como fui no geral?");
    // Nada de nota nem de tempo do participante. (A régua pública da rubrica, igual para todos, tem
    // a palavra "aderencia" no contexto: por isso a nota é procurada só no resultado.)
    expect(JSON.stringify(corpo.resultado).toLowerCase()).not.toContain("aderencia");
    // Nada de identificação nem de tempos.
    for (const proibido of [
      "tempo_resposta",
      "participante",
      "matricula",
      "email",
      "@",
      c.ctx.userId,
      c.ctx.participanteId
    ]) {
      expect(enviado.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
    // A mensagem passou pela Guarda antes de ir.
    expect(c.ia.chamadas.guarda).toBe(1);
  });

  it("guarda só metadados da chamada em log_ia, nunca o texto da conversa", async () => {
    const { c, sessaoId } = await concluido();
    await perguntar(c, sessaoId, { mensagem: "Qual foi o meu ponto forte?" });
    const linhas = await banco.prisma.labLogIa.findMany({
      where: { sessaoId, agente: "facilitador" }
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ sucesso: true, modelo: "modelo-falso" });
    expect(JSON.stringify(linhas[0])).not.toContain("ponto forte");
  });

  it("antes de o teste terminar, recusa", async () => {
    const c = await novoCenario(banco);
    const aberto = await c.motor.iniciar(c.ator);
    await expect(perguntar(c, aberto.sessaoId, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 409,
      code: "LAB_TESTE_EM_ANDAMENTO"
    });
    expect(c.ia.chamadas.conversa).toBe(0);
  });

  it("o teste de outra pessoa responde como se não existisse; quem não é participante é barrado", async () => {
    const { sessaoId } = await concluido();
    const outro = await novoCenario(banco);
    await expect(perguntar(outro, sessaoId, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 404
    });
    const curador: LabAtor = {
      userId: outro.ctx.userId,
      role: "RH",
      participanteId: null,
      permissoes: []
    };
    await expect(
      outro.motor.conversar(curador, sessaoId, { mensagem: "Oi" })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(outro.ia.chamadas.conversa).toBe(0);
  });

  it("a Guarda bloqueia: aviso fixo e nada vai para a IA", async () => {
    const { c, sessaoId } = await concluido();
    c.ia.decisaoDaGuarda = "bloquear";
    const r = await perguntar(c, sessaoId, { mensagem: "Meu CPF é 123" });
    expect(r).toEqual({ desfecho: "bloqueada", resposta: RESPOSTA_BLOQUEADA, fontes: [] });
    expect(c.ia.chamadas.conversa).toBe(0);
  });

  it("a Guarda cai: falha fechada, mensagem bloqueada", async () => {
    const { c, sessaoId } = await concluido();
    c.ia.falharNa("guarda", "erro");
    const r = await perguntar(c, sessaoId, { mensagem: "Oi" });
    expect(r.desfecho).toBe("bloqueada");
    expect(c.ia.chamadas.conversa).toBe(0);
  });

  it("a Guarda mascara: a IA recebe só o texto mascarado", async () => {
    const { c, sessaoId } = await concluido();
    c.ia.decisaoDaGuarda = "mascarar";
    await perguntar(c, sessaoId, { mensagem: "João Silva da matrícula 123 errou comigo" });
    const corpo = JSON.parse(c.ia.corposPorAlvo.conversa[0]!) as { mensagem: string };
    expect(corpo.mensagem).toBe("[mascarado] João Silva da");
    expect(c.ia.corposPorAlvo.conversa[0]).not.toContain("matrícula 123");
  });

  it("as mensagens antigas do participante também passam pela Guarda; as bloqueadas somem do histórico", async () => {
    const { c, sessaoId } = await concluido();
    c.ia.decisaoDaGuarda = "mascarar";
    await perguntar(c, sessaoId, {
      mensagem: "E agora?",
      historico: [
        { papel: "participante", texto: "Telefone 11 99999-0000" },
        { papel: "facilitador", texto: "Posso ajudar com o resultado." }
      ]
    });
    expect(c.ia.chamadas.guarda).toBe(2);
    const corpo = JSON.parse(c.ia.corposPorAlvo.conversa[0]!) as {
      historico: Array<{ papel: string; texto: string }>;
    };
    expect(corpo.historico[0]!.texto).toBe("[mascarado] Telefone 11 99999-0000");
    expect(corpo.historico[1]).toEqual({
      papel: "facilitador",
      texto: "Posso ajudar com o resultado."
    });
  });

  it("recusa campo a mais e mensagem grande demais, sem chamar a IA", async () => {
    const { c, sessaoId } = await concluido();
    await expect(perguntar(c, sessaoId, { mensagem: "Oi", aderencia: 100 })).rejects.toThrow();
    await expect(
      perguntar(c, sessaoId, { mensagem: "x".repeat(labConversaLimites.mensagem + 1) })
    ).rejects.toThrow();
    await expect(perguntar(c, sessaoId, { mensagem: "   " })).rejects.toThrow();
    expect(c.ia.chamadas.conversa).toBe(0);
  });

  it("a IA fora do ar ou fora do contrato: 502, e a falha entra no log", async () => {
    const { c, sessaoId } = await concluido();
    c.ia.falharNa("conversa", "erro");
    await expect(perguntar(c, sessaoId, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 502,
      code: "LAB_IA_INDISPONIVEL"
    });
    c.ia.falharNa("conversa", "invalida");
    await expect(perguntar(c, sessaoId, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 502,
      code: "LAB_IA_RESPOSTA_INVALIDA"
    });
    const falhas = await banco.prisma.labLogIa.count({
      where: { sessaoId, agente: "facilitador", sucesso: false }
    });
    expect(falhas).toBe(2);
  });

  it("há um teto de mensagens por teste", async () => {
    const { c, sessaoId } = await concluido();
    await banco.prisma.labLogIa.createMany({
      data: Array.from({ length: labConversaLimites.mensagensPorTeste }, () => ({
        agente: "facilitador",
        versaoInstrucao: "falsa-1",
        modelo: "modelo-falso",
        latenciaMs: 1,
        sucesso: true,
        sessaoId
      }))
    });
    await expect(perguntar(c, sessaoId, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 429,
      code: "LAB_CONVERSA_LIMITE"
    });
    expect(c.ia.chamadas.conversa).toBe(0);
  });
});
