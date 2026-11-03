// Leadership Lab — cálculos do backend.
//
// Funções puras: sem banco, sem relógio, sem I/O. A IA propõe a aderência de cada
// escolha; TODOS os indicadores abaixo são calculados aqui, nunca pela IA.
//
// Onde a documentação do módulo deixa uma lacuna, a leitura adotada está marcada
// com "INTERPRETAÇÃO" e listada em docs/leadership-lab.md, para decisão do negócio.
import {
  labAderenciaEscala,
  labEstilos,
  type LabEstilo,
  type LabFlexibilidade
} from "./leadership-lab.js";

/** Entrada inválida ou incoerente. Indica defeito de quem chamou, não do participante. */
export class LabCalculoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LabCalculoError";
  }
}

export type LabNivel = 1 | 2 | 3 | 4 | 5;

/** Alerta amarelo: média da skill ABAIXO de 50 (estritamente). */
export const LAB_ALERTA_AMARELO_MEDIA_MAXIMA = 50;

/** Tendência e tipo de perfil só aparecem depois de 3 testes. */
export const LAB_TESTES_MINIMOS_TENDENCIA = 3;

/** Flexibilidade: alta a partir de 80%, média a partir de 40%, baixa abaixo disso. */
export const labFlexibilidadeLimites = { alta: 80, media: 40 } as const;

/** Piso da média para cada nível, do mais alto para o mais baixo. Abaixo de 25 = nível 1. */
const pisosDeNivel = [
  [5, 90],
  [4, 70],
  [3, 50],
  [2, 25]
] as const satisfies ReadonlyArray<readonly [LabNivel, number]>;

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Arredonda para `casas` casas decimais (padrão 2). Só para o que é gravado e exibido. */
export function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function media(valores: readonly number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function exigirPercentual(valor: number, nome: string): void {
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    throw new LabCalculoError(`${nome} deve estar entre 0 e 100 (recebido: ${valor}).`);
  }
}

function exigirTempoLimite(tempoLimiteS: number): void {
  if (!Number.isFinite(tempoLimiteS) || tempoLimiteS <= 0) {
    throw new LabCalculoError(`Tempo limite deve ser positivo (recebido: ${tempoLimiteS}).`);
  }
}

// ---------------------------------------------------------------------------
// Nível por skill e flexibilidade: de percentual para classe
// ---------------------------------------------------------------------------

/**
 * Nível de uma skill a partir da média da aderência das escolhas ligadas a ela:
 * 90 ou mais = 5; 70 a 89 = 4; 50 a 69 = 3; 25 a 49 = 2; abaixo de 25 = 1.
 *
 * INTERPRETAÇÃO: a média não é inteira (ex.: 89,5), então "70 a 89" é lido como o
 * intervalo contínuo [70, 90). A média entra SEM arredondar.
 */
export function nivelDaMedia(mediaAderencia: number): LabNivel {
  exigirPercentual(mediaAderencia, "Média de aderência");
  for (const [nivel, piso] of pisosDeNivel) {
    if (mediaAderencia >= piso) return nivel;
  }
  return 1;
}

/** Flexibilidade: alta a partir de 80%, média de 40% a 79%, baixa abaixo de 40%. */
export function classificarFlexibilidade(percentual: number): LabFlexibilidade {
  exigirPercentual(percentual, "Percentual de flexibilidade");
  if (percentual >= labFlexibilidadeLimites.alta) return "alta";
  if (percentual >= labFlexibilidadeLimites.media) return "media";
  return "baixa";
}

// ---------------------------------------------------------------------------
// Tempo: medido no servidor
// ---------------------------------------------------------------------------

export type MedicaoResposta = {
  /** Tempo decorrido sem descontar nada. */
  tempoBrutoMs: number;
  /** Tempo da resposta, já descontada a tolerância de rede. É o que entra na agilidade. */
  tempoRespostaMs: number;
  /** A resposta chegou depois do limite. Vale como omissão (aderência 0). */
  esgotado: boolean;
};

/**
 * Mede uma resposta com os relógios do servidor. A tolerância (LAB_TOLERANCIA_TEMPO_S)
 * é descontada do tempo decorrido, uma vez, para não punir a latência da rede.
 * Chegar exatamente no limite ainda vale. Relógio que anda para trás vira 0.
 */
export function medirResposta(args: {
  apresentadaEm: Date;
  recebidaEm: Date;
  tempoLimiteS: number;
  toleranciaS: number;
}): MedicaoResposta {
  const { apresentadaEm, recebidaEm, tempoLimiteS, toleranciaS } = args;
  exigirTempoLimite(tempoLimiteS);
  if (!Number.isFinite(toleranciaS) || toleranciaS < 0) {
    throw new LabCalculoError(`Tolerância deve ser zero ou positiva (recebido: ${toleranciaS}).`);
  }
  const inicio = apresentadaEm.getTime();
  const fim = recebidaEm.getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fim)) {
    throw new LabCalculoError("Datas de apresentação e de resposta devem ser válidas.");
  }
  const tempoBrutoMs = Math.max(0, fim - inicio);
  const tempoRespostaMs = Math.round(Math.max(0, tempoBrutoMs - toleranciaS * 1000));
  return { tempoBrutoMs, tempoRespostaMs, esgotado: tempoRespostaMs > tempoLimiteS * 1000 };
}

