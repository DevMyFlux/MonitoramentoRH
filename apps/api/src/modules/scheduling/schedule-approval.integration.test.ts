/**
 * Fluxo de aprovação de ponta a ponta (API real + Postgres real): geração, envio, reprovação com motivo, correção e
 * reenvio, aprovação, publicação, histórico de decisões, aprovação atrelada ao conteúdo e concorrência.
 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import {
  client,
  createFixture,
  createUser,
  hasDatabase,
  startApp,
  type Fixture,
  type TestUser
} from "../../test/integration.js";

const SHIFT = {
  timezone: "America/Sao_Paulo",
  startHour: 7,
  durationHours: 12,
  restHours: 36,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  minimumTeam: 0
};

describe.skipIf(!hasDatabase)("fluxo de aprovação da escala", () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof client>;
  let fx: Fixture;
  let rh: TestUser;
  let approver: TestUser;
  let t: { rh: string; approver: string };

  async function operation(withInvalidEmployee: boolean) {
    const f = await createFixture();
    await prisma.operationalParameter.create({
      data: {
        operationId: f.scope.operationId,
        kind: "SHIFT",
        code: "DIURNO",
        name: "Diurno",
        configuration: SHIFT,
        createdBy: f.seededDevId
      }
    });
    const base = {
      operationId: f.scope.operationId,
      status: "ACTIVE" as const,
      admissionDate: new Date("2020-01-01T00:00:00Z")
    };
    await prisma.employee.create({
      data: {
        ...base,
        name: "Ana Souza",
        identifier: "A1",
        initials: "ANA",
        shift: "DIURNO",
        parity: "ODD"
      }
    });
    if (withInvalidEmployee) {
      await prisma.employee.create({
        data: { ...base, name: "Felipe", identifier: "F1", initials: "FEL" }
      }); // sem turno nem rodízio
    }
    await prisma.userScope.create({ data: { userId: rh.id, isGlobal: false, ...f.scope } });
    await prisma.userScope.create({ data: { userId: approver.id, isGlobal: false, ...f.scope } });
    return f.scope.operationId;
  }

  async function generate(operationId: string, month = "2026-10") {
    const r = await api.call("POST", "/employee-schedules/generate", t.rh, { operationId, month });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.data as { id: string; status: string; revision: number; contentHash: string };
  }
  const move = (id: string, token: string, status: string, extra: Record<string, unknown> = {}) =>
    api.call("PATCH", `/schedules/${id}/status`, token, { status, ...extra });

  beforeAll(async () => {
    app = await startApp();
    api = client(app);
    fx = await createFixture();
    rh = await createUser({
      role: "RH",
      suffix: `${fx.suffix}h`,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    approver = await createUser({
      role: "APPROVER",
      suffix: `${fx.suffix}a`,
      scope: fx.scope,
      createdBy: fx.seededAdminId
    });
    t = { rh: await api.token(rh.email), approver: await api.token(approver.email) };
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  it("a escala gerada já nasce em rascunho, na revisão 1 e com o hash do conteúdo", async () => {
    const version = await generate(await operation(false));
    expect(version).toMatchObject({ status: "DRAFT", revision: 1 });
    expect(version.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("escala com problema impeditivo NÃO pode ser enviada para aprovação, e diz o que corrigir", async () => {
    const version = await generate(await operation(true));
    const r = await move(version.id, t.rh, "IN_REVIEW");
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("SCHEDULE_HAS_BLOCKING_ISSUES");
    expect(r.body.message).toContain("Não foi possível definir o turno de Felipe");
    expect(r.body.details.issues[0].action).toContain("Verifique o cadastro");
    expect(
      (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: version.id } })).status
    ).toBe("DRAFT");
  });

  describe("ciclo completo: enviar → reprovar → corrigir → reenviar → aprovar → publicar", () => {
    let id: string;
    let opId: string;

    it("RH envia; o envio registra quem e quando", async () => {
      opId = await operation(false);
      id = (await generate(opId)).id;
      const sent = await move(id, t.rh, "IN_REVIEW");
      expect(sent.status).toBe(200);
      const row = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: "IN_REVIEW", submittedBy: rh.id });
      expect(row.submittedAt).not.toBeNull();
      expect(row.revision).toBe(2);
    });

    it("reprovar exige motivo (sem motivo, nada acontece)", async () => {
      const none = await move(id, t.approver, "REJECTED");
      expect(none.status).toBe(400);
      expect(none.body.message).toContain("motivo da reprovação");
      const short = await move(id, t.approver, "REJECTED", { reason: "ruim" });
      expect(short.status).toBe(400);
      expect((await prisma.scheduleVersion.findUniqueOrThrow({ where: { id } })).status).toBe(
        "IN_REVIEW"
      );
    });

    it("RH não reprova; o Aprovador reprova com motivo, e o RH consulta o motivo", async () => {
      const byRh = await move(id, t.rh, "REJECTED", { reason: "Quero reprovar" });
      expect(byRh.status).toBe(403);

      const rejected = await move(id, t.approver, "REJECTED", {
        reason: "Faltou cobertura no feriado de 12/10"
      });
      expect(rejected.status).toBe(200);
      expect(rejected.body.data).toMatchObject({
        status: "REJECTED",
        rejectionReason: "Faltou cobertura no feriado de 12/10"
      });

      const list = await api.call("GET", "/schedules", t.rh);
      const mine = (
        list.body.data as Array<{
          id: string;
          status: string;
          rejectionReason: string | null;
          rejectedBy: string | null;
        }>
      ).find((v) => v.id === id)!;
      expect(mine).toMatchObject({
        status: "REJECTED",
        rejectionReason: "Faltou cobertura no feriado de 12/10",
        rejectedBy: approver.id
      });
    });

    it("escala reprovada não pode ser publicada nem aprovada de novo sem reenvio", async () => {
      expect((await move(id, t.rh, "PUBLISHED")).status).toBe(403);
      expect((await move(id, t.approver, "APPROVED")).status).toBe(403);
    });

    it("RH reenvia a reprovada; a reprovação anterior sai do estado atual mas fica no histórico", async () => {
      const resent = await move(id, t.rh, "IN_REVIEW");
      expect(resent.status).toBe(200);
      const row = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: "IN_REVIEW", rejectionReason: null, rejectedBy: null });
    });

    it("Aprovador aprova; a aprovação guarda o hash do conteúdo analisado", async () => {
      const approved = await move(id, t.approver, "APPROVED");
      expect(approved.status).toBe(200);
      const row = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: "APPROVED", approvedBy: approver.id });
      expect(row.approvedContentHash).toBe(row.contentHash);
    });

    it("o Aprovador não publica; o RH publica a aprovada", async () => {
      expect((await move(id, t.approver, "PUBLISHED")).status).toBe(403);
      const published = await move(id, t.rh, "PUBLISHED");
      expect(published.status).toBe(200);
      expect(published.body.data.status).toBe("PUBLISHED");
    });

    it("o histórico lista todas as decisões, na ordem, com os responsáveis e o motivo", async () => {
      const r = await api.call("GET", `/schedules/${id}/history`, t.approver);
      expect(r.status).toBe(200);
      const rows = r.body.data as Array<{ action: string; byName: string; reason: string | null }>;
      expect(rows.map((x) => x.action)).toEqual([
        "SCHEDULE_GENERATE",
        "SUBMIT",
        "REJECT",
        "SUBMIT",
        "APPROVE",
        "PUBLISH"
      ]);
      expect(rows[2]).toMatchObject({
        byName: `Teste APPROVER ${fx.suffix}a`,
        reason: "Faltou cobertura no feriado de 12/10"
      });
      expect(rows[0]!.byName).toContain("RH"); // quem gerou
      expect(rows[1]!.byName).toContain("RH"); // quem enviou
      // o histórico não carrega o conteúdo pesado da escala
      expect(JSON.stringify(r.body)).not.toContain("sections");
    });
  });

  it("uma aprovação antiga não autoriza uma versão diferente: conteúdo alterado depois de aprovar bloqueia a publicação", async () => {
    const version = await generate(await operation(false));
    await move(version.id, t.rh, "IN_REVIEW");
    expect((await move(version.id, t.approver, "APPROVED")).status).toBe(200);

    // alguém altera o conteúdo por fora do fluxo (ex.: acesso direto ao banco)
    const row = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: version.id } });
    const result = row.generatedResult as {
      grid: { sections: Array<{ rows: Array<{ days: string[] }> }> };
    };
    result.grid.sections[0]!.rows[0]!.days[0] = "C";
    await prisma.scheduleVersion.update({
      where: { id: version.id },
      data: { generatedResult: result as object }
    });

    const publish = await move(version.id, t.rh, "PUBLISHED");
    expect(publish.status).toBe(409);
    expect(publish.body.code).toBe("APPROVAL_STALE");
    expect(
      (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: version.id } })).status
    ).toBe("APPROVED");
  });

  it("conteúdo alterado durante a análise também invalida a aprovação", async () => {
    const version = await generate(await operation(false));
    await move(version.id, t.rh, "IN_REVIEW");
    const row = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: version.id } });
    const result = row.generatedResult as { metrics: { required: number } };
    result.metrics.required += 1;
    await prisma.scheduleVersion.update({
      where: { id: version.id },
      data: { generatedResult: result as object }
    });
    const approve = await move(version.id, t.approver, "APPROVED");
    expect(approve.status).toBe(409);
    expect(approve.body.code).toBe("APPROVAL_STALE");
  });

  describe("concorrência", () => {
    it("quem decide com uma revisão que já mudou é recusado", async () => {
      const version = await generate(await operation(false));
      await move(version.id, t.rh, "IN_REVIEW");
      const stale = await move(version.id, t.approver, "APPROVED", { expectedRevision: 1 }); // já está na revisão 2
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe("SCHEDULE_REVISION_CONFLICT");
      const fresh = await move(version.id, t.approver, "APPROVED", { expectedRevision: 2 });
      expect(fresh.status).toBe(200);
    });

    it("duas decisões ao mesmo tempo: só uma vale", async () => {
      const version = await generate(await operation(false));
      await move(version.id, t.rh, "IN_REVIEW");
      const [a, b] = await Promise.all([
        move(version.id, t.approver, "APPROVED", { expectedRevision: 2 }),
        move(version.id, t.approver, "REJECTED", {
          expectedRevision: 2,
          reason: "Reprovada ao mesmo tempo"
        })
      ]);
      expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
      expect([a.status, b.status].filter((s) => s !== 200)[0]).toBeGreaterThanOrEqual(403);
      const decisions = await prisma.scheduleHistory.count({
        where: { scheduleId: version.id, action: { in: ["APPROVE", "REJECT"] } }
      });
      expect(decisions).toBe(1);
    });
  });

  describe("versões substituídas", () => {
    it("publicar uma versão nova marca a publicada anterior da mesma unidade e mês como substituída (sem perder a situação)", async () => {
      const opId = await operation(false);
      const first = await generate(opId);
      for (const [token, status] of [
        [t.rh, "IN_REVIEW"],
        [t.approver, "APPROVED"],
        [t.rh, "PUBLISHED"]
      ] as const) {
        expect((await move(first.id, token, status)).status).toBe(200);
      }
      const second = await generate(opId);
      for (const [token, status] of [
        [t.rh, "IN_REVIEW"],
        [t.approver, "APPROVED"],
        [t.rh, "PUBLISHED"]
      ] as const) {
        expect((await move(second.id, token, status)).status).toBe(200);
      }
      const old = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: first.id } });
      expect(old).toMatchObject({ status: "PUBLISHED", supersededById: second.id });
      expect(old.supersededAt).not.toBeNull();
      const newest = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: second.id } });
      expect(newest.supersededAt).toBeNull();
      const history = await prisma.scheduleHistory.findMany({
        where: { scheduleId: first.id },
        orderBy: { createdAt: "asc" }
      });
      expect(history.map((h) => h.action)).toContain("SUPERSEDED");
    });

    it("uma versão substituída não pode mais ser decidida", async () => {
      const version = await generate(await operation(false));
      await move(version.id, t.rh, "IN_REVIEW");
      await prisma.scheduleVersion.update({
        where: { id: version.id },
        data: { supersededAt: new Date() }
      });
      const r = await move(version.id, t.approver, "APPROVED");
      expect(r.status).toBe(409);
      expect(r.body.code).toBe("SCHEDULE_SUPERSEDED");
    });
  });

  it("as decisões ficam na auditoria com o perfil de quem decidiu", async () => {
    const version = await generate(await operation(false));
    await move(version.id, t.rh, "IN_REVIEW");
    await move(version.id, t.approver, "REJECTED", { reason: "Auditar esta reprovação" });
    const log = await prisma.auditLog.findFirst({
      where: { entityId: version.id, action: "REJECT" }
    });
    expect(log).toMatchObject({
      userId: approver.id,
      userRole: "APPROVER",
      justification: "Auditar esta reprovação"
    });
    expect(log?.after).toMatchObject({ status: "REJECTED" });
    // o registro de auditoria é enxuto: não duplica o conteúdo inteiro da escala
    expect(JSON.stringify(log?.after)).not.toContain("sections");
  });
});
