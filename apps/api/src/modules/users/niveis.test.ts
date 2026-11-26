// A lista de níveis de governança existe em dois lugares (packages/shared, para a regra pura, e
// packages/validation, para o zod, que não depende de shared). Este teste garante que são iguais e
// que o schema do banco (Prisma) usa os mesmos valores.
import { readFileSync } from "node:fs";
import { niveisDeGovernanca, rotuloDoNivel } from "@my-flux/shared";
import { cadastroDaContaSchema, nivelGovernancaSchema } from "@my-flux/validation";
import { describe, expect, it } from "vitest";

describe("níveis de governança", () => {
  it("shared e validation têm exatamente os mesmos valores", () => {
    expect([...nivelGovernancaSchema.options]).toEqual([...niveisDeGovernanca]);
  });

  it("o enum do Prisma tem os mesmos valores", () => {
    const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
    const bloco = schema.match(/enum NivelGovernanca \{([^}]*)\}/)?.[1] ?? "";
    const valores = bloco
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("@@") && !l.startsWith("//"));
    expect(valores).toEqual([...niveisDeGovernanca]);
  });

  it("o schema do cadastro dá uma mensagem em português para cada campo", () => {
    const r = cadastroDaContaSchema.safeParse({});
    expect(r.success).toBe(false);
    const mensagens = Object.fromEntries(
      (r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message])
    );
    expect(mensagens).toEqual({
      cargo: "Informe o cargo.",
      nivelGovernanca: "Escolha o nível de governança.",
      areaId: "Escolha a área."
    });
    for (const nivel of niveisDeGovernanca) expect(rotuloDoNivel[nivel]).toBeTruthy();
  });
});
