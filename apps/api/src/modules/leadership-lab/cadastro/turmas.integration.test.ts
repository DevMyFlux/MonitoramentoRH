// Turmas do curador, de ponta a ponta: aplicativo real, JWT real, PostgreSQL real.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Veja db/test-database.ts.
import { labTurmaDetalheSchema, labTurmaResumoSchema } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { AmbienteDoCadastro, type Operacao, type Pessoa } from "./ambiente-do-cadastro.js";

const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!integrationEnabled)("turmas do curador", () => {
  let amb: AmbienteDoCadastro;
  let opA: Operacao;
  let opB: Operacao;
  let rhA: Pessoa;
  let rhB: Pessoa;
  let rhGlobal: Pessoa;

  beforeAll(async () => {
    amb = await AmbienteDoCadastro.subir();
    opA = amb.operacaoA;
    opB = await amb.criarOperacao("Operação B");
    rhA = await amb.rhDaOperacao(opA);
    rhB = await amb.rhDaOperacao(opB);
    rhGlobal = await amb.rhGlobal();
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  async function participante(operacao?: Operacao, ativo = true, colaborador = {}) {
    const usuario = await amb.usuarioComum();
    const employeeId = await amb.colaborador(colaborador, operacao);
    return { id: await amb.vincular(usuario.id, employeeId, ativo), usuario, employeeId };
  }

  async function criarTurma(quem: Pessoa, nome = "Turma de teste") {
    const r = await amb.http(quem, "POST", "/turmas", { nome });
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return labTurmaResumoSchema.parse(r.corpo.data);
  }

  describe("quem pode", () => {
    const rotas: Array<["GET" | "POST" | "PATCH" | "DELETE", string, unknown?]> = [
      ["GET", "/turmas"],
      ["POST", "/turmas", { nome: "Turma" }],
      ["GET", `/turmas/${INEXISTENTE}`],
      ["PATCH", `/turmas/${INEXISTENTE}`, { ativa: false }],
      ["POST", `/turmas/${INEXISTENTE}/participantes`, { participanteId: INEXISTENTE }],
      ["DELETE", `/turmas/${INEXISTENTE}/participantes/${INEXISTENTE}`]
    ];

    it.each(rotas)("%s %s sem login é 401", async (metodo, caminho, corpo) => {
      expect((await amb.http(null, metodo, caminho, corpo)).status).toBe(401);
    });

    it.each(["COMUM", "ADMIN"] as const)("o perfil %s não mexe em turmas", async (papel) => {
      const pessoa = await amb.pessoa(papel, [{ isGlobal: true }]);
      for (const [metodo, caminho, corpo] of rotas) {
        const r = await amb.http(pessoa, metodo, caminho, corpo);
        expect(r.status, `${metodo} ${caminho}`).toBe(403);
        expect(r.corpo.code).toBe("LAB_FORBIDDEN");
      }
    });
  });

  describe("criar, listar e detalhar", () => {
    it("cria a turma do próprio curador, ativa e vazia, com auditoria", async () => {
      const turma = await criarTurma(rhA, "  Supervisores 2026  ");
      expect(turma).toMatchObject({ nome: "Supervisores 2026", ativa: true, nParticipantes: 0 });
      const [linha] = await amb.consulta(
        `SELECT curador_id, ativa FROM leadership_lab.turma WHERE id = $1`,
        [turma.id]
      );
      expect(linha).toEqual({ curador_id: rhA.id, ativa: true });
      expect(await amb.auditoria("LabTurma", turma.id)).toMatchObject([
        { action: "CREATE", userId: rhA.id, after: { nome: "Supervisores 2026", ativa: true } }
      ]);
    });

    it("recusa nome curto demais, longo demais, vazio ou com campo a mais", async () => {
      for (const corpo of [
        { nome: "A" },
        { nome: "   " },
        { nome: "x".repeat(81) },
        {},
        { nome: "Turma", curadorId: rhB.id },
        { nome: 7 }
      ]) {
        const r = await amb.http(rhA, "POST", "/turmas", corpo);
        expect(r.status, JSON.stringify(corpo)).toBe(400);
      }
    });

    it("o curador só vê e abre as próprias turmas", async () => {
      const deA = await criarTurma(rhA, "Turma só da A");
      const deB = await criarTurma(rhB, "Turma só da B");

      const nomes = async (quem: Pessoa) =>
        ((await amb.http(quem, "GET", "/turmas")).corpo.data as Array<{ id: string }>).map(
          (t) => t.id
        );
      expect(await nomes(rhA)).toContain(deA.id);
      expect(await nomes(rhA)).not.toContain(deB.id);
      expect(await nomes(rhB)).toContain(deB.id);
      expect(await nomes(rhB)).not.toContain(deA.id);
      // Nem o RH global lê a turma de outro curador.
      expect(await nomes(rhGlobal)).not.toContain(deA.id);

      const alheia = await amb.http(rhB, "GET", `/turmas/${deA.id}`);
      const nenhuma = await amb.http(rhB, "GET", `/turmas/${INEXISTENTE}`);
      const torta = await amb.http(rhB, "GET", `/turmas/nao-e-uuid`);
      expect(alheia.status).toBe(404);
      expect(alheia.corpo).toEqual(nenhuma.corpo);
      expect(alheia.corpo).toEqual(torta.corpo);
      expect(alheia.corpo.code).toBe("LAB_NOT_FOUND");
    });

    it("lista as ativas primeiro e conta os participantes", async () => {
      const rh = await amb.rhGlobal();
      const encerrada = await criarTurma(rh, "Encerrada");
      const aberta = await criarTurma(rh, "Aberta");
      const p = await participante();
      await amb.http(rh, "POST", `/turmas/${aberta.id}/participantes`, { participanteId: p.id });
      await amb.http(rh, "PATCH", `/turmas/${encerrada.id}`, { ativa: false });

      const lista = (await amb.http(rh, "GET", "/turmas")).corpo.data as Array<{
        id: string;
        ativa: boolean;
        nParticipantes: number;
      }>;
      lista.forEach((t) => labTurmaResumoSchema.parse(t));
      expect(lista.map((t) => t.id)).toEqual([aberta.id, encerrada.id]);
      expect(lista[0]!.nParticipantes).toBe(1);
      // As ativas vêm antes de todas as encerradas.
      const primeiraEncerrada = lista.findIndex((t) => !t.ativa);
      expect(lista.slice(primeiraEncerrada).every((t) => !t.ativa)).toBe(true);
    });

    it("o detalhe traz os participantes em ordem de nome, só com o contrato", async () => {
      const turma = await criarTurma(rhGlobal, "Com gente");
      const zeca = await participante(undefined, true, { name: "Zeca" });
      const ana = await participante(undefined, true, { name: "Ana" });
      for (const p of [zeca, ana]) {
        await amb.http(rhGlobal, "POST", `/turmas/${turma.id}/participantes`, {
          participanteId: p.id
        });
      }
      const r = await amb.http(rhGlobal, "GET", `/turmas/${turma.id}`);
      const detalhe = labTurmaDetalheSchema.parse(r.corpo.data);
      expect(detalhe.participantes.map((p) => p.colaborador.nome)).toEqual(["Ana", "Zeca"]);
      expect(detalhe.nParticipantes).toBe(2);
      expect(JSON.stringify(r.corpo)).not.toMatch(/passwordHash/i);
    });
  });

  describe("renomear, encerrar e reabrir", () => {
    it("renomeia e encerra, e registra o antes e o depois", async () => {
      const turma = await criarTurma(rhA, "Nome antigo");
      const r = await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, {
        nome: "Nome novo",
        ativa: false
      });
      expect(r.corpo.data).toMatchObject({ nome: "Nome novo", ativa: false });
      const reaberta = await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, { ativa: true });
      expect(reaberta.corpo.data).toMatchObject({ nome: "Nome novo", ativa: true });
      const trilha = await amb.auditoria("LabTurma", turma.id);
      expect(trilha.map((t) => [t.action, t.before, t.after])).toEqual([
        ["CREATE", null, { nome: "Nome antigo", ativa: true }],
        ["UPDATE", { nome: "Nome antigo", ativa: true }, { nome: "Nome novo", ativa: false }],
        ["UPDATE", { nome: "Nome novo", ativa: false }, { nome: "Nome novo", ativa: true }]
      ]);
    });

    it("pedir o que já está não muda nada nem grava auditoria", async () => {
      const turma = await criarTurma(rhA, "Igual");
      const r = await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, { nome: "Igual", ativa: true });
      expect(r.status).toBe(200);
      expect(await amb.auditoria("LabTurma", turma.id)).toHaveLength(1);
    });

    it("recusa corpo vazio, nome inválido ou campo a mais", async () => {
      const turma = await criarTurma(rhA, "Validação");
      for (const corpo of [
        {},
        { nome: "A" },
        { ativa: "sim" },
        { ativa: true, curadorId: rhB.id }
      ]) {
        expect((await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, corpo)).status).toBe(400);
      }
    });

    it("a turma de outro curador não muda", async () => {
      const turma = await criarTurma(rhA, "Intocável");
      const r = await amb.http(rhB, "PATCH", `/turmas/${turma.id}`, { nome: "Invadida" });
      expect(r.status).toBe(404);
      const [{ nome }] = await amb.consulta(`SELECT nome FROM leadership_lab.turma WHERE id = $1`, [
        turma.id
      ]);
      expect(nome).toBe("Intocável");
    });
  });

  describe("incluir e tirar participantes", () => {
    it("inclui, devolve o detalhe e registra quem entrou", async () => {
      const turma = await criarTurma(rhA, "Inclusão");
      const p = await participante(opA);
      const r = await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, {
        participanteId: p.id
      });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const detalhe = labTurmaDetalheSchema.parse(r.corpo.data);
      expect(detalhe.participantes.map((x) => x.id)).toEqual([p.id]);
      const trilha = await amb.auditoria("LabTurma", turma.id);
      expect(trilha.at(-1)).toMatchObject({
        action: "UPDATE",
        userId: rhA.id,
        operationId: opA.operationId,
        after: { participanteIncluido: p.id }
      });
    });

    it("incluir muda o que o curador enxerga: entra e sai do conjunto das turmas dele", async () => {
      const turma = await criarTurma(rhA, "Visibilidade");
      const p = await participante(opA);
      const vê = async () =>
        (await carregarParticipantesDasTurmas(amb.banco.prisma, rhA.id)).has(p.id);

      expect(await vê()).toBe(false);
      await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, { participanteId: p.id });
      expect(await vê()).toBe(true);
      // Encerrar a turma tira a visão; reabrir devolve.
      await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, { ativa: false });
      expect(await vê()).toBe(false);
      await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, { ativa: true });
      expect(await vê()).toBe(true);
      await amb.http(rhA, "DELETE", `/turmas/${turma.id}/participantes/${p.id}`);
      expect(await vê()).toBe(false);
      // E o outro curador nunca viu.
      expect((await carregarParticipantesDasTurmas(amb.banco.prisma, rhB.id)).has(p.id)).toBe(
        false
      );
    });

    it("o mesmo participante não entra duas vezes na turma, nem em duas ao mesmo tempo", async () => {
      const turma = await criarTurma(rhA, "Sem duplicar");
      const p = await participante(opA);
      const corpo = { participanteId: p.id };
      const simultaneas = await Promise.all([
        amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, corpo),
        amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, corpo)
      ]);
      expect(simultaneas.map((r) => r.status).sort()).toEqual([200, 409]);
      const repetida = await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, corpo);
      expect(repetida.status).toBe(409);
      expect(repetida.corpo.code).toBe("LAB_PARTICIPANTE_JA_NA_TURMA");
    });

    it("um participante pode estar em turmas de curadores diferentes", async () => {
      const turmaA = await criarTurma(rhGlobal, "Do global");
      const outro = await amb.rhGlobal();
      const turmaB = await criarTurma(outro, "Do outro global");
      const p = await participante();
      expect(
        (
          await amb.http(rhGlobal, "POST", `/turmas/${turmaA.id}/participantes`, {
            participanteId: p.id
          })
        ).status
      ).toBe(200);
      expect(
        (
          await amb.http(outro, "POST", `/turmas/${turmaB.id}/participantes`, {
            participanteId: p.id
          })
        ).status
      ).toBe(200);
    });

    it("participante desativado ou turma encerrada: recusa com o código certo", async () => {
      const turma = await criarTurma(rhA, "Regras");
      const inativo = await participante(opA, false);
      const r = await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, {
        participanteId: inativo.id
      });
      expect(r.status).toBe(409);
      expect(r.corpo.code).toBe("LAB_PARTICIPANTE_INATIVO");

      const ativo = await participante(opA);
      await amb.http(rhA, "PATCH", `/turmas/${turma.id}`, { ativa: false });
      const encerrada = await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, {
        participanteId: ativo.id
      });
      expect(encerrada.status).toBe(409);
      expect(encerrada.corpo.code).toBe("LAB_TURMA_INATIVA");
    });

    it("participante de fora do escopo do RH, ou que não existe: o mesmo 'não encontrado'", async () => {
      const turma = await criarTurma(rhA, "Escopo");
      const deB = await participante(opB);
      const fora = await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, {
        participanteId: deB.id
      });
      const nenhum = await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, {
        participanteId: INEXISTENTE
      });
      expect(fora.status).toBe(404);
      expect(fora.corpo).toEqual(nenhum.corpo);
      expect(
        await amb.consulta(
          `SELECT 1 FROM leadership_lab.turma_participante WHERE participante_id = $1`,
          [deB.id]
        )
      ).toEqual([]);
    });

    it("não inclui na turma de outro curador, nem tira dela", async () => {
      const turma = await criarTurma(rhA, "Alheia");
      const p = await participante(opA);
      await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, { participanteId: p.id });
      const outro = await participante(opA);

      expect(
        (
          await amb.http(rhB, "POST", `/turmas/${turma.id}/participantes`, {
            participanteId: outro.id
          })
        ).status
      ).toBe(404);
      expect(
        (await amb.http(rhB, "DELETE", `/turmas/${turma.id}/participantes/${p.id}`)).status
      ).toBe(404);
      expect(
        await amb.consulta(`SELECT 1 FROM leadership_lab.turma_participante WHERE turma_id = $1`, [
          turma.id
        ])
      ).toHaveLength(1);
    });

    it("tirar quem não está na turma é 'não encontrado' e não deixa auditoria", async () => {
      const turma = await criarTurma(rhA, "Remoção");
      const p = await participante(opA);
      const antes = (await amb.auditoria("LabTurma", turma.id)).length;
      const r = await amb.http(rhA, "DELETE", `/turmas/${turma.id}/participantes/${p.id}`);
      expect(r.status).toBe(404);
      expect((await amb.auditoria("LabTurma", turma.id)).length).toBe(antes);
    });

    it("tira o participante e registra; o participante em si continua cadastrado", async () => {
      const turma = await criarTurma(rhA, "Saída");
      const p = await participante(opA);
      await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, { participanteId: p.id });
      const r = await amb.http(rhA, "DELETE", `/turmas/${turma.id}/participantes/${p.id}`);
      expect(r.status).toBe(200);
      expect(labTurmaDetalheSchema.parse(r.corpo.data).participantes).toEqual([]);
      expect((await amb.auditoria("LabTurma", turma.id)).at(-1)).toMatchObject({
        action: "UPDATE",
        before: { participanteNaTurma: p.id },
        after: { participanteRemovido: p.id }
      });
      expect(
        await amb.consulta(`SELECT 1 FROM leadership_lab.participante WHERE id = $1`, [p.id])
      ).toHaveLength(1);
    });

    it("recusa corpo sem participanteId, com id torto ou campo a mais", async () => {
      const turma = await criarTurma(rhA, "Entrada");
      for (const corpo of [
        {},
        { participanteId: "x" },
        { participanteId: INEXISTENTE, extra: 1 }
      ]) {
        expect(
          (await amb.http(rhA, "POST", `/turmas/${turma.id}/participantes`, corpo)).status
        ).toBe(400);
      }
    });
  });
});
