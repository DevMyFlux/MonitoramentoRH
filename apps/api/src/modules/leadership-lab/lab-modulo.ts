// Leadership Lab — quando o módulo liga, e com que peças.
//
// O módulo só existe se LAB_IA_URL estiver definida. Sem ela, o resto do sistema de RH sobe
// exatamente como antes e as rotas do Lab simplesmente não existem (404). Com ela definida,
// a configuração tem de estar COMPLETA e válida (LAB_IA_TOKEN, LAB_TOLERANCIA_TEMPO_S...): um
// módulo meio configurado derrubaria a subida do servidor, com a mensagem do que falta, em
// vez de começar a falhar na frente do participante.
import type { PrismaClient } from "@prisma/client";
import type { ClienteIa } from "./motor/cliente-ia.js";
import { ClienteIaHttp } from "./motor/cliente-ia-http.js";
import { ConfigDoLabInvalida, type ConfigDoMotor, lerConfigDoLab } from "./motor/config.js";
import { type LoggerDoMotor, MotorDoTeste } from "./motor/motor.js";

export type ConfigDaIa = { url: string; token: string };

/** Peças injetadas, para testes: substituem a leitura do ambiente e o cliente HTTP real. */
export type InjecaoDoLab = {
  ia: ClienteIa;
  config: ConfigDoMotor;
  agora?: () => Date;
};

/** Lê LAB_IA_URL e LAB_IA_TOKEN. Nulo quando o módulo está desligado (sem LAB_IA_URL). */
export function lerConfigDaIa(env: Record<string, string | undefined>): ConfigDaIa | null {
  const url = env.LAB_IA_URL?.trim();
  if (!url) return null;

  let valida = false;
  try {
    const protocolo = new URL(url).protocol;
    valida = protocolo === "http:" || protocolo === "https:";
  } catch {
    valida = false;
  }
  if (!valida) {
    throw new ConfigDoLabInvalida("LAB_IA_URL deve ser um endereço http ou https válido.");
  }

  const token = env.LAB_IA_TOKEN?.trim();
  if (!token) {
    throw new ConfigDoLabInvalida("LAB_IA_TOKEN é obrigatória quando LAB_IA_URL está definida.");
  }
  return { url, token };
}

/**
 * Monta o motor do teste, ou devolve nulo se o módulo estiver desligado. Lança
 * ConfigDoLabInvalida se estiver ligado mas mal configurado.
 */
export function criarMotorDoLab(args: {
  db: PrismaClient;
  env: Record<string, string | undefined>;
  logger: LoggerDoMotor;
  injecao?: InjecaoDoLab;
}): MotorDoTeste | null {
  const { db, env, logger, injecao } = args;

  if (injecao) {
    return new MotorDoTeste({
      db,
      ia: injecao.ia,
      config: injecao.config,
      logger,
      ...(injecao.agora ? { agora: injecao.agora } : {})
    });
  }

  const ia = lerConfigDaIa(env);
  if (!ia) return null;

  const config = lerConfigDoLab(env);
  return new MotorDoTeste({
    db,
    ia: new ClienteIaHttp({ baseUrl: ia.url, token: ia.token, timeoutMs: config.iaTimeoutMs }),
    config,
    logger
  });
}
