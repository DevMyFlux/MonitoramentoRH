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
import { IaDemonstracao } from "./demonstracao/ia-demonstracao.js";
import { leitorDoPercurso } from "./demonstracao/leitor.js";
import { idsDasCategorias } from "./simulador/catalogo.js";
import { ConfigDoLabInvalida, type ConfigDoMotor, lerConfigDoLab } from "./motor/config.js";
import { type LoggerDoMotor, MotorDoTeste } from "./motor/motor.js";

/** Tolerância de rede do modo demonstração, quando LAB_TOLERANCIA_TEMPO_S não é definida. */
const TOLERANCIA_DA_DEMONSTRACAO_S = "3";

/** LAB_MODO_DEMO=true pede o modo demonstração. Qualquer outro valor (ou nenhum) deixa desligado. */
export function modoDemonstracaoPedido(env: Record<string, string | undefined>): boolean {
  return env.LAB_MODO_DEMO?.trim().toLowerCase() === "true";
}

/**
 * O modo demonstração só vale SEM serviço de IA real: com LAB_IA_URL definida, a IA real sempre
 * vence e a variável é ignorada (produção nunca troca a IA de verdade por uma de exemplo).
 */
export function usaModoDemonstracao(env: Record<string, string | undefined>): boolean {
  return modoDemonstracaoPedido(env) && !env.LAB_IA_URL?.trim();
}

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
  if (!ia) {
    if (!modoDemonstracaoPedido(env)) return null;
    // Sem IA real, mas com a demonstração pedida: a IA de exemplo, com a tolerância de rede padrão
    // da demonstração (a variável LAB_TOLERANCIA_TEMPO_S, se definida, vale).
    const config = lerConfigDoLab({ LAB_TOLERANCIA_TEMPO_S: TOLERANCIA_DA_DEMONSTRACAO_S, ...env });
    return new MotorDoTeste({
      db,
      ia: new IaDemonstracao(leitorDoPercurso(db)),
      config: { ...config, demonstracao: true },
      logger,
      temasDeSimulacao: idsDasCategorias
    });
  }
  if (modoDemonstracaoPedido(env)) {
    logger.warn({}, "LAB_MODO_DEMO ignorada: LAB_IA_URL está definida, então vale a IA real.");
  }

  const config = lerConfigDoLab(env);
  return new MotorDoTeste({
    db,
    ia: new ClienteIaHttp({ baseUrl: ia.url, token: ia.token, timeoutMs: config.iaTimeoutMs }),
    config,
    logger
  });
}
