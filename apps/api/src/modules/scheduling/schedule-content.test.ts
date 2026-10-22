import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import {
  assertSubmittable,
  blockingIssuesOf,
  canonicalJson,
  contentHashOf
} from "./schedule-content.js";

const grid = {
  year: 2026,
  month: 10,
  sections: [{ label: "DIURNO", rows: [{ employeeId: "a", days: ["D", "F"] }] }]
};

describe("hash do conteúdo da escala", () => {
  it("é o mesmo para o mesmo conteúdo, independente da ordem das chaves", () => {
    const a = { grid, pendencies: [], metrics: { required: 1, covered: 1, coverage: 100 } };
    const b = {
      metrics: { coverage: 100, covered: 1, required: 1 },
      pendencies: [],
      grid: { sections: grid.sections, month: 10, year: 2026 }
    };
    expect(contentHashOf(a)).toBe(contentHashOf(b));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("muda quando QUALQUER célula muda (uma aprovação antiga não vale para conteúdo diferente)", () => {
    const base = { grid, pendencies: [], metrics: {} };
    const edited = {
      grid: {
        ...grid,
        sections: [{ label: "DIURNO", rows: [{ employeeId: "a", days: ["D", "C"] }] }]
      },
      pendencies: [],
      metrics: {}
    };
    expect(contentHashOf(edited)).not.toBe(contentHashOf(base));
  });

  it("é um sha256 hexadecimal estável", () => {
    expect(contentHashOf({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHashOf({ a: 1 })).toBe(contentHashOf({ a: 1 }));
    expect(contentHashOf(null)).toBe(contentHashOf(undefined));
  });
});

describe("envio para aprovação: só problemas impeditivos barram", () => {
  const withIssues = (...pendencies: Array<{ code: string; name?: string; date?: string }>) => ({
    grid,
    metrics: {},
    pendencies: pendencies.map((p, i) => ({
      employeeId: `e${i}`,
      employeeName: p.name ?? `Pessoa ${i}`,
      date: p.date ?? "2026-10-01",
      reasonCodes: [p.code]
    }))
  });

  it("escala sem pendências ou só com alertas/informações pode ser enviada", () => {
    expect(() => assertSubmittable({ grid, pendencies: [], metrics: {} })).not.toThrow();
    expect(() =>
      assertSubmittable(
        withIssues(
          { code: "FUTURE_ADMISSION" },
          { code: "DOCUMENT_EXPIRED" },
          { code: "AFTER_TERMINATION" }
        )
      )
    ).not.toThrow();
  });

  it("versões antigas sem a lista de pendências continuam podendo ser enviadas", () => {
    expect(() => assertSubmittable({ some: "legacy engine output" })).not.toThrow();
    expect(() => assertSubmittable(null)).not.toThrow();
  });

  it("SHIFT_NOT_CONFIGURED impede o envio, com mensagem clara e o que corrigir", () => {
    let error: unknown;
    try {
      assertSubmittable(withIssues({ code: "SHIFT_NOT_CONFIGURED", name: "Felipe" }));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpError);
    const http = error as HttpError;
    expect(http.statusCode).toBe(409);
    expect(http.code).toBe("SCHEDULE_HAS_BLOCKING_ISSUES");
    expect(http.message).toBe(
      "A escala tem 1 problema que impede o envio: Não foi possível definir o turno de Felipe."
    );
    const issues = http.details.issues as Array<{
      title: string;
      action: string;
      employeeName: string;
    }>;
    expect(issues[0]).toMatchObject({ employeeName: "Felipe" });
    expect(issues[0]!.action).toContain("Verifique o cadastro");
  });

  it("resume vários impeditivos sem despejar a lista na frase", () => {
    const pend = ["Ana", "Bia", "Caio", "Dani"].map((name) => ({
      code: "SHIFT_NOT_CONFIGURED",
      name
    }));
    try {
      assertSubmittable(withIssues(...pend));
      expect.unreachable();
    } catch (e) {
      expect((e as HttpError).message).toBe(
        "A escala tem 4 problemas que impedem o envio (Ana, Bia, Caio e outros)."
      );
    }
  });

  it("blockingIssuesOf separa só os impeditivos", () => {
    const blocking = blockingIssuesOf(
      withIssues({ code: "SHIFT_NOT_CONFIGURED" }, { code: "FUTURE_ADMISSION" })
    );
    expect(blocking.map((b) => b.code)).toEqual(["SHIFT_NOT_CONFIGURED"]);
  });
});