/**
 * Agilidade de uma situação: max(0; 1 − tempo de resposta ÷ tempo limite) × 100.
 * Tempo esgotado conta 0.
 */
export function agilidadeDoTurno(
  turno: { tempoEsgotado: boolean; tempoRespostaMs: number | null },
  tempoLimiteS: number
): number {
  exigirTempoLimite(tempoLimiteS);
  if (turno.tempoEsgotado) return 0;
  const tempo = turno.tempoRespostaMs;
  if (tempo === null || !Number.isFinite(tempo) || tempo < 0) {
    throw new LabCalculoError("Situação respondida precisa de tempo de resposta (>= 0).");
  }
  return Math.max(0, 1 - tempo / (tempoLimiteS * 1000)) * 100;
}

// ---------------------------------------------------------------------------
// Resultado de um teste
// ---------------------------------------------------------------------------

/** Uma situação já respondida (ou esgotada) e avaliada. */
export type TurnoResolvido = {
  numero: number;
  /** Escala fixa 100, 70, 40, 10 ou 0. O 0 só existe para tempo esgotado. */
  aderencia: number;
  tempoEsgotado: boolean;
  /** Nulo quando o tempo esgotou. */
  tempoRespostaMs: number | null;
  /** Estilo usado na escolha. Nulo quando a escolha não envolveu a equipe. */
  estilo: LabEstilo | null;
  /** Estilo adequado à situação, definido por quem a criou. */
  estiloAdequado: LabEstilo;
  /** Skills ligadas à escolha. */
  skills: readonly string[];
};

export type NivelDeSkill = {
  nivel: LabNivel;
  /** Média da aderência das escolhas ligadas à skill (2 casas). */
  media: number;
  /** Quantas escolhas sustentam o nível. */
  nEvidencias: number;
};

export type ResultadoCalculado = {
  aderenciaGeral: number;
  agilidade: number;
  /** Só skills com ao menos uma evidência. */
  niveisPorSkill: Record<string, NivelDeSkill>;
  /** Nulo se nenhuma escolha envolveu a equipe, ou se houve empate (veja estilosEmpatados). */
  estiloPredominante: LabEstilo | null;
  /** Estilos empatados no topo, na ordem canônica. Vazio quando não há empate. */
  estilosEmpatados: LabEstilo[];
  /** Nulo se nenhuma escolha envolveu a equipe. */
  flexibilidadePct: number | null;
  flexibilidade: LabFlexibilidade | null;
  /** Números das situações com aderência 10: alerta vermelho e tema obrigatório do debriefing. */
  turnosComAlertaVermelho: number[];
};

function validarTurnos(turnos: readonly TurnoResolvido[]): void {
  if (turnos.length === 0) throw new LabCalculoError("O teste precisa ter ao menos uma situação.");
  const vistos = new Set<number>();
  for (const turno of turnos) {
    if (!Number.isInteger(turno.numero) || turno.numero < 1 || vistos.has(turno.numero)) {
      throw new LabCalculoError(`Número de situação inválido ou repetido: ${turno.numero}.`);
    }
    vistos.add(turno.numero);
    const rotulo = `Situação ${turno.numero}`;
    if (!(labAderenciaEscala as readonly number[]).includes(turno.aderencia)) {
      throw new LabCalculoError(`${rotulo}: aderência ${turno.aderencia} fora da escala.`);
    }
    if (turno.tempoEsgotado) {
      if (turno.aderencia !== 0 || turno.tempoRespostaMs !== null) {
        throw new LabCalculoError(
          `${rotulo}: tempo esgotado exige aderência 0 e sem tempo de resposta.`
        );
      }
    } else if (turno.aderencia === 0) {
      throw new LabCalculoError(`${rotulo}: aderência 0 só existe para tempo esgotado.`);
    }
    if (turno.estilo !== null && !labEstilos.includes(turno.estilo)) {
      throw new LabCalculoError(`${rotulo}: estilo desconhecido "${turno.estilo}".`);
    }
    if (!labEstilos.includes(turno.estiloAdequado)) {
      throw new LabCalculoError(
        `${rotulo}: estilo adequado desconhecido "${turno.estiloAdequado}".`
      );
    }
    if (turno.skills.some((s) => typeof s !== "string" || s.trim() === "")) {
      throw new LabCalculoError(`${rotulo}: skill com identificador vazio.`);
    }
  }
}

