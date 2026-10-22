/**
 * Edição de escala já gerada, de ponta a ponta (API real + Postgres real).
 * Outubro/2026: colaborador ÍMPAR trabalha nos dias ímpares e folga nos pares; o PAR, o contrário.
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
const D = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;

describe.skipIf(!hasDatabase)("edição de escalas geradas", () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof client>;
  let seed: Fixture;
  let rh: TestUser;
  let approver: TestUser;
  let t: { rh: string; approver: string };

  type Unit = { operationId: string; ana: string; bia: string };

  /** Unidade nova com Ana (ímpar) e Bia (par), e o RH e o Aprovador com acesso a ela. */
  async function unit(): Promise<Unit> {
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
      admissionDate: new Date("2020-01-01T00:00:00Z"),
      shift: "DIURNO"
    };
    const ana = await prisma.employee.create({
      data: { ...base, name: "Ana Souza", identifier: "A1", initials: "ANA", parity: "ODD" }
    });
    const bia = await prisma.employee.create({
      data: { ...base, name: "Bia Lima", identifier: "B1", initials: "BIA", parity: "EVEN" }
    });
    for (const u of [rh, approver])
      await prisma.userScope.create({ data: { userId: u.id, isGlobal: false, ...f.scope } });
    return { operationId: f.scope.operationId, ana: ana.id, bia: bia.id };
  }

  const generate = async (u: Unit) => {
    const r = await api.call("POST", "/employee-schedules/generate", t.rh, {
      operationId: u.operationId,
      month: "2026-10"
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.data as { id: string; revision: number };
  };
  const edit = (id: string, body: object, token = t.rh) =>
    api.call("PATCH", `/employee-schedules/${id}/cells`, token, body);
  const cell = async (versionId: string, employeeId: string, day: number) => {
    const v = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: versionId } });
    const rows = (
      v.generatedResult as {
        grid: { sections: Array<{ rows: Array<{ employeeId: string; days: string[] }> }> };
      }
    ).grid.sections.flatMap((s) => s.rows);
    return rows.find((r) => r.employeeId === employeeId)!.days[day - 1];
  };
  const move = (id: string, token: string, status: string, extra: object = {}) =>
    api.call("PATCH", `/schedules/${id}/status`, token, { status, ...extra });

  beforeAll(async () => {
    app = await startApp();
    api = client(app);
    seed = await createFixture();
    rh = await createUser({
      role: "RH",
      suffix: `${seed.suffix}h`,
      scope: seed.scope,
      createdBy: seed.seededAdminId
    });
    approver = await createUser({
      role: "APPROVER",
      suffix: `${seed.suffix}a`,
      scope: seed.scope,
      createdBy: seed.seededAdminId
    });
    t = { rh: await api.token(rh.email), approver: await api.token(approver.email) };
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  describe("rascunho: edita na própria versão", () => {
    it("a edição muda a grade de verdade, o hash, a revisão, o histórico e os ajustes do mês", async () => {
      const u = await unit();
      const v = await generate(u);
      expect(await cell(v.id, u.ana, 2)).toBe("F"); // Ana folga nos pares
      const before = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir falta da Bia" }]
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data).toMatchObject({
        changed: true,
        derived: false,
        versionId: v.id,
        revision: v.revision + 1
      });

      const after = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(await cell(v.id, u.ana, 2)).toBe("C");
      expect(after.contentHash).not.toBe(before.contentHash);
      expect(after.revision).toBe(before.revision + 1);
      expect(after.status).toBe("DRAFT");

      // o ajuste fica registrado para as próximas gerações da unidade
      const override = await prisma.scheduleDayOverride.findFirstOrThrow({
        where: {
          operationId: u.operationId,
          employeeId: u.ana,
          date: new Date(`${D(2)}T00:00:00Z`)
        }
      });
      expect(override).toMatchObject({
        code: "C",
        reason: "Cobrir falta da Bia",
        status: "ACTIVE"
      });

      // histórico: quem, quando, antes/depois e o motivo
      const log = await prisma.scheduleHistory.findFirstOrThrow({
        where: { scheduleId: v.id, action: "EDIT" }
      });
      expect(log.createdBy).toBe(rh.id);
      expect(
        (log.after as { changes: Array<{ from: string; to: string; employeeName: string }> })
          .changes
      ).toEqual([
        expect.objectContaining({
          from: "F",
          to: "C",
          employeeName: "Ana Souza",
          reason: "Cobrir falta da Bia"
        })
      ]);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: v.id, action: "UPDATE", entity: "ScheduleVersion" }
      });
      expect(audit.userRole).toBe("RH");
      expect(JSON.stringify(audit.after)).not.toContain("sections"); // auditoria enxuta
    });

    it("a edição entra na exportação (antes só valia na próxima geração e o arquivo ignorava)", async () => {
      const u = await unit();
      await prisma.operation.update({ where: { id: u.operationId }, data: { code: "HMB" } }); // unidade com modelo de planilha
      const v = await generate(u);
      const exportar = async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/employee-schedules/${v.id}/export`,
          headers: { authorization: `Bearer ${t.rh}` }
        });
        expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
        return res.rawPayload;
      };
      const antes = await exportar();
      await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      });
      const depois = await exportar();
      expect(Buffer.compare(antes, depois)).not.toBe(0);
    });

    it("processar de novo a mesma edição não muda nada (idempotente)", async () => {
      const u = await unit();
      const v = await generate(u);
      const body = {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      };
      const first = await edit(v.id, body);
      expect(first.body.data.changed).toBe(true);
      const second = await edit(v.id, { ...body, expectedRevision: first.body.data.revision });
      expect(second.status).toBe(200);
      expect(second.body.data).toMatchObject({
        changed: false,
        revision: first.body.data.revision
      });
      expect(
        await prisma.scheduleHistory.count({ where: { scheduleId: v.id, action: "EDIT" } })
      ).toBe(1);
    });

    it("voltar ao que a regra manda remove o ajuste do mês e não pede justificativa", async () => {
      const u = await unit();
      const v = await generate(u);
      const first = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      });
      const back = await edit(v.id, {
        expectedRevision: first.body.data.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "F" }]
      });
      expect(back.status, JSON.stringify(back.body)).toBe(200);
      expect(await cell(v.id, u.ana, 2)).toBe("F");
      const override = await prisma.scheduleDayOverride.findFirstOrThrow({
        where: {
          operationId: u.operationId,
          employeeId: u.ana,
          date: new Date(`${D(2)}T00:00:00Z`)
        }
      });
      expect(override.status).toBe("ARCHIVED");
    });

    it("recalcula as métricas de cobertura", async () => {
      const u = await unit();
      const v = await generate(u);
      const before = (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } }))
        .generatedResult as { metrics: { covered: number } };
      const r = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      });
      expect(r.body.data.metrics.covered).toBe(before.metrics.covered + 1);
    });
  });

  describe("edições inválidas são recusadas com mensagem clara e NADA é gravado", () => {
    it("turno normal em dia de folga", async () => {
      const u = await unit();
      const v = await generate(u);
      const r = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "D", reason: "x" }]
      });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe("SCHEDULE_EDIT_INVALID");
      expect(r.body.details.issues[0]).toMatchObject({
        code: "EDIT_WORK_ON_REST_DAY",
        severity: "blocking"
      });
      expect(r.body.details.issues[0].action).toContain("Cobertura (C)");
      const row = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(row.revision).toBe(v.revision);
      expect(await cell(v.id, u.ana, 2)).toBe("F");
      expect(
        await prisma.scheduleHistory.count({ where: { scheduleId: v.id, action: "EDIT" } })
      ).toBe(0);
    });

    it("fugir do rodízio sem justificativa", async () => {
      const u = await unit();
      const v = await generate(u);
      const r = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C" }]
      });
      expect(r.status).toBe(409);
      expect(r.body.details.issues.map((i: { code: string }) => i.code)).toContain(
        "EDIT_JUSTIFICATION_REQUIRED"
      );
      // a recusa também diz o que a regra mandaria, para a tela saber que este dia foge do rodízio
      expect(r.body.details.cells).toEqual([
        { employeeId: u.ana, date: D(2), current: "F", rule: "F" }
      ]);
      const ok = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C" }],
        justification: "Cobrir a falta"
      });
      expect(ok.status).toBe(200);
    });

    it("colaborador de férias não é escalado, e férias não se lançam na mão", async () => {
      const u = await unit();
      const type = await prisma.eventType.upsert({
        where: { code: "FR" },
        update: {},
        create: { code: "FR", name: "Férias", category: "VACATION", blocksAvailability: true }
      });
      await prisma.calendarEvent.create({
        data: {
          typeId: type.id,
          employeeId: u.bia,
          operationId: u.operationId,
          title: "Férias",
          startsAt: new Date("2026-10-05T00:00:00Z"),
          endsAt: new Date("2026-10-12T23:59:59Z")
        }
      });
      const v = await generate(u);
      expect(await cell(v.id, u.bia, 6)).toBe("FR");
      const work = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.bia, date: D(6), code: "D", reason: "cobrir" }]
      });
      expect(work.status).toBe(409);
      expect(work.body.details.issues[0]).toMatchObject({ code: "EDIT_EMPLOYEE_ON_LEAVE" });
      expect(work.body.details.issues[0].detail).toContain("Férias");
      const fake = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(3), code: "FR", reason: "x" }]
      });
      expect(fake.body.details.issues[0]).toMatchObject({ code: "EDIT_LEAVE_CODE_NOT_ALLOWED" });
    });

    it("avisos não impedem: a edição é gravada e os avisos voltam na resposta", async () => {
      const u = await unit();
      const v = await generate(u);
      const r = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      });
      expect(r.status).toBe(200);
      expect(r.body.data.issues.map((i: { code: string }) => i.code)).toContain(
        "EDIT_REST_TIME_SHORT"
      );
    });

    it("célula que já está com o código pedido não é edição: não revalida (nem em férias) e informa a regra", async () => {
      const u = await unit();
      const type = await prisma.eventType.upsert({
        where: { code: "FR" },
        update: {},
        create: { code: "FR", name: "Férias", category: "VACATION", blocksAvailability: true }
      });
      await prisma.calendarEvent.create({
        data: {
          typeId: type.id,
          employeeId: u.bia,
          operationId: u.operationId,
          title: "Férias",
          startsAt: new Date("2026-10-05T00:00:00Z"),
          endsAt: new Date("2026-10-12T23:59:59Z")
        }
      });
      const v = await generate(u);
      const same = await edit(v.id, {
        expectedRevision: v.revision,
        dryRun: true,
        changes: [{ employeeId: u.bia, date: D(6), code: "FR" }]
      });
      expect(same.status, JSON.stringify(same.body)).toBe(200);
      expect(same.body.data).toMatchObject({
        changed: false,
        cells: [{ employeeId: u.bia, date: D(6), current: "FR", rule: "FR" }]
      });

      // depois de um ajuste manual, a consulta mostra o código atual e o que a regra mandaria
      const done = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      });
      const probe = await edit(v.id, {
        expectedRevision: done.body.data.revision,
        dryRun: true,
        changes: [{ employeeId: u.ana, date: D(2), code: "C" }]
      });
      expect(probe.body.data.cells).toEqual([
        { employeeId: u.ana, date: D(2), current: "C", rule: "F" }
      ]);
    });

    it("dryRun valida e mostra o efeito sem gravar nada", async () => {
      const u = await unit();
      const v = await generate(u);
      const r = await edit(v.id, {
        expectedRevision: v.revision,
        dryRun: true,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Cobrir" }]
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ dryRun: true, changed: true, revision: v.revision });
      expect(await cell(v.id, u.ana, 2)).toBe("F");
      expect(
        (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } })).revision
      ).toBe(v.revision);
    });
  });

  describe("quem edita e quando", () => {
    it("Aprovador e Comum não editam (403 no servidor)", async () => {
      const u = await unit();
      const v = await generate(u);
      const body = {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "x" }]
      };
      const r = await edit(v.id, body, t.approver);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("PERMISSION_DENIED");
    });

    it("não edita escala de outra unidade", async () => {
      const mine = await unit();
      const v = await generate(mine);
      const other = await createFixture();
      const outsider = await createUser({
        role: "RH",
        suffix: `${other.suffix}x`,
        scope: other.scope,
        createdBy: other.seededAdminId
      });
      const token = await api.token(outsider.email);
      const r = await edit(
        v.id,
        {
          expectedRevision: v.revision,
          changes: [{ employeeId: mine.ana, date: D(2), code: "C", reason: "x" }]
        },
        token
      );
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("SCOPE_FORBIDDEN");
    });

    it("editar com uma revisão que já mudou é recusado", async () => {
      const u = await unit();
      const v = await generate(u);
      await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "x" }]
      });
      const stale = await edit(v.id, {
        expectedRevision: v.revision,
        changes: [{ employeeId: u.bia, date: D(3), code: "C", reason: "y" }]
      });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe("SCHEDULE_REVISION_CONFLICT");
    });

    it("duas edições ao mesmo tempo: só uma vale", async () => {
      const u = await unit();
      const v = await generate(u);
      const body = (day: number, id: string) => ({
        expectedRevision: v.revision,
        changes: [{ employeeId: id, date: D(day), code: "C", reason: "x" }]
      });
      const [a, b] = await Promise.all([edit(v.id, body(2, u.ana)), edit(v.id, body(3, u.bia))]);
      expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
      expect([a.status, b.status].filter((s) => s !== 200)[0]).toBe(409);
    });
  });

  describe("editar uma escala já enviada, aprovada ou publicada gera nova versão e invalida a aprovação", () => {
    const edited = (u: Unit, revision: number) => ({
      expectedRevision: revision,
      changes: [{ employeeId: u.ana, date: D(2), code: "C", reason: "Ajuste pedido" }]
    });

    it("em análise: nasce um rascunho; a versão em análise fica substituída e não pode mais ser aprovada", async () => {
      const u = await unit();
      const v = await generate(u);
      await move(v.id, t.rh, "IN_REVIEW");
      const sent = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await edit(v.id, edited(u, sent.revision));
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data).toMatchObject({ derived: true, previousVersionId: v.id });
      const novo = await prisma.scheduleVersion.findUniqueOrThrow({
        where: { id: r.body.data.versionId }
      });
      expect(novo).toMatchObject({ status: "DRAFT", basedOnVersionId: v.id, revision: 1 });
      expect(novo.version).toBe(sent.version + 1);
      expect(await cell(novo.id, u.ana, 2)).toBe("C");

      // a original continua como estava (e como foi enviada) — só ficou substituída
      const old = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(old).toMatchObject({ status: "IN_REVIEW", supersededById: novo.id });
      expect(await cell(v.id, u.ana, 2)).toBe("F");
      const approve = await move(v.id, t.approver, "APPROVED");
      expect(approve.status).toBe(409);
      expect(approve.body.code).toBe("SCHEDULE_SUPERSEDED");
      expect(
        (await prisma.scheduleHistory.findMany({ where: { scheduleId: v.id } })).map(
          (h) => h.action
        )
      ).toContain("SUPERSEDED");
    });

    it("aprovada: a aprovação NÃO vale para a versão nova, que precisa de nova análise", async () => {
      const u = await unit();
      const v = await generate(u);
      await move(v.id, t.rh, "IN_REVIEW");
      await move(v.id, t.approver, "APPROVED");
      const approved = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await edit(v.id, edited(u, approved.revision));
      const novoId = r.body.data.versionId as string;
      const novo = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: novoId } });
      expect(novo).toMatchObject({ status: "DRAFT", approvedBy: null, approvedContentHash: null });
      expect((await move(novoId, t.rh, "PUBLISHED")).status).toBe(403); // rascunho não publica
      // a versão aprovada antiga também não pode mais ser publicada: foi substituída
      expect((await move(v.id, t.rh, "PUBLISHED")).body.code).toBe("SCHEDULE_SUPERSEDED");
      // o ciclo recomeça na versão nova
      expect((await move(novoId, t.rh, "IN_REVIEW")).status).toBe(200);
      expect((await move(novoId, t.approver, "APPROVED")).status).toBe(200);
      expect((await move(novoId, t.rh, "PUBLISHED")).status).toBe(200);
    });

    it("publicada: a publicada continua no ar até a nova ser publicada (republicação com histórico)", async () => {
      const u = await unit();
      const v = await generate(u);
      for (const [token, status] of [
        [t.rh, "IN_REVIEW"],
        [t.approver, "APPROVED"],
        [t.rh, "PUBLISHED"]
      ] as const)
        await move(v.id, token, status);
      const published = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await edit(v.id, edited(u, published.revision));
      expect(r.body.data.derived).toBe(true);
      expect(await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject(
        { status: "PUBLISHED", supersededAt: null }
      );
      const novoId = r.body.data.versionId as string;
      for (const [token, status] of [
        [t.rh, "IN_REVIEW"],
        [t.approver, "APPROVED"],
        [t.rh, "PUBLISHED"]
      ] as const) {
        expect((await move(novoId, token, status)).status).toBe(200);
      }
      const old = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(old).toMatchObject({ status: "PUBLISHED", supersededById: novoId });
      expect(
        (await prisma.scheduleHistory.findMany({ where: { scheduleId: v.id } })).map(
          (h) => h.action
        )
      ).toEqual(expect.arrayContaining(["PUBLISH", "NEW_VERSION_DRAFTED", "SUPERSEDED"]));
    });

    it("reprovada: volta a ser editável na MESMA versão e segue reprovada até ser reenviada", async () => {
      const u = await unit();
      const v = await generate(u);
      await move(v.id, t.rh, "IN_REVIEW");
      await move(v.id, t.approver, "REJECTED", { reason: "Faltou cobrir o dia 2" });
      const rejected = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await edit(v.id, edited(u, rejected.revision));
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data).toMatchObject({ derived: false, versionId: v.id });
      const after = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(after).toMatchObject({ status: "REJECTED", rejectionReason: "Faltou cobrir o dia 2" });
      expect(await cell(v.id, u.ana, 2)).toBe("C");
      // reenvia e o fluxo segue
      expect((await move(v.id, t.rh, "IN_REVIEW")).status).toBe(200);
      expect((await move(v.id, t.approver, "APPROVED")).status).toBe(200);
    });
  });

  it("uma escala gerada antes desta funcionalidade (sem a grade) não é editável e diz por quê", async () => {
    const f = await createFixture();
    await prisma.userScope.create({ data: { userId: rh.id, isGlobal: false, ...f.scope } });
    const legacy = await prisma.scheduleVersion.create({
      data: {
        operationId: f.scope.operationId,
        month: new Date("2026-10-01T00:00:00Z"),
        version: 1,
        status: "DRAFT",
        generatedInput: {},
        generatedResult: { duties: [] },
        createdBy: rh.id
      }
    });
    const r = await edit(legacy.id, {
      expectedRevision: 1,
      changes: [{ employeeId: rh.id, date: D(2), code: "C", reason: "x" }]
    });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("SCHEDULE_NOT_EDITABLE");
  });
});
