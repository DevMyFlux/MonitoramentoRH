// Notificações do curador, de ponta a ponta: aplicativo real, JWT real, PostgreSQL real e
// participantes que jogam de verdade (motor + IA falsa). Exige LAB_TEST_DATABASE_URL.
import { type LabNotificacoes, labNotificacoesSchema } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pessoa } from "../cadastro/ambiente-do-cadastro.js";
import { integrationEnabled } from "../db/test-database.js";
import { AmbienteDaCuradoria, roteiroComAlertaNa } from "./ambiente-da-curadoria.js";

describe.skipIf(!integrationEnabled)("notificações do curador", () => {
  let amb: AmbienteDaCuradoria;

  beforeAll(async () => {
    amb = await AmbienteDaCuradoria.subir();
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  const listar = async (quem: Pessoa): Promise<LabNotificacoes> => {
    const r = await amb.http(quem, "GET", "/notificacoes");
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return labNotificacoesSchema.parse(r.corpo.data);
  };
  const marcar = async (quem: Pessoa, corpo: unknown): Promise<LabNotificacoes> => {
    const r = await amb.http(quem, "POST", "/notificacoes/leitura", corpo);
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return labNotificacoesSchema.parse(r.corpo.data);
  };

  it("traz o resultado e o alerta do participante da turma, com origem e destino", async () => {
    const rh = await amb.curador();
    const p = await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(2) });
    await amb.turmaCom(rh, [p]);

    const lista = await listar(rh);
    const chaves = lista.itens.map((i) => i.chave);
    expect(chaves).toContain(`resultado:${p.resultadoId}`);
    const resultado = lista.itens.find((i) => i.tipo === "resultado")!;
    expect(resultado.destino).toBe(`/lab/rh/revisao/${p.resultadoId}`);
    expect(resultado.origem.participante).toBeTruthy();
    const alerta = lista.itens.find((i) => i.tipo === "alerta")!;
    expect(alerta).toMatchObject({
      prioridade: "urgente",
      destino: "/lab/rh/alertas",
      lida: false
    });
    expect(lista.naoLidas).toBe(lista.itens.length);
    expect(new Set(chaves).size).toBe(chaves.length); // sem duplicatas
  });

  it("não mostra nada de participantes de turmas de outro curador", async () => {
    const dono = await amb.curador();
    const outro = await amb.curador();
    const p = await amb.participanteComTeste();
    await amb.turmaCom(dono, [p]);

    expect((await listar(outro)).itens).toEqual([]);
    // Nem consegue marcar a chave alheia: ela é ignorada, sem erro e sem efeito.
    await marcar(outro, { chaves: [`resultado:${p.resultadoId}`] });
    expect((await listar(dono)).itens.every((i) => !i.lida)).toBe(true);
  });

  it("marcar como lida é por usuário, idempotente e não duplica", async () => {
    const rh = await amb.curador();
    const p = await amb.participanteComTeste();
    await amb.turmaCom(rh, [p]);
    const chave = `resultado:${p.resultadoId}`;

    await marcar(rh, { chaves: [chave] });
    const depois = await marcar(rh, { chaves: [chave] });
    expect(depois.itens.find((i) => i.chave === chave)?.lida).toBe(true);
    const linhas = await amb.consulta(
      "SELECT 1 FROM leadership_lab.notificacao_leitura WHERE user_id = $1 AND chave = $2",
      [rh.id, chave]
    );
    expect(linhas).toHaveLength(1);
  });

  it("'todas' marca só o que o usuário enxerga; tratar o item o tira da lista", async () => {
    const rh = await amb.curador();
    const p = await amb.participanteComTeste();
    await amb.turmaCom(rh, [p]);

    const todas = await marcar(rh, { todas: true });
    expect(todas.naoLidas).toBe(0);

    const validacao = await amb.http(rh, "POST", `/resultados/${p.resultadoId}/validacao`, {});
    expect(validacao.status, JSON.stringify(validacao.corpo)).toBe(200);
    expect((await listar(rh)).itens.map((i) => i.chave)).not.toContain(
      `resultado:${p.resultadoId}`
    );
  });

  it("só o perfil de curador acessa; chave malformada é recusada", async () => {
    const participante = await amb.participanteComTeste();
    const comum = participante.pessoa;
    expect((await amb.http(comum, "GET", "/notificacoes")).status).toBe(403);
    expect((await amb.http(comum, "POST", "/notificacoes/leitura", { todas: true })).status).toBe(
      403
    );
    const rh = await amb.curador();
    const ruim = await amb.http(rh, "POST", "/notificacoes/leitura", { chaves: ["qualquer"] });
    expect(ruim.status).toBe(400);
  });
});
