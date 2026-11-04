// As contestações, de ponta a ponta: o participante questiona um ponto do próprio resultado e o
// curador da turma decide. Aplicativo real, JWT real, PostgreSQL real e participantes que jogam de
// verdade (motor + IA falsa). Exige LAB_TEST_DATABASE_URL.
import {
  labContestacaoDoCuradorSchema,
  labContestacaoPropriaSchema,
  labFichaDeRevisaoSchema
} from "@my-flux/shared";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import type { Pessoa } from "../cadastro/ambiente-do-cadastro.js";
import { AmbienteDaCuradoria, type ParticipanteDaCuradoria } from "./ambiente-da-curadoria.js";

const INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const MOTIVO = "A situação 2 não considerou que o cliente já tinha sido avisado.";

describe.skipIf(!integrationEnabled)("contestações", () => {
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

  async function daTurma(curador = rh) {
    const p = await amb.participanteComTeste();
    await amb.turmaCom(curador, [p]);
    return p;
  }

  const contestar = (quem: Pessoa, resultadoId: string, corpo: unknown) =>
    amb.http(quem, "POST", `/resultados/${resultadoId}/contestacoes`, corpo);
  const contestarComoDono = async (
    p: ParticipanteDaCuradoria,
    corpo = { ponto: "Situação 2", motivo: MOTIVO }
  ) => {
    const r = await contestar(p.pessoa, p.resultadoId!, corpo);
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return labContestacaoPropriaSchema.parse(r.corpo.data);
  };
  const listarDoCurador = async (quem: Pessoa, status?: string) => {
    const r = await amb.http(quem, "GET", `/contestacoes${status ? `?status=${status}` : ""}`);
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return z.array(labContestacaoDoCuradorSchema).parse(r.corpo.data);
  };
  const decidir = (quem: Pessoa, id: string, corpo: unknown) =>
    amb.http(quem, "POST", `/contestacoes/${id}/decisao`, corpo);

  describe("quem pode", () => {
    it("sem login é 401", async () => {
      for (const [metodo, caminho] of [
        ["POST", `/resultados/${INEXISTENTE}/contestacoes`],
        ["GET", `/resultados/${INEXISTENTE}/contestacoes`],
        ["GET", "/contestacoes"],
        ["POST", `/contestacoes/${INEXISTENTE}/decisao`]
      ] as const) {
        expect((await amb.http(null, metodo, caminho, {})).status, caminho).toBe(401);
      }
    });

    it("só o participante contesta; só o curador decide", async () => {
      const p = await daTurma();
      for (const papel of ["RH", "ADMIN", "DEV"] as const) {
        const pessoa = papel === "RH" ? rh : await amb.cad.pessoa(papel, [{ isGlobal: true }]);
        for (const r of [
          await contestar(pessoa, p.resultadoId!, { ponto: "x", motivo: "y" }),
          await amb.http(pessoa, "GET", `/resultados/${p.resultadoId}/contestacoes`)
        ]) {
          expect(r.status, papel).toBe(403);
          expect(r.corpo.code).toBe("LAB_FORBIDDEN");
        }
      }
      for (const papel of ["COMUM", "ADMIN", "DEV"] as const) {
        const pessoa =
          papel === "COMUM" ? p.pessoa : await amb.cad.pessoa(papel, [{ isGlobal: true }]);
        for (const r of [
          await amb.http(pessoa, "GET", "/contestacoes"),
          await decidir(pessoa, INEXISTENTE, { decisao: "aceita", nota: "x" })
        ]) {
          expect(r.status, papel).toBe(403);
        }
      }
    });

    it("um usuário comum ainda sem vínculo recebe o aviso de vínculo, não 'não encontrado'", async () => {
      const semVinculo = await amb.cad.usuarioComum();
      const p = await daTurma();
      const r = await contestar(semVinculo, p.resultadoId!, { ponto: "x", motivo: "y" });
      expect(r.status).toBe(403);
      expect(r.corpo.code).toBe("LAB_SEM_VINCULO");
    });
  });

  describe("o participante contesta", () => {
    it("registra a contestação do próprio resultado, devolve só o que é dele e grava a auditoria", async () => {
      const p = await daTurma();
      const criada = await contestarComoDono(p, {
        ponto: "  Situação 2  ",
        motivo: `  ${MOTIVO}  `
      });
      expect(criada).toMatchObject({
        ponto: "Situação 2",
        motivo: MOTIVO,
        status: "pendente",
        decididoEm: null,
        nota: null
      });
      // Nunca quem decidiu (e ainda nem foi decidida).
      expect(Object.keys(criada).sort()).toEqual([
        "criadoEm",
        "decididoEm",
        "id",
        "motivo",
        "nota",
        "ponto",
        "status"
      ]);

      const [linha] = await amb.consulta(
        `SELECT resultado_id, ponto, motivo, status FROM leadership_lab.contestacao WHERE id = $1`,
        [criada.id]
      );
      expect(linha).toEqual({
        resultado_id: p.resultadoId,
        ponto: "Situação 2",
        motivo: MOTIVO,
        status: "pendente"
      });
      const trilha = await amb.auditoria("LabContestacao", criada.id);
      expect(trilha).toHaveLength(1);
      expect(trilha[0]).toMatchObject({
        action: "CREATE",
        userId: p.pessoa.id,
        userRole: "COMUM",
        after: { resultadoId: p.resultadoId, status: "pendente" }
      });
      // O texto do participante não se duplica na auditoria.
      expect(JSON.stringify(trilha)).not.toContain(MOTIVO);
    });

    it("pode contestar mais de um ponto, e vê todos, o mais recente primeiro", async () => {
      const p = await daTurma();
      const primeira = await contestarComoDono(p, {
        ponto: "Resultado geral",
        motivo: "Primeira."
      });
      await amb.consulta(
        `UPDATE leadership_lab.contestacao SET criado_em = criado_em - interval '1 hour' WHERE id = $1`,
        [primeira.id]
      );
      const segunda = await contestarComoDono(p, { ponto: "Situação 3", motivo: "Segunda." });
      const r = await amb.http(p.pessoa, "GET", `/resultados/${p.resultadoId}/contestacoes`);
      expect(
        z
          .array(labContestacaoPropriaSchema)
          .parse(r.corpo.data)
          .map((c) => c.id)
      ).toEqual([segunda.id, primeira.id]);
    });

    it("recusa ponto ou motivo vazio, longo demais ou ausente, e campo a mais (400)", async () => {
      const p = await daTurma();
      for (const corpo of [
        {},
        { ponto: "x" },
        { motivo: "y" },
        { ponto: "", motivo: "y" },
        { ponto: "x", motivo: "   " },
        { ponto: "x".repeat(201), motivo: "y" },
        { ponto: "x", motivo: "y".repeat(1001) },
        { ponto: "x", motivo: "y", status: "aceita" },
        { ponto: 1, motivo: "y" }
      ]) {
        const r = await contestar(p.pessoa, p.resultadoId!, corpo);
        expect(r.status, JSON.stringify(corpo).slice(0, 60)).toBe(400);
      }
      expect(
        await amb.consulta(`SELECT 1 FROM leadership_lab.contestacao WHERE resultado_id = $1`, [
          p.resultadoId
        ])
      ).toEqual([]);
    });

    it("não contesta nem lê o resultado de outra pessoa: o mesmo 404 de um resultado que não existe", async () => {
      const dono = await daTurma();
      const outro = await amb.participanteComTeste();
      const contestacaoDoDono = await contestarComoDono(dono);
      const respostas = [
        await contestar(outro.pessoa, dono.resultadoId!, { ponto: "x", motivo: "y" }),
        await contestar(outro.pessoa, INEXISTENTE, { ponto: "x", motivo: "y" }),
        await contestar(outro.pessoa, "nao-e-uuid", { ponto: "x", motivo: "y" })
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      const leitura = await amb.http(
        outro.pessoa,
        "GET",
        `/resultados/${dono.resultadoId}/contestacoes`
      );
      expect(leitura.status).toBe(404);
      expect(leitura.corpo).toEqual(respostas[0]!.corpo);
      expect(JSON.stringify(leitura.corpo)).not.toContain(contestacaoDoDono.id);
      expect(
        await amb.consulta(`SELECT 1 FROM leadership_lab.contestacao WHERE resultado_id = $1`, [
          dono.resultadoId
        ])
      ).toHaveLength(1);
    });
  });

  describe("o curador decide", () => {
    it("lista as pendentes das próprias turmas, com o resultado contestado, e só com o contrato", async () => {
      const p = await daTurma();
      const criada = await contestarComoDono(p);
      const lista = await listarDoCurador(rh);
      const dela = lista.find((c) => c.id === criada.id);
      expect(dela).toMatchObject({
        ponto: "Situação 2",
        motivo: MOTIVO,
        status: "pendente",
        resultadoId: p.resultadoId,
        sessaoId: p.sessaoId,
        statusValidacao: "aguardando_validacao",
        participante: { id: p.participanteId },
        decididoEm: null,
        decididoPor: null,
        nota: null
      });
      const bruto = await amb.http(rh, "GET", "/contestacoes");
      for (const c of bruto.corpo.data) {
        expect(Object.keys(c).sort()).toEqual(
          Object.keys(labContestacaoDoCuradorSchema.shape).sort()
        );
      }
    });

    it("cada curador vê só as da própria turma; sem turma, nenhuma", async () => {
      const meu = await daTurma();
      const deOutro = await daTurma(outroRh);
      const minha = await contestarComoDono(meu);
      const dele = await contestarComoDono(deOutro);
      const ids = async (quem: Pessoa) => (await listarDoCurador(quem, "todas")).map((c) => c.id);
      expect(await ids(rh)).toContain(minha.id);
      expect(await ids(rh)).not.toContain(dele.id);
      expect(await ids(outroRh)).toContain(dele.id);
      expect(await ids(await amb.curador())).toEqual([]);
    });

    it.each([
      ["aceita", "APPROVE"],
      ["rejeitada", "REJECT"]
    ] as const)(
      "%s: exige a nota, registra quem decidiu e o participante vê a decisão e a nota, nunca quem decidiu",
      async (decisao, acao) => {
        const p = await daTurma();
        const criada = await contestarComoDono(p);

        for (const corpo of [
          { decisao },
          { decisao, nota: "" },
          { decisao, nota: "   " },
          { nota: "x" },
          { decisao: "pendente", nota: "x" }
        ]) {
          expect((await decidir(rh, criada.id, corpo)).status, JSON.stringify(corpo)).toBe(400);
        }
        expect((await listarDoCurador(rh)).map((c) => c.id)).toContain(criada.id);

        const r = await decidir(rh, criada.id, {
          decisao,
          nota: "Revisamos a situação com a equipe."
        });
        expect(r.status, JSON.stringify(r.corpo)).toBe(200);
        expect(labContestacaoDoCuradorSchema.parse(r.corpo.data)).toMatchObject({
          status: decisao,
          nota: "Revisamos a situação com a equipe.",
          decididoPor: expect.any(String)
        });
        expect((await listarDoCurador(rh)).map((c) => c.id)).not.toContain(criada.id);
        expect((await listarDoCurador(rh, decisao)).map((c) => c.id)).toContain(criada.id);

        const doParticipante = await amb.http(
          p.pessoa,
          "GET",
          `/resultados/${p.resultadoId}/contestacoes`
        );
        const [vista] = z.array(labContestacaoPropriaSchema).parse(doParticipante.corpo.data);
        expect(vista).toMatchObject({
          status: decisao,
          nota: "Revisamos a situação com a equipe."
        });
        expect(vista!.decididoEm).not.toBeNull();
        expect(Object.keys(vista!).sort()).toEqual([
          "criadoEm",
          "decididoEm",
          "id",
          "motivo",
          "nota",
          "ponto",
          "status"
        ]);
        expect(JSON.stringify(doParticipante.corpo)).not.toMatch(/decididoPor|decidido_por/);

        const trilha = await amb.auditoria("LabContestacao", criada.id);
        expect(trilha.map((t) => t.action)).toEqual(["CREATE", acao]);
        expect(trilha[1]).toMatchObject({
          userId: rh.id,
          before: { status: "pendente" },
          after: { status: decisao }
        });
        expect(JSON.stringify(trilha)).not.toContain("Revisamos a situação com a equipe.");
      }
    );

    it("decidir NÃO altera o resultado: nem o selo, nem os níveis (ajuste é a validação)", async () => {
      const p = await daTurma();
      const criada = await contestarComoDono(p);
      await decidir(rh, criada.id, { decisao: "aceita", nota: "Faz sentido." });
      const [resultado] = await amb.consulta(
        `SELECT status_validacao, validado_por FROM leadership_lab.resultado WHERE id = $1`,
        [p.resultadoId]
      );
      expect(resultado).toEqual({ status_validacao: "aguardando_validacao", validado_por: null });
      const perfis = await amb.consulta(
        `SELECT validado, nivel_validado FROM leadership_lab.perfil_skill WHERE sessao_id = $1`,
        [p.sessaoId]
      );
      expect(perfis.every((x) => x.validado === false && x.nivel_validado === null)).toBe(true);
    });

    it("a ficha do resultado mostra as contestações dele, e a fila conta as pendentes", async () => {
      const p = await daTurma();
      const criada = await contestarComoDono(p);
      const fila = await amb.http(rh, "GET", "/revisao");
      expect(
        fila.corpo.data.find((i: { resultadoId: string }) => i.resultadoId === p.resultadoId)
      ).toMatchObject({
        contestacoesPendentes: 1
      });
      const ficha = labFichaDeRevisaoSchema.parse(
        (await amb.http(rh, "GET", `/revisao/${p.resultadoId}`)).corpo.data
      );
      expect(ficha.contestacoes.map((c) => c.id)).toEqual([criada.id]);
      await decidir(rh, criada.id, { decisao: "rejeitada", nota: "Mantida." });
      const depois = await amb.http(rh, "GET", "/revisao");
      expect(
        depois.corpo.data.find((i: { resultadoId: string }) => i.resultadoId === p.resultadoId)
      ).toMatchObject({
        contestacoesPendentes: 0
      });
    });

    it("decisão definitiva: a segunda vez é 409, e dois curadores ao mesmo tempo, um vale", async () => {
      const curadorA = await amb.curador();
      const curadorB = await amb.curador();
      const p = await amb.participanteComTeste();
      await amb.turmaCom(curadorA, [p]);
      await amb.turmaCom(curadorB, [p]);
      const criada = await contestarComoDono(p);
      const respostas = await Promise.all([
        decidir(curadorA, criada.id, { decisao: "aceita", nota: "A" }),
        decidir(curadorB, criada.id, { decisao: "rejeitada", nota: "B" })
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(respostas.find((r) => r.status === 409)!.corpo.code).toBe("LAB_JA_DECIDIDO");
      expect((await amb.auditoria("LabContestacao", criada.id)).map((t) => t.action)).toHaveLength(
        2
      );
    });

    it("contestação de fora das turmas, inexistente ou com id torto: o mesmo 404, e nada muda", async () => {
      const deOutro = await daTurma(outroRh);
      const criada = await contestarComoDono(deOutro);
      const respostas = [
        await decidir(rh, criada.id, { decisao: "aceita", nota: "x" }),
        await decidir(rh, INEXISTENTE, { decisao: "aceita", nota: "x" }),
        await decidir(rh, "nao-e-uuid", { decisao: "aceita", nota: "x" })
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      expect((await listarDoCurador(outroRh)).find((c) => c.id === criada.id)!.status).toBe(
        "pendente"
      );
    });

    it("turma encerrada: as contestações saem da lista do curador", async () => {
      const p = await amb.participanteComTeste();
      const turmaId = await amb.turmaCom(rh, [p]);
      const criada = await contestarComoDono(p);
      expect((await listarDoCurador(rh)).map((c) => c.id)).toContain(criada.id);
      await amb.consulta(`UPDATE leadership_lab.turma SET ativa = false WHERE id = $1`, [turmaId]);
      expect((await listarDoCurador(rh)).map((c) => c.id)).not.toContain(criada.id);
      expect((await decidir(rh, criada.id, { decisao: "aceita", nota: "x" })).status).toBe(404);
    });

    it("recusa filtro desconhecido", async () => {
      expect((await amb.http(rh, "GET", "/contestacoes?status=aprovada")).status).toBe(400);
    });
  });
});
