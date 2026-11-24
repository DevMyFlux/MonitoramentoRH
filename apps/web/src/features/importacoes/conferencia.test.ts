import { describe, expect, it } from "vitest";
import { conferir, type ProblemaDaImportacao } from "./conferencia";

const p = (
  rowNumber: number | null,
  severity: "ERROR" | "WARNING",
  message = "x"
): ProblemaDaImportacao => ({
  rowNumber,
  field: null,
  value: null,
  code: "C",
  severity,
  message
});

describe("conferência da importação", () => {
  it("conta erros e avisos e agrupa por linha, com os erros primeiro", () => {
    const c = conferir("EMPLOYEES", "VALIDATED", [
      p(5, "WARNING", "aviso 5"),
      p(3, "ERROR", "erro 3"),
      p(5, "ERROR", "erro 5"),
      p(null, "WARNING", "arquivo")
    ]);
    expect([c.erros, c.avisos]).toEqual([2, 2]);
    expect(c.porLinha.map((g) => [g.linha, g.problemas.map((x) => x.message)])).toEqual([
      [null, ["arquivo"]],
      [3, ["erro 3"]],
      [5, ["erro 5", "aviso 5"]]
    ]);
  });

  it("bloqueia confirmar com erro, com outro tipo ou com lote já importado", () => {
    expect(conferir("EMPLOYEES", "VALIDATED", [p(2, "ERROR")]).bloqueio).toMatch(/Corrija o erro/);
    expect(conferir("EMPLOYEES", "VALIDATED", [p(2, "ERROR"), p(3, "ERROR")]).bloqueio).toMatch(
      /os 2 erros/
    );
    expect(conferir("QLP", "VALIDATED", []).bloqueio).toMatch(/só a importação de colaboradores/);
    expect(conferir("EMPLOYEES", "COMMITTED", []).bloqueio).toMatch(/já foi importado/);
  });

  it("com só avisos, colaboradores podem ser confirmados", () => {
    expect(conferir("EMPLOYEES", "VALIDATED", [p(4, "WARNING")]).bloqueio).toBeNull();
  });
});
