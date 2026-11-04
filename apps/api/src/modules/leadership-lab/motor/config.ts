// Leadership Lab — configuração do motor do teste, lida das variáveis de ambiente do backend.
//
// A tolerância de tempo NÃO tem valor padrão: a documentação não define quantos segundos de
// latência de rede se descontam, e um valor escolhido aqui mudaria a nota de quem responde no
// limite. Sem a variável, o motor se recusa a subir, em vez de decidir por conta própria.
import { labTermoVersaoAtual } from "@my-flux/shared";

export type ConfigDoMotor = {
  /** Segundos descontados do tempo de resposta pela latência da rede (LAB_TOLERANCIA_TEMPO_S). */
  toleranciaTempoS: number;
  /** Testes por participante por dia; nulo = sem limite (LAB_LIMITE_TESTES_DIA). */
  limiteTestesDia: number | null;
  /** Versão do termo de ciência que precisa estar aceita para começar um teste. */
  versaoTermo: string;
  /** Fuso que define o que é "hoje" para o limite diário. */
  fusoHorario: string;
  /**
   * Tempo máximo de uma chamada à IA (LAB_IA_TIMEOUT_MS). Também dimensiona a reserva do turno
   * enquanto a IA é consultada. Fica abaixo dos 30 s do cliente web, para o servidor desistir
   * antes de o navegador desistir.
   */
  iaTimeoutMs: number;
  /**
   * Modo demonstração (LAB_MODO_DEMO, sem serviço de IA real): o motor usa a IA de demonstração e o
   * painel avisa a tela. Ausente ou falso em produção normal.
   */
  demonstracao?: boolean;
};

export const IA_TIMEOUT_PADRAO_MS = 25_000;
export const FUSO_PADRAO = "America/Sao_Paulo";

export class ConfigDoLabInvalida extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigDoLabInvalida";
  }
}

function numero(
  env: Record<string, string | undefined>,
  nome: string,
  { inteiro, minimo }: { inteiro: boolean; minimo: number }
): number | undefined {
  const bruto = env[nome]?.trim();
  if (bruto === undefined || bruto === "") return undefined;
  const valor = Number(bruto);
  if (!Number.isFinite(valor) || valor < minimo || (inteiro && !Number.isInteger(valor))) {
    throw new ConfigDoLabInvalida(
      `${nome} deve ser ${inteiro ? "um inteiro" : "um número"} maior ou igual a ${minimo} (recebido: "${bruto}").`
    );
  }
  return valor;
}

export function lerConfigDoLab(env: Record<string, string | undefined>): ConfigDoMotor {
  const toleranciaTempoS = numero(env, "LAB_TOLERANCIA_TEMPO_S", { inteiro: false, minimo: 0 });
  if (toleranciaTempoS === undefined) {
    throw new ConfigDoLabInvalida(
      "LAB_TOLERANCIA_TEMPO_S é obrigatória: defina quantos segundos de latência de rede " +
        "são descontados do tempo de resposta (0 para não descontar nada)."
    );
  }
  return {
    toleranciaTempoS,
    limiteTestesDia: numero(env, "LAB_LIMITE_TESTES_DIA", { inteiro: true, minimo: 1 }) ?? null,
    versaoTermo: labTermoVersaoAtual,
    fusoHorario: FUSO_PADRAO,
    iaTimeoutMs:
      numero(env, "LAB_IA_TIMEOUT_MS", { inteiro: true, minimo: 1000 }) ?? IA_TIMEOUT_PADRAO_MS
  };
}
