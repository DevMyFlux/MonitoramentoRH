/**
 * Substituição temporária durante afastamentos, de ponta a ponta (API real + Postgres real).
 * Outubro/2026: ÍMPAR trabalha nos dias ímpares e folga nos pares; PAR, o contrário.
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
const D = (day: number, month = 10) =>
  `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const at = (date: string) => `${date}T00:00:00.000Z`;

describe.skipIf(!hasDatabase)("substituição temporária", () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof client>;
  let seed: Fixture;
  let rh: TestUser;
  let approver: TestUser;
  let t: { rh: string; approver: string };
  let frTypeId: string;
  let atTypeId: string;

  type Unit = { operationId: string; ana: string; bia: string; carlos: string };

  /** Unidade nova com Ana (ímpar), Bia (par) e Carlos (ímpar), e RH/Aprovador com acesso a ela. */
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
    const mk = (name: string, id: string, parity: "ODD" | "EVEN") =>
      prisma.employee.create({
        data: { ...base, name, identifier: id, initials: id, parity }
      });
    const [ana, bia, carlos] = [
      await mk("Ana Souza", "A1", "ODD"),
      await mk("Bia Lima", "B1", "EVEN"),
      await mk("Carlos Dias", "C1", "ODD")
    ];
    for (const u of [rh, approver])
      await prisma.userScope.create({ data: { userId: u.id, isGlobal: false, ...f.scope } });
    return { operationId: f.scope.operationId, ana: ana!.id, bia: bia!.id, carlos: carlos!.id };
  }

  const leave = async (employeeId: string, from: string, to: string, typeId = frTypeId) => {
    const r = await api.call("POST", "/calendar/events", t.rh, {
      typeId,
      employeeId,
      title: "Férias",
      startsAt: at(from),
      endsAt: at(to),
      allDay: true
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.data.id as string;
  };
  const generate = async (u: Unit, month = "2026-10") => {
    const r = await api.call("POST", "/employee-schedules/generate", t.rh, {
      operationId: u.operationId,
      month
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.data as { id: string; revision: number };
  };
  const substitute = (body: object, token = t.rh) =>
    api.call("POST", "/substitutions", token, body);
  const days = async (versionId: string, employeeId: string) => {
    const v = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: versionId } });
    const rows = (
      v.generatedResult as {
        grid: { sections: Array<{ rows: Array<{ employeeId: string; days: string[] }> }> };
      }
    ).grid.sections.flatMap((s) => s.rows);
    return rows.find((r) => r.employeeId === employeeId)!.days;
  };
  const withCode = (list: string[], code: string) =>
    list.flatMap((c, i) => (c === code ? [i + 1] : []));
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
    frTypeId = (
      await prisma.eventType.upsert({
        where: { code: "FR" },
        update: {},
        create: { code: "FR", name: "Férias", category: "LEAVE", blocksAvailability: true }
      })
    ).id;
    atTypeId = (
      await prisma.eventType.upsert({
        where: { code: "AT" },
        update: {},
        create: { code: "AT", name: "Atestado", category: "LEAVE", blocksAvailability: true }
      })
    ).id;
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  describe("quem pode o quê (no servidor)", () => {
    it("o Aprovador consulta, mas não configura, altera, cancela nem aplica", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(created.status, JSON.stringify(created.body)).toBe(200);
      const id = created.body.data.substitution.id as string;

      expect(
        (
          await substitute(
            { leaveEventId: leaveId, substituteId: u.carlos, rotation: "HABITUAL" },
            t.approver
          )
        ).status
      ).toBe(403);
      expect(
        (await api.call("PATCH", `/substitutions/${id}`, t.approver, { notes: "x" })).status
      ).toBe(403);
      expect(
        (
          await api.call("POST", `/substitutions/${id}/cancel`, t.approver, {
            reason: "motivo qualquer"
          })
        ).status
      ).toBe(403);
      expect((await api.call("POST", `/substitutions/${id}/apply`, t.approver, {})).status).toBe(
        403
      );
      const list = await api.call("GET", `/substitutions?leaveEventId=${leaveId}`, t.approver);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({
        titularName: "Ana Souza",
        substituteName: "Bia Lima"
      });
    });

    it("sem login nada é permitido", async () => {
      expect((await api.call("GET", "/substitutions")).status).toBe(401);
      expect((await api.call("POST", "/substitutions", undefined, {})).status).toBe(401);
    });
  });

  describe("configuração e plano", () => {
    it("dryRun mostra o plano sem gravar nada; gravar registra a configuração e a auditoria", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const body = { leaveEventId: leaveId, substituteId: u.bia, rotation: "HABITUAL" };

      const preview = await substitute({ ...body, dryRun: true });
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      expect(preview.body.data).toMatchObject({ dryRun: true });
      expect(preview.body.data.plan).toMatchObject({
        demandCount: 5,
        coveredCount: 5,
        uncoveredCount: 0
      });
      expect(preview.body.data.plan.months[0].coveredDates).toEqual(
        [11, 13, 15, 17, 19].map((d) => D(d))
      );
      expect(await prisma.leaveSubstitution.count({ where: { operationId: u.operationId } })).toBe(
        0
      );

      const saved = await substitute(body);
      expect(saved.status).toBe(200);
      const row = await prisma.leaveSubstitution.findFirstOrThrow({
        where: { operationId: u.operationId }
      });
      expect(row).toMatchObject({
        leaveEventId: leaveId,
        titularId: u.ana,
        substituteId: u.bia,
        rotation: "HABITUAL",
        status: "ACTIVE",
        createdBy: rh.id
      });
      const trail = await prisma.auditLog.findMany({
        where: { entity: "LeaveSubstitution", entityId: row.id }
      });
      expect(trail.map((a) => a.action)).toEqual(["CREATE"]);
      expect(trail[0]!.userId).toBe(rh.id);
    });

    it("recusa o que não faz sentido, com mensagem clara", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const other = await unit();
      const base = { leaveEventId: leaveId, rotation: "HABITUAL" };

      const same = await substitute({ ...base, substituteId: u.ana });
      expect([same.status, same.body.error?.code ?? same.body.code]).toEqual([
        409,
        "SUBSTITUTION_SAME_PERSON"
      ]);

      const foreign = await substitute({ ...base, substituteId: other.bia });
      expect(foreign.status).toBe(409);
      expect(foreign.body.error?.code ?? foreign.body.code).toBe("SUBSTITUTE_OUT_OF_UNIT");

      const outside = await substitute({ ...base, substituteId: u.bia, coveredDates: [D(25)] });
      expect(outside.status).toBe(400);
      expect(outside.body.error?.code ?? outside.body.code).toBe(
        "SUBSTITUTION_DATES_OUTSIDE_LEAVE"
      );

      const noParity = await substitute({ ...base, substituteId: u.bia, rotation: "SPECIFIC" });
      expect(noParity.status).toBe(400); // rodízio específico exige Par ou Ímpar

      // não é afastamento de colaborador / tipo que não bloqueia
      const loose = await api.call("POST", "/calendar/events", t.rh, {
        typeId: frTypeId,
        operationId: u.operationId,
        title: "Evento da unidade",
        startsAt: at(D(10)),
        endsAt: at(D(12)),
        allDay: true
      });
      const orgLevel = await substitute({
        ...base,
        leaveEventId: loose.body.data.id,
        substituteId: u.bia
      });
      expect(orgLevel.status).toBe(409);
      expect(orgLevel.body.error?.code ?? orgLevel.body.code).toBe("SUBSTITUTION_LEAVE_INVALID");

      expect((await substitute({ ...base, substituteId: u.bia })).status).toBe(200);
      const dup = await substitute({ ...base, substituteId: u.bia });
      expect(dup.status).toBe(409);
      expect(dup.body.error?.code ?? dup.body.code).toBe("SUBSTITUTION_DUPLICATE");
    });

    it("recusa a configuração que não cobriria nenhum plantão, explicando o motivo (mesmo rodízio do titular)", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.carlos,
        rotation: "HABITUAL"
      });
      expect(r.status).toBe(409);
      expect(r.body.error?.code ?? r.body.code).toBe("SUBSTITUTION_NOTHING_TO_COVER");
      const issues = (r.body.error?.details ?? r.body.details).issues as Array<{
        code: string;
        title: string;
        action: string;
      }>;
      expect(issues[0]).toMatchObject({ code: "SUBSTITUTION_SUBSTITUTE_ON_DUTY" });
      expect(issues[0]!.title).toContain("Ana Souza");
      expect(issues[0]!.action).toBeTruthy();
      expect(await prisma.leaveSubstitution.count({ where: { operationId: u.operationId } })).toBe(
        0
      );
    });
  });

  describe("aplicação nas escalas já geradas", () => {
    it("rascunho: atualiza só as células afetadas, no histórico, sem criar ajuste manual — e reaplicar não muda nada", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([]);
      const before = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      const biaBefore = await days(v.id, u.bia);

      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.schedules[0]).toMatchObject({
        month: "2026-10",
        outcome: "UPDATED",
        changedCells: 5,
        status: "DRAFT"
      });

      const bia = await days(v.id, u.bia);
      expect(withCode(bia, "C")).toEqual([11, 13, 15, 17, 19]);
      // o resto da linha da Bia e a da Ana não mudaram
      bia.forEach((code, i) => {
        if (![11, 13, 15, 17, 19].includes(i + 1)) expect(code).toBe(biaBefore[i]);
      });
      expect(withCode(await days(v.id, u.ana), "FR")).toHaveLength(11);

      const after = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(after.revision).toBe(before.revision + 1);
      expect(after.contentHash).not.toBe(before.contentHash);
      const history = await prisma.scheduleHistory.findFirstOrThrow({
        where: { scheduleId: v.id, action: "EDIT" },
        orderBy: { createdAt: "desc" }
      });
      expect(history.createdBy).toBe(rh.id);
      expect(history.reason).toContain("Bia Lima cobre Ana Souza");
      expect(history.after).toMatchObject({ origin: "SUBSTITUTION" });
      // não é ajuste manual: a cobertura não vira ScheduleDayOverride
      expect(
        await prisma.scheduleDayOverride.count({ where: { operationId: u.operationId } })
      ).toBe(0);

      // idempotência: aplicar de novo a mesma configuração não duplica nem altera nada
      const id = r.body.data.substitution.id as string;
      const again = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {});
      expect(again.status).toBe(200);
      expect(again.body.data.schedules[0]).toMatchObject({ outcome: "UNCHANGED" });
      const same = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(same.revision).toBe(after.revision);
      expect(same.contentHash).toBe(after.contentHash);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 15, 17, 19]);
    });

    it("afastamento cadastrado DEPOIS de a escala ser gerada: a substituição leva também o afastamento para a linha do titular", async () => {
      const u = await unit();
      const v = await generate(u); // gerada antes das férias existirem
      expect(withCode(await days(v.id, u.ana), "FR")).toEqual([]);
      const leaveId = await leave(u.ana, D(10), D(20));
      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.schedules[0]).toMatchObject({ outcome: "UPDATED", changedCells: 16 });
      expect(withCode(await days(v.id, u.ana), "FR")).toHaveLength(11); // 11 dias de férias na linha da Ana
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 15, 17, 19]);
    });

    it("uma geração nova (depois da substituição) já incorpora as coberturas", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      expect(
        (await substitute({ leaveEventId: leaveId, substituteId: u.bia, rotation: "HABITUAL" }))
          .status
      ).toBe(200);
      const v = await generate(u);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 15, 17, 19]);
      const stored = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      const cells = (stored.generatedResult as { substitutionCells: Array<{ employeeId: string }> })
        .substitutionCells;
      expect(cells).toHaveLength(5);
      expect(cells.every((c) => c.employeeId === u.bia)).toBe(true);
    });

    it("sem escala gerada para o mês, a configuração é salva e o mês aparece como 'ainda não gerada'", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(r.body.data.schedules).toEqual([
        expect.objectContaining({ month: "2026-10", outcome: "NO_SCHEDULE", versionId: null })
      ]);
    });

    it("escala em análise NÃO é alterada em silêncio: pede confirmação e, confirmada, cria nova versão em rascunho", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      expect((await move(v.id, t.rh, "IN_REVIEW")).status).toBe(200);
      const original = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(r.status).toBe(200);
      expect(r.body.data.schedules[0]).toMatchObject({
        outcome: "NEEDS_CONFIRMATION",
        status: "IN_REVIEW",
        changedCells: 5
      });
      expect(r.body.data.schedules[0].message).toContain("nova versão em rascunho");
      const untouched = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(untouched.contentHash).toBe(original.contentHash);
      expect(untouched.status).toBe("IN_REVIEW");
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([]);

      const id = r.body.data.substitution.id as string;
      const confirmed = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {
        applyToLockedSchedules: true
      });
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      const outcome = confirmed.body.data.schedules[0];
      expect(outcome).toMatchObject({ outcome: "NEW_VERSION", status: "DRAFT", changedCells: 5 });
      expect(withCode(await days(outcome.versionId, u.bia), "C")).toEqual([11, 13, 15, 17, 19]);

      // a análise anterior deixou de valer (substituída), sem apagar nada
      const old = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(old.supersededAt).not.toBeNull();
      expect(old.status).toBe("IN_REVIEW");
      const fresh = await prisma.scheduleVersion.findUniqueOrThrow({
        where: { id: outcome.versionId }
      });
      expect(fresh).toMatchObject({ status: "DRAFT", basedOnVersionId: v.id });
    });

    it("escala publicada continua no ar até a nova versão ser publicada", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      expect((await move(v.id, t.rh, "IN_REVIEW")).status).toBe(200);
      expect((await move(v.id, t.approver, "APPROVED")).status).toBe(200);
      expect((await move(v.id, t.rh, "PUBLISHED")).status).toBe(200);

      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL",
        applyToLockedSchedules: true
      });
      expect(r.body.data.schedules[0]).toMatchObject({ outcome: "NEW_VERSION", status: "DRAFT" });
      const published = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(published.status).toBe("PUBLISHED");
      expect(published.supersededAt).toBeNull();
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([]);
    });

    it("férias que atravessam dois meses atualizam as duas escalas (a classificação Par/Ímpar inverte em novembro)", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(28), D(5, 11));
      const oct = await generate(u, "2026-10");
      const nov = await generate(u, "2026-11");
      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(
        r.body.data.schedules.map((s: { month: string; outcome: string }) => [s.month, s.outcome])
      ).toEqual([
        ["2026-10", "UPDATED"],
        ["2026-11", "UPDATED"]
      ]);
      expect(withCode(await days(oct.id, u.bia), "C")).toEqual([29, 31]);
      expect(withCode(await days(nov.id, u.bia), "C")).toEqual([2, 4]);
    });

    it("rodízio específico divide os plantões; distribuição parcial cobre só o que foi escolhido", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const partial = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "SPECIFIC",
        specificParity: "ODD",
        coveredDates: [D(13), D(15), D(18)] // 18 é dia par: não é plantão da Ana
      });
      expect(partial.status, JSON.stringify(partial.body)).toBe(200);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([13, 15]);
      expect(partial.body.data.substitution).toMatchObject({
        rotation: "SPECIFIC",
        specificParity: "ODD"
      });
    });

    it("conflito em parte do período: cobre o que pode, informa o resto e não gera escala inconsistente", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      await leave(u.bia, D(14), D(16), atTypeId); // Bia atestada nos dias 14-16
      const v = await generate(u);
      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.plan).toMatchObject({
        demandCount: 5,
        coveredCount: 4,
        uncoveredCount: 1
      });
      expect(r.body.data.plan.issues[0]).toMatchObject({
        code: "SUBSTITUTION_SUBSTITUTE_ON_LEAVE",
        dates: [D(15)]
      });
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 17, 19]);
    });
  });

  describe("encerramento, alteração e cancelamento", () => {
    it("cancelar a substituição desfaz as coberturas, preserva o registro e exige o motivo", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;
      expect(withCode(await days(v.id, u.bia), "C")).toHaveLength(5);

      const noReason = await api.call("POST", `/substitutions/${id}/cancel`, t.rh, { reason: "a" });
      expect(noReason.status).toBe(400);

      const r = await api.call("POST", `/substitutions/${id}/cancel`, t.rh, {
        reason: "Bia assumiu outro projeto"
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.substitution).toMatchObject({
        status: "CANCELLED",
        effectiveStatus: "CANCELLED"
      });
      expect(r.body.data.schedules[0]).toMatchObject({ outcome: "UPDATED", changedCells: 5 });

      const bia = await days(v.id, u.bia);
      expect(withCode(bia, "C")).toEqual([]);
      // voltou ao que o rodízio prevê (folga nos dias ímpares), e o afastamento da Ana segue
      expect([11, 13, 15, 17, 19].map((d) => bia[d - 1])).toEqual(["F", "F", "F", "F", "F"]);
      expect(withCode(await days(v.id, u.ana), "FR")).toHaveLength(11);

      const row = await prisma.leaveSubstitution.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        status: "CANCELLED",
        cancelReason: "Bia assumiu outro projeto",
        cancelledBy: rh.id
      });
      expect(row.cancelledAt).not.toBeNull();
      const trail = await prisma.auditLog.findMany({
        where: { entity: "LeaveSubstitution", entityId: id },
        orderBy: { createdAt: "asc" }
      });
      expect(trail.map((a) => a.action)).toEqual(["CREATE", "UPDATE"]);

      // cancelada não pode mais ser alterada
      const again = await api.call("PATCH", `/substitutions/${id}`, t.rh, { notes: "x" });
      expect(again.status).toBe(409);
      expect(again.body.error?.code ?? again.body.code).toBe("SUBSTITUTION_ALREADY_CANCELLED");
    });

    it("alterar a configuração recalcula: trocar de substituto devolve a Bia à folga e põe a outra em C", async () => {
      const u = await unit();
      const dani = await prisma.employee.create({
        data: {
          operationId: u.operationId,
          name: "Dani Reis",
          identifier: "D1",
          initials: "DAN",
          status: "ACTIVE",
          admissionDate: new Date("2020-01-01T00:00:00Z"),
          shift: "DIURNO",
          parity: "EVEN"
        }
      });
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;

      const r = await api.call("PATCH", `/substitutions/${id}`, t.rh, { substituteId: dani.id });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([]);
      expect(withCode(await days(v.id, dani.id), "C")).toEqual([11, 13, 15, 17, 19]);
    });

    it("mudar as datas das férias recalcula as coberturas e as linhas do titular", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(created.status).toBe(200);

      // encurta para 10–14: sobram só os plantões 11 e 13
      const r = await api.call("PATCH", `/calendar/events/${leaveId}`, t.rh, {
        endsAt: at(D(14))
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.substitutionSync.schedules[0]).toMatchObject({
        month: "2026-10",
        outcome: "UPDATED"
      });
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13]);
      const ana = await days(v.id, u.ana);
      expect(withCode(ana, "FR")).toEqual([10, 11, 12, 13, 14]);
      expect([15, 17, 19].map((d) => ana[d - 1])).toEqual(["D", "D", "D"]); // Ana volta ao rodízio

      // estende para 10–24: entram os plantões 15…23
      const longer = await api.call("PATCH", `/calendar/events/${leaveId}`, t.rh, {
        endsAt: at(D(24))
      });
      expect(longer.status).toBe(200);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 15, 17, 19, 21, 23]);
      expect(withCode(await days(v.id, u.ana), "FR")).toHaveLength(15);

      // datas inválidas são recusadas
      const bad = await api.call("PATCH", `/calendar/events/${leaveId}`, t.rh, {
        endsAt: at(D(5))
      });
      expect(bad.status).toBe(400);
    });

    it("cancelar as férias encerra a substituição, desfaz as coberturas e devolve o titular ao rodízio", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;

      const r = await api.call("DELETE", `/calendar/events/${leaveId}`, t.rh);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.substitutionSync.substitutions[0]).toMatchObject({ status: "CANCELLED" });
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([]);
      const ana = await days(v.id, u.ana);
      expect(withCode(ana, "FR")).toEqual([]);
      expect(ana[10]).toBe("D"); // dia 11: de volta ao rodízio

      const row = await prisma.leaveSubstitution.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: "CANCELLED", cancelReason: "Afastamento cancelado." });
    });

    it("cancelar as férias com a escala em análise: não altera em silêncio; confirmado, a nova versão sai sem Férias nem Cobertura", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;
      expect((await move(v.id, t.rh, "IN_REVIEW")).status).toBe(200);

      const removed = await api.call("DELETE", `/calendar/events/${leaveId}`, t.rh);
      expect(removed.status, JSON.stringify(removed.body)).toBe(200);
      expect(removed.body.data.substitutionSync.schedules[0]).toMatchObject({
        outcome: "NEEDS_CONFIRMATION",
        status: "IN_REVIEW"
      });
      // a escala em análise continua exatamente como estava
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 15, 17, 19]);
      expect(withCode(await days(v.id, u.ana), "FR")).toHaveLength(11);

      const confirmed = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {
        applyToLockedSchedules: true,
        refreshFrom: D(10),
        refreshTo: D(20)
      });
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      const outcome = confirmed.body.data.schedules[0];
      expect(outcome).toMatchObject({ outcome: "NEW_VERSION", status: "DRAFT" });
      expect(withCode(await days(outcome.versionId, u.bia), "C")).toEqual([]);
      const ana = await days(outcome.versionId, u.ana);
      expect(withCode(ana, "FR")).toEqual([]);
      expect(ana[10]).toBe("D");
    });

    it("mudar as datas das férias com a escala em análise: pede confirmação com o período certo", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;
      expect((await move(v.id, t.rh, "IN_REVIEW")).status).toBe(200);

      const moved = await api.call("PATCH", `/calendar/events/${leaveId}`, t.rh, {
        endsAt: at(D(14))
      });
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
      expect(moved.body.data.substitutionSync.schedules[0].outcome).toBe("NEEDS_CONFIRMATION");
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 13, 15, 17, 19]);

      const confirmed = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {
        applyToLockedSchedules: true,
        refreshFrom: D(10),
        refreshTo: D(20) // período antigo e novo: o titular volta ao rodízio depois do dia 14
      });
      expect(confirmed.status).toBe(200);
      const outcome = confirmed.body.data.schedules[0];
      expect(outcome.outcome).toBe("NEW_VERSION");
      expect(withCode(await days(outcome.versionId, u.bia), "C")).toEqual([11, 13]);
      const ana = await days(outcome.versionId, u.ana);
      expect(withCode(ana, "FR")).toEqual([10, 11, 12, 13, 14]);
      expect([15, 17, 19].map((d) => ana[d - 1])).toEqual(["D", "D", "D"]);

      // período de conferência inválido é recusado
      const bad = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {
        refreshFrom: D(20)
      });
      expect(bad.status).toBe(400);
    });

    it("depois do fim das férias a substituição deixa de produzir efeitos sozinha (outro mês fica intacto)", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      expect(created.status).toBe(200);
      const november = await generate(u, "2026-11");
      expect(withCode(await days(november.id, u.bia), "C")).toEqual([]);
      expect(created.body.data.substitution.effectiveStatus).toBe("ENDED");
    });
  });

  describe("isolamento entre unidades", () => {
    /** Um RH que só enxerga OUTRA unidade. */
    async function outsider() {
      const f = await createFixture();
      const user = await createUser({
        role: "RH",
        suffix: `${f.suffix}x`,
        scope: f.scope,
        createdBy: f.seededAdminId
      });
      return api.token(user.email);
    }

    it("quem é de outra unidade não lê, cria, altera, cancela nem aplica substituições alheias", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;
      const other = await outsider();

      const list = await api.call("GET", `/substitutions?leaveEventId=${leaveId}`, other);
      expect(list.status).toBe(200);
      expect(list.body.data).toEqual([]); // não enxerga
      const all = await api.call("GET", "/substitutions", other);
      expect(all.body.data.some((s: { id: string }) => s.id === id)).toBe(false);

      const body = { leaveEventId: leaveId, substituteId: u.carlos, rotation: "HABITUAL" };
      expect((await substitute(body, other)).status).toBe(403);
      expect((await api.call("PATCH", `/substitutions/${id}`, other, { notes: "x" })).status).toBe(
        403
      );
      expect(
        (
          await api.call("POST", `/substitutions/${id}/cancel`, other, {
            reason: "motivo qualquer"
          })
        ).status
      ).toBe(403);
      expect((await api.call("POST", `/substitutions/${id}/apply`, other, {})).status).toBe(403);

      // o afastamento também é protegido
      expect(
        (await api.call("PATCH", `/calendar/events/${leaveId}`, other, { endsAt: at(D(12)) }))
          .status
      ).toBe(403);
      expect((await api.call("DELETE", `/calendar/events/${leaveId}`, other)).status).toBe(403);

      // nada mudou
      const row = await prisma.leaveSubstitution.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: "ACTIVE", substituteId: u.bia, notes: null });
      const event = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: leaveId } });
      expect(event.status).toBe("ACTIVE");
      expect(event.endsAt.toISOString()).toBe(at(D(20)));
    });
  });

  describe("afastamento sem substituição e rotas de referência", () => {
    it("alterar datas ou título de um afastamento sem substituição funciona e não mexe nas escalas", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const before = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const r = await api.call("PATCH", `/calendar/events/${leaveId}`, t.rh, {
        title: "Férias de outubro",
        endsAt: at(D(22))
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.title).toBe("Férias de outubro");
      expect(r.body.data.substitutionSync).toBeUndefined(); // sem substituição, nada a reconciliar
      const after = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      expect(after.contentHash).toBe(before.contentHash);
      expect(after.revision).toBe(before.revision);

      const audit = await prisma.auditLog.findFirst({
        where: { entity: "CalendarEvent", entityId: leaveId, action: "UPDATE" }
      });
      expect(audit?.userId).toBe(rh.id);
      // sem informar nada para alterar, é recusado
      expect((await api.call("PATCH", `/calendar/events/${leaveId}`, t.rh, {})).status).toBe(400);
      // o Aprovador não altera afastamentos
      expect(
        (await api.call("PATCH", `/calendar/events/${leaveId}`, t.approver, { title: "Outro" }))
          .status
      ).toBe(403);
    });

    it("tipos de afastamento e critérios de avaliação exigem login", async () => {
      expect((await api.call("GET", "/event-types")).status).toBe(401);
      expect((await api.call("GET", "/evaluation-criteria")).status).toBe(401);
      expect((await api.call("GET", "/event-types", t.approver)).status).toBe(200);
      expect((await api.call("GET", "/evaluation-criteria", t.approver)).status).toBe(200);
    });
  });

  describe("plano e simultaneidade", () => {
    it("o plano (dryRun) já mostra o aviso de descanso dos dias que cobrem ao lado do plantão", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const r = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL",
        dryRun: true
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const rest = (
        r.body.data.plan.issues as Array<{ code: string; severity: string; employeeName: string }>
      ).find((i) => i.code === "EDIT_REST_TIME_SHORT");
      expect(rest).toMatchObject({ severity: "warning", employeeName: "Bia Lima" });
    });

    it("dois substitutos configurados ao mesmo tempo: no fim, cada plantão tem uma única cobertura e reaplicar não muda nada", async () => {
      const u = await unit();
      const dani = await prisma.employee.create({
        data: {
          operationId: u.operationId,
          name: "Dani Reis",
          identifier: "D1",
          initials: "DAN",
          status: "ACTIVE",
          admissionDate: new Date("2020-01-01T00:00:00Z"),
          shift: "DIURNO",
          parity: "EVEN"
        }
      });
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const [a, b] = await Promise.all([
        substitute({ leaveEventId: leaveId, substituteId: u.bia, rotation: "HABITUAL" }),
        substitute({ leaveEventId: leaveId, substituteId: dani.id, rotation: "HABITUAL" })
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);

      // reaplica cada uma (a simultaneidade pode ter deixado um mês para conferir) e confere o estado final
      for (const r of [a, b]) {
        const id = r.body.data.substitution.id as string;
        expect((await api.call("POST", `/substitutions/${id}/apply`, t.rh, {})).status).toBe(200);
      }
      const bia = withCode(await days(v.id, u.bia), "C");
      const danis = withCode(await days(v.id, dani.id), "C");
      expect([...bia, ...danis].sort((x, y) => x - y)).toEqual([11, 13, 15, 17, 19]); // cada dia, uma só pessoa
      expect(bia.filter((d) => danis.includes(d))).toEqual([]);

      for (const r of [a, b]) {
        const id = r.body.data.substitution.id as string;
        const again = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {});
        expect(again.body.data.schedules[0].outcome).toBe("UNCHANGED");
      }
    });
  });

  describe("convivência com a edição manual", () => {
    it("o ajuste manual de um dia coberto vale sobre a substituição e não é desfeito ao reaplicar", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      const created = await substitute({
        leaveEventId: leaveId,
        substituteId: u.bia,
        rotation: "HABITUAL"
      });
      const id = created.body.data.substitution.id as string;
      const current = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });

      const edit = await api.call("PATCH", `/employee-schedules/${v.id}/cells`, t.rh, {
        expectedRevision: current.revision,
        changes: [{ employeeId: u.bia, date: D(13), code: "F", reason: "Folga combinada" }]
      });
      expect(edit.status, JSON.stringify(edit.body)).toBe(200);
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 15, 17, 19]);

      const again = await api.call("POST", `/substitutions/${id}/apply`, t.rh, {});
      expect(again.status).toBe(200);
      expect(again.body.data.schedules[0]).toMatchObject({ outcome: "UNCHANGED" });
      expect(withCode(await days(v.id, u.bia), "C")).toEqual([11, 15, 17, 19]);
      // a escala mostra o porquê: um dia do plantão da Ana ficou sem cobertura pelo ajuste manual
      const stored = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      const pend = (
        stored.generatedResult as { pendencies: Array<{ reasonCodes: string[]; date: string }> }
      ).pendencies;
      expect(
        pend.find((p) => p.reasonCodes.includes("SUBSTITUTION_MANUAL_ADJUSTMENT"))
      ).toMatchObject({ date: D(13) });
    });

    it("editar um dia coberto para o mesmo C não gera ajuste manual (continua seguindo a substituição)", async () => {
      const u = await unit();
      const leaveId = await leave(u.ana, D(10), D(20));
      const v = await generate(u);
      await substitute({ leaveEventId: leaveId, substituteId: u.bia, rotation: "HABITUAL" });
      const current = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: v.id } });
      const r = await api.call("PATCH", `/employee-schedules/${v.id}/cells`, t.rh, {
        expectedRevision: current.revision,
        changes: [{ employeeId: u.bia, date: D(13), code: "C" }]
      });
      expect(r.status).toBe(200);
      expect(r.body.data.changed).toBe(false); // já estava em C
      expect(
        await prisma.scheduleDayOverride.count({ where: { operationId: u.operationId } })
      ).toBe(0);
    });
  });
});
