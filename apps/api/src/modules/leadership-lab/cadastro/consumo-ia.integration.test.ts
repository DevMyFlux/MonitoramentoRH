// Consumo de IA, de ponta a ponta: aplicativo real, JWT real, PostgreSQL real.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Veja db/test-database.ts.
import { labConsumoDeIaSchema } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { criarParticipante, criarSessao, inserir } from "../db/test-fixtures.js";
import { AmbienteDoCadastro, type Pessoa } from "./ambiente-do-cadastro.js";

describe.skipIf(!integrationEnabled)("consumo de IA", () => {
  let amb: AmbienteDoCadastro;
  let admin: Pessoa;
  let rh: Pessoa;

  beforeAll(async () => {
    amb = await AmbienteDoCadastro.subir();
    admin = await amb.pessoa("ADMIN");
    rh = await amb.rhGlobal();
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  const log = (agente: string, sessaoId: string | null, extra: Record<string, unknown> = {}) =>
    inserir(amb.banco.db.client, "leadership_lab.log_ia", {
      agente,
      versao_instrucao: "v",
      modelo: "m",
      tokens_entrada: 1000,
      tokens_saida: 200,
      latencia_ms: 4000,
      sucesso: true,
      sessao_id: sessaoId,
      ...extra
    });

  it("só o administrador lê; soma por agente e só testes concluídos entram na média por teste", async () => {
    const cliente = amb.banco.db.client;
    const ctx = await criarParticipante(cliente, amb.banco.base);
    const concluida = await criarSessao(cliente, ctx, {
      status: "concluida",
      concluida_em: new Date(Date.now() + 60_000).toISOString()
    });
    await log("agente_lab", concluida);
    await log("agente_lab", concluida);
    await log("analista", concluida);
    await log("facilitador", null); // aprendizagem: sem teste
    await log("guarda", null, {
      sucesso: false,
      tokens_entrada: null,
      tokens_saida: null,
      codigo_erro: "TIMEOUT"
    });
    // fora da janela de 30 dias: não conta
    await log("agente_lab", concluida, {
      criado_em: new Date(Date.now() - 40 * 864e5).toISOString()
    });

    expect((await amb.http(rh, "GET", "/config/consumo-ia")).status).toBe(403);

    const r = await amb.http(admin, "GET", "/config/consumo-ia");
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    const consumo = labConsumoDeIaSchema.parse(r.corpo.data);
    expect(consumo.agentes.map((a) => [a.agente, a.chamadas, a.falhas, a.tokensEntrada])).toEqual([
      ["agente_lab", 2, 0, 2000],
      ["guarda", 1, 1, 0],
      ["analista", 1, 0, 1000],
      ["facilitador", 1, 0, 1000]
    ]);
    expect(consumo.testesConcluidos).toBe(1);
    expect(consumo.tokensPorTeste).toBe(3600);
    expect(consumo.custoEstimadoUsd).toBeNull(); // sem preço no ambiente de teste
    // nada além do contrato: nenhum identificador de sessão ou de pessoa
    expect(JSON.stringify(r.corpo)).not.toContain(concluida);
    expect(JSON.stringify(r.corpo)).not.toContain(ctx.participanteId);
  });
});
