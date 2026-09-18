import { describe, expect, it } from "vitest";
import { buildXlsxBase64 } from "./report-service.js";

describe("buildXlsxBase64", () => {
  it("creates a non-empty XLSX payload", () => {
    const payload = buildXlsxBase64([{ name: "Lacunas", rows: [{ item: "Vaga", total: 1 }] }]);

    expect(payload.length).toBeGreaterThan(100);
  });
});
