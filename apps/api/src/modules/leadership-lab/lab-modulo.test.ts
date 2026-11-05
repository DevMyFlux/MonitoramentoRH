import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { IaDemonstracao } from "./demonstracao/ia-demonstracao.js";
import {
  criarMotorDoLab,
  lerAutenticacaoDaIa,
  lerConfigDaIa,
  modoDemonstracaoPedido,
  usaModoDemonstracao
} from "./lab-modulo.js";
import { ClienteIaHttp } from "./motor/cliente-ia-http.js";
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

describe("lerAutenticacaoDaIa", () => {
  it("vazia: só o token de serviço", () => {
    expect(lerAutenticacaoDaIa({})).toBeNull();
    expect(lerAutenticacaoDaIa({ LAB_IA_AUTENTICACAO: "  " })).toBeNull();
  });

  it('"cloud-run" liga o ID token, sem diferenciar maiúsculas', () => {
    expect(lerAutenticacaoDaIa({ LAB_IA_AUTENTICACAO: " Cloud-Run " })).toBe("cloud-run");
  });

  it("outro valor é erro de configuração", () => {
    expect(() => lerAutenticacaoDaIa({ LAB_IA_AUTENTICACAO: "iam" })).toThrow(ConfigDoLabInvalida);
  });

  it("valor inválido derruba a subida do módulo ligado", () => {
    expect(() =>
      criarMotorDoLab({ db, env: { ...ligado, LAB_IA_AUTENTICACAO: "sim" }, logger })
    ).toThrow(/LAB_IA_AUTENTICACAO/);
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

describe("modo demonstração (LAB_MODO_DEMO)", () => {
  // Só para olhar o que o motor recebeu: o campo é privado e não há outro jeito de saber.
  const internos = (motor: MotorDoTeste | null) =>
    motor as unknown as {
      ia: unknown;
      config: { demonstracao?: boolean; toleranciaTempoS: number };
    };
  const avisos: Array<{ dados: object; mensagem: string }> = [];
  const registro = { warn: (dados: object, mensagem: string) => avisos.push({ dados, mensagem }) };

  it.each(["true", "TRUE", " true "])("%j pede o modo demonstração", (valor) => {
    expect(modoDemonstracaoPedido({ LAB_MODO_DEMO: valor })).toBe(true);
  });

  it.each(["", "false", "FALSE", "1", "yes", "sim", "on", "verdadeiro"])(
    "%j NÃO pede (só o texto true liga)",
    (valor) => {
      expect(modoDemonstracaoPedido({ LAB_MODO_DEMO: valor })).toBe(false);
    }
  );

  it("desligado por padrão: sem a variável, o módulo continua desligado e nada muda", () => {
    expect(modoDemonstracaoPedido({})).toBe(false);
    expect(usaModoDemonstracao({})).toBe(false);
    expect(criarMotorDoLab({ db, env: {}, logger })).toBeNull();
    expect(criarMotorDoLab({ db, env: { LAB_MODO_DEMO: "false" }, logger })).toBeNull();
  });

  it("sem IA real, LAB_MODO_DEMO=true liga o módulo com a IA de demonstração (sem token nem tolerância)", () => {
    const env = { LAB_MODO_DEMO: "true" };
    const motor = criarMotorDoLab({ db, env, logger });
    expect(motor).toBeInstanceOf(MotorDoTeste);
    expect(internos(motor).ia).toBeInstanceOf(IaDemonstracao);
    expect(internos(motor).config.demonstracao).toBe(true);
    expect(internos(motor).config.toleranciaTempoS).toBe(3);
    expect(usaModoDemonstracao(env)).toBe(true);
  });

  it("a tolerância definida no ambiente vale na demonstração, e um valor inválido falha como sempre", () => {
    const motor = criarMotorDoLab({
      db,
      env: { LAB_MODO_DEMO: "true", LAB_TOLERANCIA_TEMPO_S: "7" },
      logger
    });
    expect(internos(motor).config.toleranciaTempoS).toBe(7);
    expect(() =>
      criarMotorDoLab({ db, env: { LAB_MODO_DEMO: "true", LAB_TOLERANCIA_TEMPO_S: "-1" }, logger })
    ).toThrow(ConfigDoLabInvalida);
  });

  it("com LAB_IA_URL definida, a IA REAL sempre vence: a demonstração é ignorada, com aviso", () => {
    avisos.length = 0;
    const env = { ...ligado, LAB_MODO_DEMO: "true" };
    const motor = criarMotorDoLab({ db, env, logger: registro });
    expect(internos(motor).ia).toBeInstanceOf(ClienteIaHttp);
    expect(internos(motor).config.demonstracao).toBeUndefined();
    expect(usaModoDemonstracao(env)).toBe(false);
    expect(avisos.map((a) => a.mensagem)).toEqual([
      "LAB_MODO_DEMO ignorada: LAB_IA_URL está definida, então vale a IA real."
    ]);
  });

  it("a IA real configurada sem a variável não avisa nada", () => {
    avisos.length = 0;
    criarMotorDoLab({ db, env: ligado, logger: registro });
    expect(avisos).toEqual([]);
  });

  it("LAB_IA_URL só com espaços não conta como IA real", () => {
    expect(usaModoDemonstracao({ LAB_MODO_DEMO: "true", LAB_IA_URL: "   " })).toBe(true);
  });

  it("a injeção (testes) continua mandando, mesmo com a demonstração pedida", () => {
    const ia = new IaFalsa();
    const motor = criarMotorDoLab({
      db,
      env: { LAB_MODO_DEMO: "true" },
      logger,
      injecao: { ia, config: configDeTeste() }
    });
    expect(internos(motor).ia).toBe(ia);
    expect(internos(motor).config.demonstracao).toBeUndefined();
  });
});