/**
 * Fecha um teste: calcula os indicadores a partir das situações já avaliadas.
 *
 * - Aderência geral: média de todas as situações (tempo esgotado entra como 0).
 * - Agilidade: média da agilidade de cada situação (veja agilidadeDoTurno).
 * - Nível por skill: veja nivelDaMedia. Uma situação que cita a mesma skill duas vezes
 *   conta uma vez. Se uma situação com tempo esgotado traz skills, elas contam com 0.
 * - Estilo predominante e flexibilidade.
 *   INTERPRETAÇÃO: "escolhas que envolveram a equipe" = situações respondidas em que
 *   `estilo` não é nulo. Omissão (tempo esgotado) não é decisão e fica de fora dos dois.
 *   Se houver empate no estilo mais frequente, NÃO se escolhe um: `estiloPredominante`
 *   fica nulo e os empatados vão em `estilosEmpatados` (desempate é decisão do negócio).
 * - Valores devolvidos com 2 casas; o nível usa a média sem arredondar.
 */
export function calcularResultado(
  turnos: readonly TurnoResolvido[],
  opcoes: { tempoLimiteS: number }
): ResultadoCalculado {
  validarTurnos(turnos);
  exigirTempoLimite(opcoes.tempoLimiteS);

  const aderenciaGeral = media(turnos.map((t) => t.aderencia));
  const agilidade = media(turnos.map((t) => agilidadeDoTurno(t, opcoes.tempoLimiteS)));

  const porSkill = new Map<string, number[]>();
  for (const turno of turnos) {
    for (const skill of new Set(turno.skills)) {
      const lista = porSkill.get(skill) ?? [];
      lista.push(turno.aderencia);
      porSkill.set(skill, lista);
    }
  }
  const niveisPorSkill: Record<string, NivelDeSkill> = {};
  for (const [skill, aderencias] of porSkill) {
    const mediaDaSkill = media(aderencias);
    niveisPorSkill[skill] = {
      nivel: nivelDaMedia(mediaDaSkill),
      media: arredondar(mediaDaSkill),
      nEvidencias: aderencias.length
    };
  }

  const decisoes = turnos.filter((t) => !t.tempoEsgotado && t.estilo !== null);
  const contagem = new Map<LabEstilo, number>();
  for (const turno of decisoes) {
    const estilo = turno.estilo as LabEstilo;
    contagem.set(estilo, (contagem.get(estilo) ?? 0) + 1);
  }
  const maior = decisoes.length > 0 ? Math.max(...contagem.values()) : 0;
  const lideres = decisoes.length > 0 ? labEstilos.filter((e) => contagem.get(e) === maior) : [];

  let flexibilidadePct: number | null = null;
  let flexibilidade: LabFlexibilidade | null = null;
  if (decisoes.length > 0) {
    const adequadas = decisoes.filter((t) => t.estilo === t.estiloAdequado).length;
    const pct = (adequadas / decisoes.length) * 100;
    flexibilidadePct = arredondar(pct);
    flexibilidade = classificarFlexibilidade(pct);
  }

  return {
    aderenciaGeral: arredondar(aderenciaGeral),
    agilidade: arredondar(agilidade),
    niveisPorSkill,
    estiloPredominante: lideres.length === 1 ? (lideres[0] ?? null) : null,
    estilosEmpatados: lideres.length > 1 ? [...lideres] : [],
    flexibilidadePct,
    flexibilidade,
    turnosComAlertaVermelho: turnos
      .filter((t) => t.aderencia === 10)
      .map((t) => t.numero)
      .sort((a, b) => a - b)
  };
}

// ---------------------------------------------------------------------------
// Alertas e painel
// ---------------------------------------------------------------------------

/**
 * Alerta amarelo: a mesma skill com média abaixo de 50 em dois testes seguidos.
 *
 * Recebe as médias da skill em ordem cronológica, a mais recente por último, e olha as
 * duas últimas. Quem chama decide quais testes entram na série.
 * INTERPRETAÇÃO: a série deve ter só os testes em que a skill teve evidência (um teste
 * sem a skill não interrompe nem conta). Com isso, "média < 50" equivale a nível <= 2.
 */
export function deveGerarAlertaAmarelo(mediasCronologicas: readonly number[]): boolean {
  if (mediasCronologicas.length < 2) return false;
  return mediasCronologicas.slice(-2).every((m) => {
    exigirPercentual(m, "Média da skill");
    return m < LAB_ALERTA_AMARELO_MEDIA_MAXIMA;
  });
}

/** Tendência e tipo de perfil só aparecem depois de 3 testes concluídos. */
export function podeExibirTendencia(testesConcluidos: number): boolean {
  return Number.isInteger(testesConcluidos) && testesConcluidos >= LAB_TESTES_MINIMOS_TENDENCIA;
}
