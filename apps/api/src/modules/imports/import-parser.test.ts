import { describe, expect, it } from "vitest";
import { parseImportFile } from "./import-parser.js";

describe("import parser", () => {
  it("maps and validates employee CSV rows", () => {
    const content = Buffer.from("Nome,Matricula\nAna,001\n,002", "utf8").toString("base64");
    const result = parseImportFile("EMPLOYEES", "employees.csv", content, {
      Nome: "name",
      Matricula: "identifier"
    });

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toEqual([
      {
        rowNumber: 3,
        field: "name",
        value: "",
        code: "MISSING_REQUIRED_FIELD",
        severity: "ERROR",
        message: "Campo obrigatorio ausente: name."
      }
    ]);
  });

  it("validates QLP quantities", () => {
    const content = Buffer.from("Operacao,Funcao,Quantidade\nOP,FN,abc", "utf8").toString("base64");
    const result = parseImportFile("QLP", "qlp.csv", content, {
      Operacao: "operation",
      Funcao: "function",
      Quantidade: "requiredQuantity"
    });

    expect(result.issues[0]?.code).toBe("INVALID_QUANTITY");
  });
});
