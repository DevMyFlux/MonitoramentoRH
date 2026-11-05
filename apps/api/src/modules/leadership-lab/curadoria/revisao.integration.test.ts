// A revisão dos resultados pelo curador, de ponta a ponta: aplicativo real, JWT real, PostgreSQL
// real e participantes que jogam de verdade (motor + IA falsa). Exige LAB_TEST_DATABASE_URL.
import {
  labFichaDeRevisaoSchema,
  labItemDaRevisaoSchema,
  labPendenciasSchema,
  labResultadoSchema
} from "@my-flux/shared";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import type { Pessoa } from "../cadastro/ambiente-do-cadastro.js";
import {
  AmbienteDaCuradoria,
  type ParticipanteDaCuradoria,
  roteiroComAlertaNa
} from "./ambiente-da-curadoria.js";

const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!integrationEnabled)("revisão dos resultados", () => {
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

  /** Um participante com teste concluído, já numa turma ativa do `rh`. */
  async function daTurma(opcoes: Parameters<AmbienteDaCuradoria["participanteComTeste"]>[0] = {}) {
    const p = await amb.participanteComTeste(opcoes);
    await amb.turmaCom(rh, [p]);
    return p;
  }

  const resultadoDe = (p: ParticipanteDaCuradoria) => p.resultadoId!;
  const fila = async (quem: Pessoa, status?: string) => {
    const r = await amb.http(quem, "GET", `/revisao${status ? `?status=${status}` : ""}`);
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return z.array(labItemDaRevisaoSchema).parse(r.corpo.data);
  };
  const ficha = async (quem: Pessoa, p: ParticipanteDaCuradoria) => {
    const r = await amb.http(quem, "GET", `/revisao/${resultadoDe(p)}`);
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return labFichaDeRevisaoSchema.parse(r.corpo.data);
  };
  const validar = (quem: Pessoa, p: ParticipanteDaCuradoria, corpo: unknown) =>
    amb.http(quem, "POST", `/resultados/${resultadoDe(p)}/validacao`, corpo);

  describe("quem pode", () => {
    it("sem login é 401", async () => {
      for (const [metodo, caminho] of [
        ["GET", "/pendencias"],
        ["GET", "/revisao"],
        ["GET", `/revisao/${INEXISTENTE}`],
        ["POST", `/resultados/${INEXISTENTE}/validacao`]
      ] as const) {
        expect((await amb.http(null, metodo, caminho, {})).status, caminho).toBe(401);
      }
    });

    it.each(["COMUM", "ADMIN"] as const)("o perfil %s não revisa resultados", async (papel) => {
      const pessoa = await amb.cad.pessoa(papel, [{ isGlobal: true }]);
      const p = await daTurma();
      for (const [metodo, caminho, corpo] of [
        ["GET", "/pendencias"],
        ["GET", "/revisao"],
        ["GET", `/revisao/${resultadoDe(p)}`],
        ["GET", `/revisao/${INEXISTENTE}`],
        ["POST", `/resultados/${resultadoDe(p)}/validacao`, {}],
        ["POST", `/resultados/${INEXISTENTE}/validacao`, {}]
      ] as const) {
        const r = await amb.http(pessoa, metodo, caminho, corpo);
        expect(r.status, `${metodo} ${caminho}`).toBe(403);
        expect(r.corpo.code).toBe("LAB_FORBIDDEN");
      }
    });

    it("o participante não valida o próprio resultado", async () => {
      const p = await daTurma();
      const r = await validar(p.pessoa, p, {});
      expect(r.status).toBe(403);
      const [{ status_validacao }] = await amb.consulta(
        `SELECT status_validacao FROM leadership_lab.resultado WHERE id = $1`,
        [resultadoDe(p)]
      );
      expect(status_validacao).toBe("aguardando_validacao");
    });

    it("a gestão (lab_gestao) não ganha a curadoria por isso", async () => {
      const pessoa = await amb.cad.pessoa("COMUM");
      await amb.consulta(
        `INSERT INTO leadership_lab.permissao_usuario (user_id, permissao) VALUES ($1, 'lab_gestao')`,
        [pessoa.id]
      );
      expect((await amb.http(pessoa, "GET", "/revisao")).status).toBe(403);
    });
  });

  describe("a fila", () => {
    it("traz os resultados dos participantes das turmas do curador, só com o contrato", async () => {
      const p = await daTurma();
      const itens = await fila(rh);
      const item = itens.find((i) => i.resultadoId === resultadoDe(p));
      expect(item).toMatchObject({
        sessaoId: p.sessaoId,
        statusValidacao: "aguardando_validacao",
        moldeNome: "Supervisor",
        aderenciaGeral: 76,
        agilidade: expect.any(Number),
        alertasAbertos: 0,
        contestacoesPendentes: 0,
        participante: { id: p.participanteId, operacao: "Operação" }
      });
      const r = await amb.http(rh, "GET", "/revisao");
      for (const bruto of r.corpo.data) {
        expect(Object.keys(bruto).sort()).toEqual(Object.keys(labItemDaRevisaoSchema.shape).sort());
      }
    });

    it("cada curador vê só os da própria turma; sem turma, nada", async () => {
      const deRh = await daTurma();
      const deOutro = await amb.participanteComTeste();
      await amb.turmaCom(outroRh, [deOutro]);
      const semTurma = await amb.participanteComTeste();

      const ids = async (quem: Pessoa) => (await fila(quem, "todos")).map((i) => i.resultadoId);
      const meus = await ids(rh);
      expect(meus).toContain(resultadoDe(deRh));
      expect(meus).not.toContain(resultadoDe(deOutro));
      expect(meus).not.toContain(resultadoDe(semTurma));
      const doOutro = await ids(outroRh);
      expect(doOutro).toContain(resultadoDe(deOutro));
      expect(doOutro).not.toContain(resultadoDe(deRh));
      expect(await ids(await amb.curador())).toEqual([]);
    });

    it("turma encerrada tira da fila; reabrir devolve", async () => {
      const p = await amb.participanteComTeste();
      const turmaId = await amb.turmaCom(rh, [p]);
      expect((await fila(rh)).map((i) => i.resultadoId)).toContain(resultadoDe(p));
      await amb.consulta(`UPDATE leadership_lab.turma SET ativa = false WHERE id = $1`, [turmaId]);
      expect((await fila(rh)).map((i) => i.resultadoId)).not.toContain(resultadoDe(p));
      await amb.consulta(`UPDATE leadership_lab.turma SET ativa = true WHERE id = $1`, [turmaId]);
      expect((await fila(rh)).map((i) => i.resultadoId)).toContain(resultadoDe(p));
    });

    it("teste em andamento não tem resultado, então não entra na fila", async () => {
      const andamento = await amb.participanteEmAndamento();
      await amb.turmaCom(rh, [andamento]);
      const itens = await fila(rh, "todos");
      expect(itens.map((i) => i.participante.id)).not.toContain(andamento.participanteId);
    });

    it("filtra por situação, com 'aguardando' como padrão, o mais antigo primeiro", async () => {
      const curador = await amb.curador();
      const a = await amb.participanteComTeste();
      const b = await amb.participanteComTeste();
      await amb.turmaCom(curador, [a, b]);
      // Cada participante joga com o próprio relógio falso, então os dois terminaram no mesmo
      // instante: o `b` passa a ter terminado uma hora depois.
      await amb.consulta(
        `UPDATE leadership_lab.sessao SET concluida_em = concluida_em + interval '1 hour' WHERE id = $1`,
        [b.sessaoId]
      );
      expect((await fila(curador)).map((i) => i.resultadoId)).toEqual([
        resultadoDe(a),
        resultadoDe(b)
      ]);

      expect((await validar(curador, a, {})).status).toBe(200);
      expect((await fila(curador)).map((i) => i.resultadoId)).toEqual([resultadoDe(b)]);
      expect((await fila(curador, "validado")).map((i) => i.resultadoId)).toEqual([resultadoDe(a)]);
      expect(await fila(curador, "ajustado")).toEqual([]);
      expect((await fila(curador, "todos")).map((i) => i.resultadoId).sort()).toEqual(
        [resultadoDe(a), resultadoDe(b)].sort()
      );
    });

    it("recusa filtro desconhecido ou parâmetro a mais", async () => {
      for (const caminho of ["/revisao?status=quase", "/revisao?status=todos&limite=1"]) {
        expect((await amb.http(rh, "GET", caminho)).status, caminho).toBe(400);
      }
    });

    it("mostra os alertas abertos e as contestações pendentes de cada resultado", async () => {
      const p = await daTurma({ roteiro: roteiroComAlertaNa(2) });
      const r = await amb.http(p.pessoa, "POST", `/resultados/${resultadoDe(p)}/contestacoes`, {
        ponto: "Situação 2",
        motivo: "Discordo da nota."
      });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const item = (await fila(rh)).find((i) => i.resultadoId === resultadoDe(p));
      expect(item).toMatchObject({ alertasAbertos: 1, contestacoesPendentes: 1 });
    });
  });

  describe("a ficha", () => {
    it("traz a avaliação por situação e o nível de cada skill, sem nada além do contrato", async () => {
      const p = await daTurma({ roteiro: roteiroComAlertaNa(2) });
      const f = await ficha(rh, p);

      expect(f).toMatchObject({
        resultadoId: resultadoDe(p),
        sessaoId: p.sessaoId,
        statusValidacao: "aguardando_validacao",
        moldeNome: "Supervisor",
        aderenciaGeral: expect.any(Number),
        participante: { id: p.participanteId },
        validacao: { validadoPor: null, validadoEm: null, justificativa: null }
      });
      expect(f.situacoes).toHaveLength(5);
      expect(f.situacoes[1]).toMatchObject({ numero: 2, aderencia: 10, alertaVermelho: true });
      expect(f.situacoes[0]).toMatchObject({
        numero: 1,
        escolha: "A",
        aderencia: 100,
        alertaVermelho: false
      });
      expect(f.situacoes.every((s) => s.justificativa !== null && s.opcoes.length === 3)).toBe(
        true
      );
      expect(f.skills.length).toBeGreaterThan(0);
      for (const s of f.skills) {
        expect(s.nivelValidado, s.skillId).toBeNull();
        expect(s.nivelCalculado).toBeGreaterThanOrEqual(1);
      }
      expect(f.alertas).toHaveLength(1);
      expect(f.alertas[0]).toMatchObject({ cor: "vermelho", situacao: 2, testeConcluido: true });
    });

    it("não vaza o que o serviço de IA devolveu, nem campo fora do contrato", async () => {
      const p = await daTurma();
      const r = await amb.http(rh, "GET", `/revisao/${resultadoDe(p)}`);
      expect(Object.keys(r.corpo.data).sort()).toEqual(
        Object.keys(labFichaDeRevisaoSchema.shape).sort()
      );
      const texto = JSON.stringify(r.corpo);
      // Metadados da chamada à IA e o corpo bruto da resposta ficam no banco.
      for (const proibido of [
        "respostaIa",
        "resposta_ia",
        "modelo-falso",
        "versao_instrucao",
        "tokens_",
        "ia_sessao_id",
        "ses_falsa"
      ]) {
        expect(texto, proibido).not.toContain(proibido);
      }
      for (const s of r.corpo.data.situacoes) {
        expect(Object.keys(s).sort()).toEqual(
          [
            "alertaVermelho",
            "aderencia",
            "consequencia",
            "escolha",
            "estilo",
            "justificativa",
            "marco",
            "numero",
            "opcoes",
            "tempoEsgotado",
            "tempoRespostaMs",
            "texto"
          ].sort()
        );
      }
    });

    it("resultado de fora das turmas, que não existe ou com id torto: o mesmo 'não encontrado'", async () => {
      const deOutro = await amb.participanteComTeste();
      await amb.turmaCom(outroRh, [deOutro]);
      const respostas = [
        await amb.http(rh, "GET", `/revisao/${resultadoDe(deOutro)}`),
        await amb.http(rh, "GET", `/revisao/${INEXISTENTE}`),
        await amb.http(rh, "GET", `/revisao/nao-e-uuid`)
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      expect(respostas[0]!.corpo.code).toBe("LAB_NOT_FOUND");
    });

    it("o participante vê o próprio resultado pela rota dele, e a ficha continua só do curador", async () => {
      const p = await daTurma();
      expect((await amb.http(p.pessoa, "GET", `/revisao/${resultadoDe(p)}`)).status).toBe(403);
      const dele = await amb.http(p.pessoa, "GET", `/sessoes/${p.sessaoId}/resultado`);
      expect(dele.status).toBe(200);
      labResultadoSchema.parse(dele.corpo.data);
    });
  });

  describe("validar", () => {
    it("sem ajustes: o resultado vira 'validado', cada skill fica validada com o nível calculado", async () => {
      const p = await daTurma();
      const antes = await ficha(rh, p);
      const r = await validar(rh, p, {});
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const depois = labFichaDeRevisaoSchema.parse(r.corpo.data);

      expect(depois.statusValidacao).toBe("validado");
      expect(depois.validacao).toMatchObject({
        validadoPor: expect.any(String),
        justificativa: null
      });
      expect(depois.validacao.validadoEm).not.toBeNull();
      for (const s of depois.skills) {
        const original = antes.skills.find((x) => x.skillId === s.skillId)!;
        expect(s.nivelValidado, s.skillId).toBe(original.nivelCalculado);
        expect(s.nivelCalculado, s.skillId).toBe(original.nivelCalculado);
      }

      const [linha] = await amb.consulta(
        `SELECT status_validacao, validado_por, justificativa_validacao FROM leadership_lab.resultado WHERE id = $1`,
        [resultadoDe(p)]
      );
      expect(linha).toMatchObject({ status_validacao: "validado", validado_por: rh.id });
      const perfis = await amb.consulta(
        `SELECT validado, nivel, nivel_validado FROM leadership_lab.perfil_skill WHERE sessao_id = $1`,
        [p.sessaoId]
      );
      expect(perfis.length).toBeGreaterThan(0);
      expect(perfis.every((x) => x.validado === true && x.nivel_validado === x.nivel)).toBe(true);

      const trilha = await amb.auditoria("LabResultado", resultadoDe(p));
      expect(trilha).toHaveLength(1);
      expect(trilha[0]).toMatchObject({
        action: "APPROVE",
        userId: rh.id,
        userRole: "RH",
        before: { statusValidacao: "aguardando_validacao" },
        after: { statusValidacao: "validado", ajustes: [] }
      });
    });

    it("com ajustes: 'ajustado', o nível novo vale, os outros ficam como calculados e a justificativa vai para o banco e para a auditoria", async () => {
      const p = await daTurma();
      const antes = await ficha(rh, p);
      const [alvo, ...resto] = antes.skills;
      const novoNivel = alvo!.nivelCalculado === 1 ? 2 : alvo!.nivelCalculado - 1;
      const r = await validar(rh, p, {
        ajustes: [{ skillId: alvo!.skillId, nivel: novoNivel }],
        justificativa: "Na conversa, ficou claro que a decisão foi tomada sem a equipe."
      });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const depois = labFichaDeRevisaoSchema.parse(r.corpo.data);

      expect(depois.statusValidacao).toBe("ajustado");
      expect(depois.validacao.justificativa).toBe(
        "Na conversa, ficou claro que a decisão foi tomada sem a equipe."
      );
      const skillAjustada = depois.skills.find((s) => s.skillId === alvo!.skillId)!;
      expect(skillAjustada).toMatchObject({
        nivelCalculado: alvo!.nivelCalculado,
        nivelValidado: novoNivel
      });
      for (const s of resto) {
        expect(depois.skills.find((x) => x.skillId === s.skillId)!.nivelValidado).toBe(
          s.nivelCalculado
        );
      }

      const trilha = await amb.auditoria("LabResultado", resultadoDe(p));
      expect(trilha[0]).toMatchObject({
        action: "APPROVE",
        after: {
          statusValidacao: "ajustado",
          ajustes: [{ skillId: alvo!.skillId, de: alvo!.nivelCalculado, para: novoNivel }]
        }
      });
      const [{ justification }] = await amb.consulta(
        `SELECT justification FROM "AuditLog" WHERE entity = 'LabResultado' AND "entityId" = $1`,
        [resultadoDe(p)]
      );
      expect(justification).toBe("Na conversa, ficou claro que a decisão foi tomada sem a equipe.");
    });

    it("uma observação sem ajuste também é guardada, e o resultado segue 'validado'", async () => {
      const p = await daTurma();
      const r = await validar(rh, p, { justificativa: "Conferido com a gerência." });
      expect(r.corpo.data.statusValidacao).toBe("validado");
      expect(r.corpo.data.validacao.justificativa).toBe("Conferido com a gerência.");
    });

    /** Um nível diferente do calculado, para a skill dada. */
    const outroNivel = (calculado: number) => (calculado === 5 ? 4 : calculado + 1);

    /** O resultado continua aguardando e nenhuma skill foi tocada. */
    async function intocado(p: ParticipanteDaCuradoria) {
      const [{ status_validacao, validado_por }] = await amb.consulta(
        `SELECT status_validacao, validado_por FROM leadership_lab.resultado WHERE id = $1`,
        [resultadoDe(p)]
      );
      expect({ status_validacao, validado_por }).toEqual({
        status_validacao: "aguardando_validacao",
        validado_por: null
      });
      const perfis = await amb.consulta(
        `SELECT validado, nivel_validado FROM leadership_lab.perfil_skill WHERE sessao_id = $1`,
        [p.sessaoId]
      );
      expect(perfis.every((x) => x.validado === false && x.nivel_validado === null)).toBe(true);
      expect(await amb.auditoria("LabResultado", resultadoDe(p))).toEqual([]);
    }

    it("ajustar sem justificativa é recusado (422), com o código certo, e nada muda", async () => {
      const p = await daTurma();
      const alvo = (await ficha(rh, p)).skills[0]!;
      for (const justificativa of [undefined, "", "   "]) {
        const r = await validar(rh, p, {
          ajustes: [{ skillId: alvo.skillId, nivel: outroNivel(alvo.nivelCalculado) }],
          ...(justificativa !== undefined ? { justificativa } : {})
        });
        // Texto em branco nem chega ao serviço: o contrato o recusa (400). Sem texto: 422.
        expect([400, 422], JSON.stringify(justificativa)).toContain(r.status);
        if (justificativa === undefined) expect(r.corpo.code).toBe("LAB_JUSTIFICATIVA_OBRIGATORIA");
      }
      await intocado(p);
    });

    it("ajuste inválido (skill que não é do resultado, mesmo nível, repetida) é 422 e nada muda", async () => {
      const p = await daTurma();
      const alvo = (await ficha(rh, p)).skills[0]!;
      const casos: Array<[string, unknown]> = [
        [
          "skill que não é do resultado",
          { ajustes: [{ skillId: "skill-que-nao-existe", nivel: 3 }] }
        ],
        [
          "mesmo nível do calculado",
          { ajustes: [{ skillId: alvo.skillId, nivel: alvo.nivelCalculado }] }
        ],
        [
          "skill repetida",
          {
            ajustes: [
              { skillId: alvo.skillId, nivel: outroNivel(alvo.nivelCalculado) },
              { skillId: alvo.skillId, nivel: outroNivel(alvo.nivelCalculado) }
            ]
          }
        ]
      ];
      for (const [nome, corpo] of casos) {
        const r = await validar(rh, p, { ...(corpo as object), justificativa: "Motivo." });
        expect(r.status, nome).toBe(422);
        expect(r.corpo.code, nome).toBe("LAB_AJUSTE_INVALIDO");
      }
      await intocado(p);
    });

    it("recusa nível fora de 1 a 5, campo a mais e corpo malformado (400)", async () => {
      const p = await daTurma();
      const alvo = (await ficha(rh, p)).skills[0]!;
      for (const corpo of [
        { ajustes: [{ skillId: alvo.skillId, nivel: 0 }], justificativa: "x" },
        { ajustes: [{ skillId: alvo.skillId, nivel: 6 }], justificativa: "x" },
        { ajustes: [{ skillId: alvo.skillId, nivel: 2.5 }], justificativa: "x" },
        { ajustes: [{ skillId: alvo.skillId }], justificativa: "x" },
        { ajustes: "todos" },
        { status: "validado" },
        { justificativa: "x".repeat(1001) }
      ]) {
        const r = await validar(rh, p, corpo);
        expect(r.status, JSON.stringify(corpo).slice(0, 80)).toBe(400);
        expect(r.corpo.code).toBe("VALIDATION_ERROR");
      }
      await intocado(p);
    });

    it("validar é definitivo: a segunda vez dá 409 e não deixa outra auditoria", async () => {
      const p = await daTurma();
      expect((await validar(rh, p, {})).status).toBe(200);
      const segunda = await validar(rh, p, {});
      expect(segunda.status).toBe(409);
      expect(segunda.corpo.code).toBe("LAB_RESULTADO_JA_VALIDADO");
      const ajustando = await validar(rh, p, {
        ajustes: [{ skillId: (await ficha(rh, p)).skills[0]!.skillId, nivel: 1 }],
        justificativa: "Mudei de ideia."
      });
      expect(ajustando.status).toBe(409);
      expect(await amb.auditoria("LabResultado", resultadoDe(p))).toHaveLength(1);
      expect((await ficha(rh, p)).statusValidacao).toBe("validado");
    });

    it("dois curadores validando o mesmo resultado ao mesmo tempo: um vale, o outro recebe 409", async () => {
      const p = await amb.participanteComTeste();
      const curadorA = await amb.curador();
      const curadorB = await amb.curador();
      // O mesmo participante em turmas de dois curadores.
      await amb.turmaCom(curadorA, [p]);
      await amb.turmaCom(curadorB, [p]);
      const respostas = await Promise.all([validar(curadorA, p, {}), validar(curadorB, p, {})]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      const trilha = await amb.auditoria("LabResultado", resultadoDe(p));
      expect(trilha).toHaveLength(1);
      const [{ validado_por }] = await amb.consulta(
        `SELECT validado_por FROM leadership_lab.resultado WHERE id = $1`,
        [resultadoDe(p)]
      );
      expect([curadorA.id, curadorB.id]).toContain(validado_por);
      expect(trilha[0]!.userId).toBe(validado_por);
    });

    it("resultado de fora das turmas, inexistente ou com id torto: o mesmo 404, e nada muda", async () => {
      const deOutro = await amb.participanteComTeste();
      await amb.turmaCom(outroRh, [deOutro]);
      const respostas = [
        await validar(rh, deOutro, {}),
        await amb.http(rh, "POST", `/resultados/${INEXISTENTE}/validacao`, {}),
        await amb.http(rh, "POST", `/resultados/nao-e-uuid/validacao`, {})
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      await intocado(deOutro);
    });

    it("turma encerrada: o curador deixa de poder validar", async () => {
      const p = await amb.participanteComTeste();
      const turmaId = await amb.turmaCom(rh, [p]);
      await amb.consulta(`UPDATE leadership_lab.turma SET ativa = false WHERE id = $1`, [turmaId]);
      expect((await validar(rh, p, {})).status).toBe(404);
      await intocado(p);
    });

    it("sem corpo nenhum a validação também vale (é 'validar como está')", async () => {
      const p = await daTurma();
      const r = await amb.http(rh, "POST", `/resultados/${resultadoDe(p)}/validacao`);
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      expect(r.corpo.data.statusValidacao).toBe("validado");
    });
  });

  describe("o que o participante enxerga depois da validação", () => {
    it("o resultado dele passa a mostrar o selo e o nível validado de cada skill; o painel conta o teste como validado", async () => {
      const p = await daTurma();
      const antes = await amb.http(p.pessoa, "GET", `/sessoes/${p.sessaoId}/resultado`);
      expect(labResultadoSchema.parse(antes.corpo.data).statusValidacao).toBe(
        "aguardando_validacao"
      );
      expect(
        labResultadoSchema
          .parse(antes.corpo.data)
          .niveisPorSkill.every((n) => n.nivelValidado === null)
      ).toBe(true);

      const alvo = (await ficha(rh, p)).skills[0]!;
      const nivel = alvo.nivelCalculado === 5 ? 4 : alvo.nivelCalculado + 1;
      const v = await validar(rh, p, {
        ajustes: [{ skillId: alvo.skillId, nivel }],
        justificativa: "Ajuste combinado na conversa."
      });
      expect(v.status).toBe(200);

      const depois = await amb.http(p.pessoa, "GET", `/sessoes/${p.sessaoId}/resultado`);
      const visto = labResultadoSchema.parse(depois.corpo.data);
      expect(visto.statusValidacao).toBe("ajustado");
      const skill = visto.niveisPorSkill.find((n) => n.skillId === alvo.skillId)!;
      // O calculado continua sendo o calculado; o validado é o que o curador definiu.
      expect(skill).toMatchObject({ nivel: alvo.nivelCalculado, nivelValidado: nivel });
      expect(visto.niveisPorSkill.filter((n) => n.nivelValidado !== null)).toHaveLength(
        visto.niveisPorSkill.length
      );

      // A justificativa do curador não vai ao participante (decisão em aberto: veja a documentação).
      expect(JSON.stringify(depois.corpo)).not.toContain("Ajuste combinado na conversa.");

      const painel = await amb.http(p.pessoa, "GET", "/painel");
      expect(painel.corpo.data.indicadores).toMatchObject({ testesFeitos: 1, testesValidados: 1 });
      const naPainel = painel.corpo.data.skills.find(
        (s: { skillId: string }) => s.skillId === alvo.skillId
      );
      expect(naPainel).toMatchObject({
        validado: true,
        nivel,
        nivelCalculado: alvo.nivelCalculado
      });
    });
  });

  describe("pendências", () => {
    it("contam só o que é das turmas do curador e descem conforme ele decide", async () => {
      const curador = await amb.curador();
      const a = await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) });
      const b = await amb.participanteComTeste();
      const deOutro = await amb.participanteComTeste({ roteiro: roteiroComAlertaNa(1) });
      await amb.turmaCom(curador, [a, b]);
      await amb.turmaCom(outroRh, [deOutro]);

      const ler = async (quem: Pessoa) => {
        const r = await amb.http(quem, "GET", "/pendencias");
        expect(r.status, JSON.stringify(r.corpo)).toBe(200);
        return labPendenciasSchema.parse(r.corpo.data);
      };
      expect(await ler(curador)).toEqual({
        resultadosAguardando: 2,
        alertasAbertos: 1,
        contestacoesPendentes: 0,
        contribuicoesPendentes: 0
      });
      expect((await ler(outroRh)).resultadosAguardando).toBeGreaterThanOrEqual(1);
      expect(await ler(await amb.curador())).toEqual({
        resultadosAguardando: 0,
        alertasAbertos: 0,
        contestacoesPendentes: 0,
        contribuicoesPendentes: 0
      });

      expect((await validar(curador, a, {})).status).toBe(200);
      expect((await ler(curador)).resultadosAguardando).toBe(1);
    });
  });
});
