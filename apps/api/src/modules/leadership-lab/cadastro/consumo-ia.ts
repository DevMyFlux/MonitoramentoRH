// Consumo de IA do Leadership Lab, para o administrador acompanhar custo e saúde do serviço.
// Só agregados do log_ia (que não guarda conteúdo nem identifica ninguém): nenhum dado de pessoa.
import type { PrismaClient } from "@prisma/client";
import { type LabAtor, type LabConsumoDeIa, labAgentesIa } from "@my-flux/shared";
import { assertAcesso } from "../lab-access.js";

export const DIAS_DO_CONSUMO = 30;

/** Preço por milhão de tokens, em dólar. Vem do ambiente: o sistema não supõe tabela de preço. */
export type PrecoDaIa = { entradaPorMilhao: number; saidaPorMilhao: number };

export function lerPrecoDaIa(env: Record<string, string | undefined>): PrecoDaIa | null {
  const ler = (nome: string) => {
    const bruto = env[nome]?.trim().replace(",", ".");
    const valor = bruto ? Number(bruto) : NaN;
    return Number.isFinite(valor) && valor >= 0 ? valor : null;
  };
  const entradaPorMilhao = ler("LAB_IA_PRECO_ENTRADA_USD_MILHAO");
  const saidaPorMilhao = ler("LAB_IA_PRECO_SAIDA_USD_MILHAO");
  return entradaPorMilhao === null || saidaPorMilhao === null
    ? null
    : { entradaPorMilhao, saidaPorMilhao };
}

export type LinhaPorAgente = {
  agente: string;
  chamadas: number;
  falhas: number;
  tokensEntrada: number;
  tokensSaida: number;
  latenciaMediaMs: number;
};
export type LinhaPorTeste = { tokensEntrada: number; tokensSaida: number };

const duasCasas = (n: number) => Math.round(n * 100) / 100;
const custo = (preco: PrecoDaIa, entrada: number, saida: number) =>
  (entrada * preco.entradaPorMilhao + saida * preco.saidaPorMilhao) / 1_000_000;

/** Pura: dos agregados do banco para o que a tela mostra. */
export function montarConsumo(
  porAgente: LinhaPorAgente[],
  testesConcluidos: LinhaPorTeste[],
  preco: PrecoDaIa | null
): LabConsumoDeIa {
  const ordem = new Map<string, number>(labAgentesIa.map((a, i) => [a, i]));
  const agentes = [...porAgente]
    .sort((a, b) => (ordem.get(a.agente) ?? 99) - (ordem.get(b.agente) ?? 99))
    .map((a) => ({ ...a, latenciaMediaMs: Math.round(a.latenciaMediaMs) }));
  const soma = (linhas: LinhaPorTeste[]) =>
    linhas.reduce(
      (t, l) => ({ entrada: t.entrada + l.tokensEntrada, saida: t.saida + l.tokensSaida }),
      { entrada: 0, saida: 0 }
    );
  const total = soma(agentes);
  const dosTestes = soma(testesConcluidos);
  const n = testesConcluidos.length;
  return {
    dias: DIAS_DO_CONSUMO,
    agentes,
    testesConcluidos: n,
    tokensPorTeste: n === 0 ? null : Math.round((dosTestes.entrada + dosTestes.saida) / n),
    custoEstimadoUsd:
      preco === null
        ? null
        : {
            total: duasCasas(custo(preco, total.entrada, total.saida)),
            porTeste:
              n === 0 ? null : duasCasas(custo(preco, dosTestes.entrada, dosTestes.saida) / n)
          }
  };
}

export class ConsumoDeIa {
  constructor(
    private readonly db: PrismaClient,
    private readonly preco: PrecoDaIa | null,
    private readonly agora: () => Date = () => new Date()
  ) {}

  async ler(ator: LabAtor): Promise<LabConsumoDeIa> {
    assertAcesso(ator, "config-consumo-ia:ler");
    const desde = new Date(this.agora().getTime() - DIAS_DO_CONSUMO * 24 * 60 * 60 * 1000);
    const [grupos, falhas, porTeste] = await Promise.all([
      this.db.labLogIa.groupBy({
        by: ["agente"],
        where: { criadoEm: { gte: desde } },
        _count: { _all: true },
        _sum: { tokensEntrada: true, tokensSaida: true },
        _avg: { latenciaMs: true }
      }),
      this.db.labLogIa.groupBy({
        by: ["agente"],
        where: { criadoEm: { gte: desde }, sucesso: false },
        _count: { _all: true }
      }),
      // Custo de um teste = tudo o que foi chamado em nome dele (situações, guarda, analista e a
      // conversa de debriefing), só de testes concluídos.
      this.db.labLogIa.groupBy({
        by: ["sessaoId"],
        where: { criadoEm: { gte: desde }, sessao: { status: "concluida" } },
        _sum: { tokensEntrada: true, tokensSaida: true }
      })
    ]);
    const falhasPorAgente = new Map(falhas.map((f) => [f.agente, f._count._all]));
    return montarConsumo(
      grupos.map((g) => ({
        agente: g.agente,
        chamadas: g._count._all,
        falhas: falhasPorAgente.get(g.agente) ?? 0,
        tokensEntrada: g._sum.tokensEntrada ?? 0,
        tokensSaida: g._sum.tokensSaida ?? 0,
        latenciaMediaMs: g._avg.latenciaMs ?? 0
      })),
      porTeste.map((t) => ({
        tokensEntrada: t._sum.tokensEntrada ?? 0,
        tokensSaida: t._sum.tokensSaida ?? 0
      })),
      this.preco
    );
  }
}
