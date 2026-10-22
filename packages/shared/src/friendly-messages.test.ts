import { describe, expect, it } from "vitest";
import {
  describeApiError,
  describeIssue,
  describeWhen,
  friendlyFieldIssue,
  groupPendencies,
  hasBlockingIssues,
  isKnownIssueCode,
  summarizeFieldIssues
} from "./friendly-messages.js";

describe("describeIssue — pendências da escala", () => {
  it("traduz SHIFT_NOT_CONFIGURED exatamente como pedido pelo RH", () => {
    const issue = describeIssue("SHIFT_NOT_CONFIGURED", {
      employeeName: "Felipe",
      date: "2026-10-01"
    });
    expect(issue.title).toBe("Não foi possível definir o turno de Felipe");
    expect(issue.detail).toBe(
      "Não existe um turno configurado para esse colaborador na data de 01/10/2026."
    );
    expect(issue.action).toBe(
      "Verifique o cadastro e a configuração da escala antes de gerar novamente."
    );
    expect(issue.severity).toBe("blocking");
    expect(issue.known).toBe(true);
  });

  it("preserva o código técnico e a linha técnica original para suporte", () => {
    const issue = describeIssue("SHIFT_NOT_CONFIGURED", {
      employeeName: "Felipe",
      date: "2026-10-01"
    });
    expect(issue.code).toBe("SHIFT_NOT_CONFIGURED");
    expect(issue.technical).toBe("Felipe · 2026-10-01 · SHIFT_NOT_CONFIGURED");
  });

  it("diferencia o que impede o envio de alertas e informativos", () => {
    expect(describeIssue("SHIFT_NOT_CONFIGURED").severity).toBe("blocking");
    expect(describeIssue("FUTURE_ADMISSION").severity).toBe("warning");
    expect(describeIssue("DOCUMENT_MISSING").severity).toBe("warning");
    expect(describeIssue("DOCUMENT_EXPIRING").severity).toBe("info");
    expect(describeIssue("AFTER_TERMINATION").severity).toBe("info");
  });

  it("usa os textos das regras de origem (documento/competência) quando existem", () => {
    const issue = describeIssue("DOCUMENT_EXPIRED", {
      employeeName: "Ana",
      date: "2026-10-05",
      details: ["NR-10 ausente ou vencido."]
    });
    expect(issue.detail).toContain("NR-10 ausente ou vencido.");
    expect(issue.detail).toContain("05/10/2026");
  });

  it("código sem tradução cai em mensagem genérica segura, sem esconder o código", () => {
    const issue = describeIssue("ALGO_NOVO_QUE_NINGUEM_TRADUZIU", {
      employeeName: "Ana",
      date: "2026-10-05"
    });
    expect(issue.known).toBe(false);
    expect(issue.severity).toBe("warning");
    expect(issue.title).toBe("Pendência na escala de Ana");
    expect(issue.code).toBe("ALGO_NOVO_QUE_NINGUEM_TRADUZIU");
    expect(issue.technical).toContain("ALGO_NOVO_QUE_NINGUEM_TRADUZIU");
    expect(issue.detail).not.toMatch(/undefined|null/);
  });

  it("funciona sem nome e sem data, sem escrever 'undefined'", () => {
    const issue = describeIssue("SHIFT_NOT_CONFIGURED");
    expect(`${issue.title} ${issue.detail}`).not.toMatch(/undefined|null/);
    expect(issue.title).toBe("Não foi possível definir o turno de um colaborador");
  });

  it("todo código de pendência gerado pelo motor de disponibilidade tem tradução", () => {
    // Códigos produzidos por employee-availability / aptitude-service / employee-schedule-service.
    for (const code of [
      "SHIFT_NOT_CONFIGURED",
      "FUTURE_ADMISSION",
      "EMPLOYEE_INACTIVE",
      "AFTER_TERMINATION",
      "OFF_ROTATION_DAY",
      "BLOCKED_BY_EVENT",
      "DOCUMENT_MISSING",
      "DOCUMENT_EXPIRED",
      "DOCUMENT_EXPIRING",
      "COMPETENCY_MISSING",
      "COMPETENCY_LEVEL_LOW",
      "COMPETENCY_EXPIRING"
    ]) {
      expect(isKnownIssueCode(code), code).toBe(true);
    }
  });
});

