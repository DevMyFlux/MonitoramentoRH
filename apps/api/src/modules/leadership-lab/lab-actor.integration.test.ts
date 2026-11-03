// Leadership Lab: carregar o ator a partir do banco e aplicar a matriz de ponta a ponta.
// Exige PostgreSQL real (LAB_TEST_DATABASE_URL); sem ele, é ignorado. Veja db/test-database.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigrations,
  createTestDatabase,
  integrationEnabled,
  type TestDatabase
} from "./db/test-database.js";
import {
  type Base,
  criarBase,
  criarParticipante,
  criarUsuario,
  inserir
} from "./db/test-fixtures.js";
import { HttpError } from "../../lib/http-error.js";
import { assertAcesso } from "./lab-access.js";
import { carregarAtorLab, carregarParticipantesDasTurmas } from "./lab-actor.js";

describe.skipIf(!integrationEnabled)("ator do Leadership Lab", () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let base: Base;

  beforeAll(async () => {
    db = await createTestDatabase();
    await applyMigrations(db.client);
    base = await criarBase(db.client);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: db.url }) });
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  const usuario = (id: string, role: AuthenticatedUser["role"]): AuthenticatedUser => ({
    id,
    role,
    email: "x@teste.local",
    name: "X",
    scopes: []
  });

  const conceder = (userId: string, permissao: string) =>
    db.client.query(
      `INSERT INTO leadership_lab.permissao_usuario (user_id, permissao) VALUES ($1, $2)`,
      [userId, permissao]
    );

  describe("carregarAtorLab", () => {
    it("traz o vínculo e as permissões do usuário", async () => {
      const ctx = await criarParticipante(db.client, base);
      await conceder(ctx.userId, "lab_gestao");
      await conceder(ctx.userId, "lab_especialista");

      const ator = await carregarAtorLab(prisma, usuario(ctx.userId, "COMUM"));

      expect(ator).toMatchObject({
        userId: ctx.userId,
        role: "COMUM",
        participanteId: ctx.participanteId
      });
      expect([...ator.permissoes].sort()).toEqual(["lab_especialista", "lab_gestao"]);
    });

    it("usuário sem vínculo fica sem participanteId e sem permissões", async () => {
      const userId = await criarUsuario(db.client, base);
      expect(await carregarAtorLab(prisma, usuario(userId, "COMUM"))).toEqual({
        userId,
        role: "COMUM",
        participanteId: null,
        permissoes: []
      });
    });

    it("vínculo desativado vale como ausência de vínculo", async () => {
      const ctx = await criarParticipante(db.client, base);
      await db.client.query(`UPDATE leadership_lab.participante SET ativo = false WHERE id = $1`, [
        ctx.participanteId
      ]);
      expect(
        (await carregarAtorLab(prisma, usuario(ctx.userId, "COMUM"))).participanteId
      ).toBeNull();
    });

    it("não mistura permissões de usuários diferentes", async () => {
      const a = await criarParticipante(db.client, base);
      const b = await criarParticipante(db.client, base);
      await conceder(a.userId, "lab_gestao");
      expect((await carregarAtorLab(prisma, usuario(b.userId, "COMUM"))).permissoes).toEqual([]);
    });

    it("o perfil vem do usuário autenticado, não do vínculo", async () => {
      const ctx = await criarParticipante(db.client, base);
      const ator = await carregarAtorLab(prisma, usuario(ctx.userId, "DEV"));
      expect(ator.role).toBe("DEV");
      // Mesmo vinculado, DEV não faz testes.
      expect(() => assertAcesso(ator, "sessao:iniciar")).toThrow(HttpError);
    });
  });

  describe("carregarParticipantesDasTurmas", () => {
    async function novaTurma(curadorId: string, ativa: boolean, participantes: string[]) {
      const turmaId = await inserir(db.client, "leadership_lab.turma", {
        nome: "Turma",
        curador_id: curadorId,
        ativa
      });
      for (const participanteId of participantes) {
        await db.client.query(
          `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
          [turmaId, participanteId]
        );
      }
    }

    it("devolve só os participantes das turmas ativas do próprio curador", async () => {
      const curador = await criarUsuario(db.client, base);
      const outroCurador = await criarUsuario(db.client, base);
      // Em sequência: um pg.Client executa uma consulta por vez.
      const p1 = await criarParticipante(db.client, base);
      const p2 = await criarParticipante(db.client, base);
      const p3 = await criarParticipante(db.client, base);
      const p4 = await criarParticipante(db.client, base);

      await novaTurma(curador, true, [p1.participanteId, p2.participanteId]);
      await novaTurma(curador, false, [p3.participanteId]); // turma encerrada
      await novaTurma(outroCurador, true, [p4.participanteId]); // de outro curador

      const alcance = await carregarParticipantesDasTurmas(prisma, curador);
      expect([...alcance].sort()).toEqual([p1.participanteId, p2.participanteId].sort());
    });

    it("curador sem turmas não alcança ninguém", async () => {
      const curador = await criarUsuario(db.client, base);
      expect((await carregarParticipantesDasTurmas(prisma, curador)).size).toBe(0);
    });
  });

  describe("matriz aplicada com dados reais", () => {
    it("o participante responde a própria sessão e recebe 404 na do colega", async () => {
      const ana = await criarParticipante(db.client, base);
      const bia = await criarParticipante(db.client, base);
      const sessaoDaBia = await inserir(db.client, "leadership_lab.sessao", {
        participante_id: bia.participanteId,
        molde_id: base.moldeId
      });
      const sessao = await prisma.labSessao.findUniqueOrThrow({ where: { id: sessaoDaBia } });

      const bianca = await carregarAtorLab(prisma, usuario(bia.userId, "COMUM"));
      expect(() =>
        assertAcesso(bianca, "sessao:responder", { participanteId: sessao.participanteId })
      ).not.toThrow();

      const anaAtor = await carregarAtorLab(prisma, usuario(ana.userId, "COMUM"));
      const erro = (() => {
        try {
          assertAcesso(anaAtor, "sessao:responder", { participanteId: sessao.participanteId });
        } catch (e) {
          return e as HttpError;
        }
        throw new Error("Ana não deveria acessar a sessão da Bia.");
      })();
      expect(erro.statusCode).toBe(404);
    });

    it("o curador lê o resultado de quem está na turma dele e não o de quem está fora", async () => {
      const curador = await criarUsuario(db.client, base);
      const naTurma = await criarParticipante(db.client, base);
      const foraDaTurma = await criarParticipante(db.client, base);
      const turma = await inserir(db.client, "leadership_lab.turma", {
        nome: "T",
        curador_id: curador
      });
      await db.client.query(
        `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
        [turma, naTurma.participanteId]
      );

      const ator = await carregarAtorLab(prisma, usuario(curador, "RH"));
      const participantesDasTurmas = await carregarParticipantesDasTurmas(prisma, curador);

      expect(() =>
        assertAcesso(ator, "resultado:ler", {
          participanteId: naTurma.participanteId,
          participantesDasTurmas
        })
      ).not.toThrow();
      expect(() =>
        assertAcesso(ator, "resultado:ler", {
          participanteId: foraDaTurma.participanteId,
          participantesDasTurmas
        })
      ).toThrow(expect.objectContaining({ statusCode: 404 }));
    });

    it("a permissão lab_gestao concedida no banco passa a valer na requisição seguinte", async () => {
      const ctx = await criarParticipante(db.client, base);
      const antes = await carregarAtorLab(prisma, usuario(ctx.userId, "COMUM"));
      expect(() => assertAcesso(antes, "agregados:ler")).toThrow(
        expect.objectContaining({ statusCode: 403 })
      );

      await conceder(ctx.userId, "lab_gestao");
      const depois = await carregarAtorLab(prisma, usuario(ctx.userId, "COMUM"));
      expect(() => assertAcesso(depois, "agregados:ler")).not.toThrow();
    });
  });
});
