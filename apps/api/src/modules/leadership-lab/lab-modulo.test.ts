import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { criarMotorDoLab, lerConfigDaIa } from "./lab-modulo.js";
import { ConfigDoLabInvalida } from "./motor/config.js";
import { configDeTeste } from "./motor/cenario-de-teste.js";
import { IaFalsa } from "./motor/ia-falsa.js";
import { MotorDoTeste } from "./motor/motor.js";

const db = {} as PrismaClient; // nenhuma consulta é feita ao montar o motor
const logger = { warn: () => undefined };
const ligado = {
  LAB_IA_URL: "https://ia.exemplo.test",
  LAB_IA_TOKEN: "segredo",
  LAB_TOLERANCIA_TEMPO_S: "3"
};

describe("lerConfigDaIa", () => {
  it("sem LAB_IA_URL o módulo está desligado", () => {
    expect(lerConfigDaIa({})).toBeNull();
    expect(lerConfigDaIa({ LAB_IA_URL: "   ", LAB_IA_TOKEN: "x" })).toBeNull();
  });

  it("com LAB_IA_URL, exige o token", () => {
    expect(() => lerConfigDaIa({ LAB_IA_URL: "https://ia.exemplo.test" })).toThrow(/LAB_IA_TOKEN/);
    expect(() =>
      lerConfigDaIa({ LAB_IA_URL: "https://ia.exemplo.test", LAB_IA_TOKEN: " " })
    ).toThrow(ConfigDoLabInvalida);
  });

  it.each(["isto não é url", "ftp://servidor/ia", "javascript:alert(1)"])(
    "recusa o endereço %s",
    (url) => {
      expect(() => lerConfigDaIa({ LAB_IA_URL: url, LAB_IA_TOKEN: "x" })).toThrow(/LAB_IA_URL/);
    }
  );

  it("devolve o endereço e o token aparados", () => {
    expect(
      lerConfigDaIa({ LAB_IA_URL: " https://ia.exemplo.test/v1 ", LAB_IA_TOKEN: " segredo " })
    ).toEqual({
      url: "https://ia.exemplo.test/v1",
      token: "segredo"
    });
  });
});

describe("criarMotorDoLab", () => {
  it("desligado (sem LAB_IA_URL): nenhum motor", () => {
    expect(criarMotorDoLab({ db, env: {}, logger })).toBeNull();
    // Nem a tolerância, que é obrigatória quando ligado, é exigida quando desligado.
    expect(criarMotorDoLab({ db, env: { LAB_LIMITE_TESTES_DIA: "2" }, logger })).toBeNull();
  });

  it("ligado e completo: monta o motor", () => {
    expect(criarMotorDoLab({ db, env: ligado, logger })).toBeInstanceOf(MotorDoTeste);
  });

  it("ligado mas mal configurado: falha dizendo o que falta, em vez de subir quebrado", () => {
    expect(() => criarMotorDoLab({ db, env: { LAB_IA_URL: ligado.LAB_IA_URL }, logger })).toThrow(
      /LAB_IA_TOKEN/
    );
    expect(() =>
      criarMotorDoLab({ db, env: { LAB_IA_URL: ligado.LAB_IA_URL, LAB_IA_TOKEN: "x" }, logger })
    ).toThrow(/LAB_TOLERANCIA_TEMPO_S/);
    expect(() =>
      criarMotorDoLab({ db, env: { ...ligado, LAB_LIMITE_TESTES_DIA: "zero" }, logger })
    ).toThrow(/LAB_LIMITE_TESTES_DIA/);
  });

  it("a injeção (testes) substitui o ambiente e o cliente HTTP", () => {
    const motor = criarMotorDoLab({
      db,
      env: {},
      logger,
      injecao: { ia: new IaFalsa(), config: configDeTeste() }
    });
    expect(motor).toBeInstanceOf(MotorDoTeste);
  });
});