describe("describeWhen", () => {
  it("descreve um dia, poucos dias, muitos dias e um período", () => {
    expect(describeWhen({ date: "2026-10-01" })).toBe("na data de 01/10/2026");
    expect(describeWhen({ dates: ["2026-10-06", "2026-10-02", "2026-10-04"] })).toBe(
      "nas datas de 02/10, 04/10 e 06/10/2026"
    );
    expect(
      describeWhen({
        dates: Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`)
      })
    ).toBe("em 12 dias, entre 01/10/2026 e 12/10/2026");
    expect(describeWhen({ date: "2026-10-01", endDate: "2026-10-15" })).toBe(
      "no período de 01/10/2026 a 15/10/2026"
    );
    expect(describeWhen({})).toBe("no período da escala");
  });
});

describe("groupPendencies", () => {
  const pendencies = [
    {
      employeeId: "a",
      employeeName: "Ana",
      date: "2026-10-03",
      reasonCodes: ["DOCUMENT_EXPIRED"],
      details: [{ code: "DOCUMENT_EXPIRED", message: "ASO ausente ou vencido." }]
    },
    {
      employeeId: "a",
      employeeName: "Ana",
      date: "2026-10-01",
      reasonCodes: ["DOCUMENT_EXPIRED"],
      details: [{ code: "DOCUMENT_EXPIRED", message: "ASO ausente ou vencido." }]
    },
    {
      employeeId: "b",
      employeeName: "Bruno",
      date: "2026-10-01",
      reasonCodes: ["SHIFT_NOT_CONFIGURED"]
    },
    {
      employeeId: "c",
      employeeName: "Carla",
      date: "2026-10-09",
      reasonCodes: ["AFTER_TERMINATION", "FUTURE_ADMISSION"]
    }
  ];

  it("agrupa por colaborador e código, e ordena impeditivas antes de alertas e informativas", () => {
    const groups = groupPendencies(pendencies);
    expect(groups.map((g) => g.code)).toEqual([
      "SHIFT_NOT_CONFIGURED",
      "DOCUMENT_EXPIRED",
      "FUTURE_ADMISSION",
      "AFTER_TERMINATION"
    ]);
    const ana = groups.find((g) => g.employeeName === "Ana")!;
    expect(ana.count).toBe(2);
    expect(ana.dates).toEqual(["2026-10-01", "2026-10-03"]);
    expect(ana.detail).toContain("nas datas de 01/10 e 03/10/2026");
  });

  it("cada mensagem usa só o texto do seu próprio código (documento e competência no mesmo dia)", () => {
    const groups = groupPendencies([
      {
        employeeId: "d",
        employeeName: "Davi",
        date: "2026-10-02",
        reasonCodes: ["DOCUMENT_EXPIRED", "COMPETENCY_MISSING"],
        details: [
          { code: "DOCUMENT_EXPIRED", message: "NR-10 ausente ou vencido." },
          {
            code: "COMPETENCY_MISSING",
            message: "Operação de empilhadeira ausente, insuficiente ou vencida."
          }
        ]
      }
    ]);
    const doc = groups.find((g) => g.code === "DOCUMENT_EXPIRED")!;
    const comp = groups.find((g) => g.code === "COMPETENCY_MISSING")!;
    expect(doc.detail).toContain("NR-10");
    expect(doc.detail).not.toContain("empilhadeira");
    expect(comp.detail).toContain("empilhadeira");
    expect(comp.detail).not.toContain("NR-10");
  });

  it("hasBlockingIssues detecta apenas impeditivas", () => {
    expect(hasBlockingIssues(groupPendencies(pendencies))).toBe(true);
    expect(hasBlockingIssues(groupPendencies(pendencies.filter((p) => p.employeeId !== "b")))).toBe(
      false
    );
  });
});

describe("describeApiError", () => {
  it("traduz códigos conhecidos e preserva o código", () => {
    const e = describeApiError({
      code: "NO_EMPLOYEES",
      message: "Nenhum colaborador ativo nesta unidade.",
      status: 409
    });
    expect(e.code).toBe("NO_EMPLOYEES");
    expect(e.message).toBe("Não há colaboradores ativos nesta unidade para montar a escala.");
    expect(e.action).toContain("Cadastre ou reative");
    expect(e.known).toBe(true);
  });

  it("mantém a mensagem original em códigos que carregam dado dinâmico", () => {
    const e = describeApiError({
      code: "SHIFT_NOT_CONFIGURED",
      message: "Turno NOITE não configurado.",
      status: 409
    });
    expect(e.message).toBe("Turno NOITE não configurado.");
    expect(e.action).not.toBeNull();
  });

  it("erro 4xx sem tradução mostra a frase da aplicação", () => {
    expect(
      describeApiError({ code: "QUALQUER", message: "Candidato já foi admitido.", status: 409 })
        .message
    ).toBe("Candidato já foi admitido.");
  });

  it("erro 5xx sem tradução NUNCA vaza a mensagem original", () => {
    const e = describeApiError({
      code: "XYZ",
      message: "connect ECONNREFUSED 10.0.0.5:5432 at Pool.query (/app/node_modules/pg)",
      status: 500
    });
    expect(e.message).toBe("Não foi possível concluir a operação.");
    expect(e.message).not.toMatch(/ECONNREFUSED|node_modules|10\.0\.0/);
  });

  it("INTERNAL_SERVER_ERROR conhecido usa texto padrão, ignorando o original", () => {
    const e = describeApiError({ code: "INTERNAL_SERVER_ERROR", message: "stack...", status: 500 });
    expect(e.message).toBe("Ocorreu um erro inesperado.");
  });
});

describe("friendlyFieldIssue", () => {
  it("traduz problemas comuns de campo para português, com o nome do campo", () => {
    expect(
      friendlyFieldIssue({ code: "too_small", path: ["password"], origin: "string", minimum: 12 })
    ).toEqual({
      path: "password",
      label: "Senha",
      message: "precisa ter pelo menos 12 caracteres"
    });
    expect(
      friendlyFieldIssue({ code: "invalid_type", path: ["month"], input: undefined }).message
    ).toBe("campo obrigatório");
    expect(
      friendlyFieldIssue({ code: "invalid_format", path: ["employeeId"], format: "uuid" }).message
    ).toBe("identificador inválido");
    expect(
      friendlyFieldIssue({ code: "invalid_format", path: ["email"], format: "email" }).message
    ).toBe("e-mail inválido");
  });

  it("não repassa mensagem técnica em inglês", () => {
    const f = friendlyFieldIssue({
      code: "custom",
      path: ["x"],
      message: "Expected something weird"
    });
    expect(f.message).toBe("valor inválido");
  });

  it("resume vários campos em uma frase", () => {
    expect(
      summarizeFieldIssues([
        { path: "email", label: "E-mail", message: "e-mail inválido" },
        { path: "password", label: "Senha", message: "campo obrigatório" }
      ])
    ).toBe("E-mail: e-mail inválido; Senha: campo obrigatório");
  });
});
