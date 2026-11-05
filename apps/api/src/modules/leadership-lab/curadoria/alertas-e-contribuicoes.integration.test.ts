// Alertas e contribuições na curadoria, de ponta a ponta: aplicativo real, JWT real, PostgreSQL real
// e participantes que jogam de verdade (motor + IA falsa). Exige LAB_TEST_DATABASE_URL.
import { labAlertaDoCuradorSchema, labContribuicaoDoCuradorSchema } from "@my-flux/shared";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { roteiroPadrao } from "../motor/ia-falsa.js";
import { integrationEnabled } from "../db/test-database.js";
import type { Pessoa } from "../cadastro/ambiente-do-cadastro.js";
import {
  AmbienteDaCuradoria,
  type ParticipanteDaCuradoria,
  roteiroComAlertaNa
} from "./ambiente-da-curadoria.js";

const INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const SUGESTAO = "Sugiro um checklist de abertura do turno.";
const comContribuicao = {
  ...roteiroPadrao,
  contribuicao: (n: number) => (n === 1 ? SUGESTAO : null)
};

describe.skipIf(!integrationEnabled)("alertas e contribuições do curador", () => {
  let amb: AmbienteDaCuradoria;
  let rh: Pessoa;
  let outroRh: Pessoa;

  beforeAll(async () => {
    amb = await AmbienteDaCuradoria.subir();
    rh = await amb.curador();
    outroRh = await amb.curador();
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  const doRh = async (p: ParticipanteDaCuradoria, curador = rh) => {
    await amb.turmaCom(curador, [p]);
    return p;
  };

  const listarAlertas = async (quem: Pessoa, status?: string) => {
    const r = await amb.http(quem, "GET", `/alertas${status ? `?status=${status}` : ""}`);
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return z.array(labAlertaDoCuradorSchema).parse(r.corpo.data);
  };
  const doParticipante = (
    lista: Awaited<ReturnType<typeof listarAlertas>>,
    p: ParticipanteDaCuradoria
  ) => lista.filter((a) => a.participante.id === p.participanteId);

  describe("quem pode", () => {
    it("sem login é 401; só o curador usa a curadoria", async () => {
      for (const [metodo, caminho] of [
        ["GET", "/alertas"],
        ["POST", `/alertas/${INEXISTENTE}/tratamento`],
        ["GET", "/contribuicoes"],
        ["POST", `/contribuicoes/${INEXISTENTE}/decisao`]
      ] as const) {
        expect((await amb.http(null, metodo, caminho, {})).status, caminho).toBe(401);
        for (const papel of ["COMUM", "ADMIN"] as const) {
          const pessoa = await amb.cad.pessoa(papel, [{ isGlobal: true }]);
          const r = await amb.http(pessoa, metodo, caminho, { nota: "x", decisao: "aprovada" });
          expect(r.status, `${papel} ${metodo} ${caminho}`).toBe(403);
          expect(r.corpo.code).toBe("LAB_FORBIDDEN");
        }
      }
    });
  });

  describe("alertas", () => {
    it("lista os alertas dos participantes das turmas, inclusive de teste em andamento, só com o contrato", async () => {
      const concluido = await doRh(
        await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(2) })
      );
      const andamento = await doRh(
        await amb.participanteEmAndamento({ respostas: 2, roteiro: roteiroComAlertaNa(1) })
      );
      const lista = await listarAlertas(rh);

      const doConcluido = doParticipante(lista, concluido);
      expect(doConcluido).toHaveLength(1);
      expect(doConcluido[0]).toMatchObject({
        cor: "vermelho",
        status: "aberto",
        situacao: 2,
        skillNome: null,
        testeConcluido: true,
        resultadoId: concluido.resultadoId,
        sessaoId: concluido.sessaoId,
        tratadoEm: null,
        tratadoPor: null,
        nota: null
      });
      const doAndamento = doParticipante(lista, andamento);
      expect(doAndamento).toHaveLength(1);
      expect(doAndamento[0]).toMatchObject({
        cor: "vermelho",
        situacao: 1,
        testeConcluido: false,
        resultadoId: null
      });

      const bruto = await amb.http(rh, "GET", "/alertas");
      for (const a of bruto.corpo.data) {
        expect(Object.keys(a).sort()).toEqual(Object.keys(labAlertaDoCuradorSchema.shape).sort());
      }
    });

    it("cada curador vê só os alertas da própria turma; sem turma, nenhum", async () => {
      const meu = await doRh(await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) }));
      const deOutro = await doRh(
        await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) }),
        outroRh
      );
      expect(doParticipante(await listarAlertas(rh), meu)).toHaveLength(1);
      expect(doParticipante(await listarAlertas(rh), deOutro)).toHaveLength(0);
      expect(doParticipante(await listarAlertas(outroRh), deOutro)).toHaveLength(1);
      expect(await listarAlertas(await amb.curador())).toEqual([]);
    });

    it("os vermelhos vêm antes dos amarelos, e o amarelo traz o nome da skill", async () => {
      const curador = await amb.curador();
      const p = await doRh(
        await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) }),
        curador
      );
      await amb.consulta(
        `INSERT INTO leadership_lab.alerta (sessao_id, cor, skill_id) VALUES ($1, 'amarelo', 'gestao-os')`,
        [p.sessaoId]
      );
      const q = await doRh(
        await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) }),
        curador
      );
      const lista = await listarAlertas(curador);
      expect(lista.map((a) => a.cor)).toEqual(["vermelho", "vermelho", "amarelo"]);
      const amarelo = lista.find((a) => a.cor === "amarelo")!;
      expect(amarelo).toMatchObject({ skillNome: "Gestão de OS e prioridades", situacao: null });
      expect(amarelo.participante.id).toBe(p.participanteId);
      void q;
    });

    it("encerrar exige a nota; guarda quem e quando; sai da lista de abertos e entra na de encerrados", async () => {
      const p = await doRh(await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(3) }));
      const [alerta] = doParticipante(await listarAlertas(rh), p);

      for (const corpo of [
        {},
        { nota: "" },
        { nota: "   " },
        { nota: "x".repeat(1001) },
        { nota: "ok", extra: 1 }
      ]) {
        const r = await amb.http(rh, "POST", `/alertas/${alerta!.id}/tratamento`, corpo);
        expect(r.status, JSON.stringify(corpo).slice(0, 60)).toBe(400);
      }
      expect(doParticipante(await listarAlertas(rh), p)).toHaveLength(1);

      const r = await amb.http(rh, "POST", `/alertas/${alerta!.id}/tratamento`, {
        nota: "Conversamos sobre o episódio e combinamos revisar o procedimento."
      });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const tratado = labAlertaDoCuradorSchema.parse(r.corpo.data);
      expect(tratado).toMatchObject({
        id: alerta!.id,
        status: "encerrado",
        nota: "Conversamos sobre o episódio e combinamos revisar o procedimento.",
        tratadoPor: expect.any(String)
      });
      expect(tratado.tratadoEm).not.toBeNull();

      expect(doParticipante(await listarAlertas(rh), p)).toHaveLength(0);
      expect(doParticipante(await listarAlertas(rh, "encerrado"), p)).toHaveLength(1);
      expect(doParticipante(await listarAlertas(rh, "todos"), p)).toHaveLength(1);

      const [linha] = await amb.consulta(
        `SELECT status, tratado_por, nota FROM leadership_lab.alerta WHERE id = $1`,
        [alerta!.id]
      );
      expect(linha).toMatchObject({ status: "encerrado", tratado_por: rh.id });
      const trilha = await amb.auditoria("LabAlerta", alerta!.id);
      expect(trilha).toHaveLength(1);
      expect(trilha[0]).toMatchObject({
        action: "UPDATE",
        userId: rh.id,
        before: { status: "aberto" },
        after: { status: "encerrado", cor: "vermelho" }
      });
      // A nota é conteúdo de uma conversa de desenvolvimento: não se duplica na auditoria.
      expect(JSON.stringify(trilha)).not.toContain("Conversamos sobre o episódio");
    });

    it("encerrar uma segunda vez é 409; dois curadores ao mesmo tempo: um encerra e o outro recebe 409", async () => {
      const curadorA = await amb.curador();
      const curadorB = await amb.curador();
      const p = await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) });
      await amb.turmaCom(curadorA, [p]);
      await amb.turmaCom(curadorB, [p]);
      const [alerta] = doParticipante(await listarAlertas(curadorA), p);

      const respostas = await Promise.all([
        amb.http(curadorA, "POST", `/alertas/${alerta!.id}/tratamento`, { nota: "A" }),
        amb.http(curadorB, "POST", `/alertas/${alerta!.id}/tratamento`, { nota: "B" })
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(respostas.find((r) => r.status === 409)!.corpo.code).toBe("LAB_ALERTA_JA_TRATADO");
      expect(await amb.auditoria("LabAlerta", alerta!.id)).toHaveLength(1);

      const terceira = await amb.http(curadorA, "POST", `/alertas/${alerta!.id}/tratamento`, {
        nota: "C"
      });
      expect(terceira.status).toBe(409);
    });

    it("alerta de fora das turmas, inexistente ou com id torto: o mesmo 404, e nada muda", async () => {
      const deOutro = await doRh(
        await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) }),
        outroRh
      );
      const [alerta] = doParticipante(await listarAlertas(outroRh), deOutro);
      const respostas = [
        await amb.http(rh, "POST", `/alertas/${alerta!.id}/tratamento`, { nota: "x" }),
        await amb.http(rh, "POST", `/alertas/${INEXISTENTE}/tratamento`, { nota: "x" }),
        await amb.http(rh, "POST", `/alertas/nao-e-uuid/tratamento`, { nota: "x" })
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      expect(doParticipante(await listarAlertas(outroRh), deOutro)[0]!.status).toBe("aberto");
    });

    it("encerrar o alerta tira o aviso do painel do participante; a nota nunca chega a ele", async () => {
      const p = await doRh(await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(2) }));
      const antes = await amb.http(p.pessoa, "GET", "/painel");
      expect(antes.corpo.data.alertas).toHaveLength(1);
      const [alerta] = doParticipante(await listarAlertas(rh), p);
      await amb.http(rh, "POST", `/alertas/${alerta!.id}/tratamento`, {
        nota: "Nota privada da conversa."
      });
      const depois = await amb.http(p.pessoa, "GET", "/painel");
      expect(depois.corpo.data.alertas).toHaveLength(0);
      expect(JSON.stringify(depois.corpo)).not.toContain("Nota privada da conversa.");
    });

    it("recusa filtro desconhecido ou parâmetro a mais", async () => {
      for (const caminho of ["/alertas?status=quase", "/alertas?status=aberto&x=1"]) {
        expect((await amb.http(rh, "GET", caminho)).status, caminho).toBe(400);
      }
    });
  });

  describe("contribuições", () => {
    const listar = async (quem: Pessoa, status?: string) => {
      const r = await amb.http(quem, "GET", `/contribuicoes${status ? `?status=${status}` : ""}`);
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      return z.array(labContribuicaoDoCuradorSchema).parse(r.corpo.data);
    };
    const dele = (lista: Awaited<ReturnType<typeof listar>>, p: ParticipanteDaCuradoria) =>
      lista.filter((c) => c.participante.id === p.participanteId);

    it("lista a ideia, de quem é e em que situação nasceu, inclusive de teste em andamento", async () => {
      const concluido = await doRh(await amb.participanteComTeste({ roteiro: comContribuicao }));
      const andamento = await doRh(await amb.participanteEmAndamento({ roteiro: comContribuicao }));
      const lista = await listar(rh);
      expect(dele(lista, concluido)[0]).toMatchObject({
        texto: SUGESTAO,
        status: "pendente",
        situacao: 1,
        testeConcluido: true,
        resultadoId: concluido.resultadoId,
        decididoEm: null,
        decididoPor: null
      });
      expect(dele(lista, andamento)[0]).toMatchObject({ testeConcluido: false, resultadoId: null });
      const bruto = await amb.http(rh, "GET", "/contribuicoes");
      for (const c of bruto.corpo.data) {
        expect(Object.keys(c).sort()).toEqual(
          Object.keys(labContribuicaoDoCuradorSchema.shape).sort()
        );
      }
    });

    it("cada curador vê só as da própria turma", async () => {
      const meu = await doRh(await amb.participanteComTeste({ roteiro: comContribuicao }));
      const deOutro = await doRh(
        await amb.participanteComTeste({ roteiro: comContribuicao }),
        outroRh
      );
      expect(dele(await listar(rh), meu)).toHaveLength(1);
      expect(dele(await listar(rh), deOutro)).toHaveLength(0);
      expect(await listar(await amb.curador())).toEqual([]);
    });

    it.each([
      ["aprovada", "APPROVE"],
      ["rejeitada", "REJECT"]
    ] as const)(
      "%s: registra quem decidiu, sai dos pendentes e grava a auditoria",
      async (decisao, acao) => {
        const p = await doRh(await amb.participanteComTeste({ roteiro: comContribuicao }));
        const [contribuicao] = dele(await listar(rh), p);
        const r = await amb.http(rh, "POST", `/contribuicoes/${contribuicao!.id}/decisao`, {
          decisao
        });
        expect(r.status, JSON.stringify(r.corpo)).toBe(200);
        expect(labContribuicaoDoCuradorSchema.parse(r.corpo.data)).toMatchObject({
          status: decisao,
          decididoPor: expect.any(String)
        });
        expect(dele(await listar(rh), p)).toHaveLength(0);
        expect(dele(await listar(rh, decisao), p)).toHaveLength(1);
        const trilha = await amb.auditoria("LabContribuicao", contribuicao!.id);
        expect(trilha).toHaveLength(1);
        expect(trilha[0]).toMatchObject({
          action: acao,
          userId: rh.id,
          before: { status: "pendente" },
          after: { status: decisao }
        });
        // O texto do participante não se duplica na auditoria.
        expect(JSON.stringify(trilha)).not.toContain(SUGESTAO);
      }
    );

    it("decisão definitiva: a segunda vez é 409, e dois curadores ao mesmo tempo, um vale", async () => {
      const curadorA = await amb.curador();
      const curadorB = await amb.curador();
      const p = await amb.participanteComTeste({ roteiro: comContribuicao });
      await amb.turmaCom(curadorA, [p]);
      await amb.turmaCom(curadorB, [p]);
      const [c] = dele(await listar(curadorA), p);
      const respostas = await Promise.all([
        amb.http(curadorA, "POST", `/contribuicoes/${c!.id}/decisao`, { decisao: "aprovada" }),
        amb.http(curadorB, "POST", `/contribuicoes/${c!.id}/decisao`, { decisao: "rejeitada" })
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(respostas.find((r) => r.status === 409)!.corpo.code).toBe("LAB_JA_DECIDIDO");
      expect(await amb.auditoria("LabContribuicao", c!.id)).toHaveLength(1);
    });

    it("recusa decisão que não é aprovada ou rejeitada, corpo com campo a mais e id torto", async () => {
      const p = await doRh(await amb.participanteComTeste({ roteiro: comContribuicao }));
      const [c] = dele(await listar(rh), p);
      for (const corpo of [
        {},
        { decisao: "pendente" },
        { decisao: "aceita" },
        { decisao: "aprovada", nota: "x" }
      ]) {
        expect((await amb.http(rh, "POST", `/contribuicoes/${c!.id}/decisao`, corpo)).status).toBe(
          400
        );
      }
      expect(dele(await listar(rh), p)).toHaveLength(1);
    });

    it("contribuição de fora das turmas, inexistente ou com id torto: o mesmo 404", async () => {
      const deOutro = await doRh(
        await amb.participanteComTeste({ roteiro: comContribuicao }),
        outroRh
      );
      const [c] = dele(await listar(outroRh), deOutro);
      const respostas = [
        await amb.http(rh, "POST", `/contribuicoes/${c!.id}/decisao`, { decisao: "aprovada" }),
        await amb.http(rh, "POST", `/contribuicoes/${INEXISTENTE}/decisao`, {
          decisao: "aprovada"
        }),
        await amb.http(rh, "POST", `/contribuicoes/nao-e-uuid/decisao`, { decisao: "aprovada" })
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      expect(dele(await listar(outroRh), deOutro)[0]!.status).toBe("pendente");
    });

    it("recusa filtro desconhecido", async () => {
      expect((await amb.http(rh, "GET", "/contribuicoes?status=aceita")).status).toBe(400);
    });
  });
});
