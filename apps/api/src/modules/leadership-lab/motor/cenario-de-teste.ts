// Leadership Lab — montagem de cenários para os testes de integração do motor.
// Só para testes: nada de produção importa este arquivo.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { LabAtor, LabEscolha } from "@my-flux/shared";
import { applyMigrations, createTestDatabase, type TestDatabase } from "../db/test-database.js";
import {
  type Base,
  type Contexto,
  criarBase,
  criarCargoComMolde,
  criarParticipante
} from "../db/test-fixtures.js";
import type { ConfigDoMotor } from "./config.js";
import { IaFalsa } from "./ia-falsa.js";
import { MotorDoTeste } from "./motor.js";
import type { RespostaDoTeste } from "./visoes.js";

/** Tempo limite por situação dos moldes ativados nos testes. */
export const TEMPO_LIMITE_S = 60;
export const TOLERANCIA_S = 3;
export const INICIO_DO_RELOGIO = "2026-03-02T13:00:00.000Z";

export type Banco = { db: TestDatabase; prisma: PrismaClient; base: Base };

export async function prepararBanco(): Promise<Banco> {
  const db = await createTestDatabase();
  await applyMigrations(db.client);
  const base = await criarBase(db.client);
  // Os moldes nascem inativos; ativa o do supervisor com tempo. O do coordenador segue inativo.
  await db.client.query(
    `UPDATE leadership_lab.molde SET ativo = true, tempo_limite_s = $1 WHERE nivel = 'supervisor'`,
    [TEMPO_LIMITE_S]
  );
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: db.url }) });
  return { db, prisma, base };
}

export async function encerrarBanco(banco: Banco | undefined): Promise<void> {
  await banco?.prisma.$disconnect();
  await banco?.db.drop();
}

export class RelogioFalso {
  constructor(private instante = new Date(INICIO_DO_RELOGIO)) {}
  agora = (): Date => new Date(this.instante);
  avancar(ms: number): this {
    this.instante = new Date(this.instante.getTime() + ms);
    return this;
  }
  definir(iso: string): this {
    this.instante = new Date(iso);
    return this;
  }
}

export const configDeTeste = (extra: Partial<ConfigDoMotor> = {}): ConfigDoMotor => ({
  toleranciaTempoS: TOLERANCIA_S,
  limiteTestesDia: null,
  versaoTermo: "2026-1",
  fusoHorario: "America/Sao_Paulo",
  iaTimeoutMs: 25_000,
  ...extra
});

export type Cenario = {
  banco: Banco;
  ia: IaFalsa;
  relogio: RelogioFalso;
  motor: MotorDoTeste;
  ctx: Contexto;
  ator: LabAtor;
  config: ConfigDoMotor;
  avisos: Array<{ dados: object; mensagem: string }>;
};

export type OpcoesDoCenario = {
  config?: Partial<ConfigDoMotor>;
  /** Nível do molde do cargo do participante. Padrão: supervisor (o ativo). */
  nivel?: "encarregado" | "supervisor" | "coordenador" | null;
  /** Aceitar o termo de ciência já na montagem. Padrão: sim. */
  termoAceito?: boolean;
  usuario?: Record<string, unknown>;
  colaborador?: Record<string, unknown>;
  ia?: IaFalsa;
  relogio?: RelogioFalso;
};

export async function novoCenario(banco: Banco, opcoes: OpcoesDoCenario = {}): Promise<Cenario> {
  const nivel = opcoes.nivel === undefined ? "supervisor" : opcoes.nivel;
  const functionId = nivel === null ? null : await criarCargoComMolde(banco.db.client, nivel);
  const ctx = await criarParticipante(banco.db.client, banco.base, {
    ...(opcoes.usuario ? { usuario: opcoes.usuario } : {}),
    colaborador: { ...(functionId ? { functionId } : {}), ...opcoes.colaborador }
  });

  const ia = opcoes.ia ?? new IaFalsa();
  const relogio = opcoes.relogio ?? new RelogioFalso();
  const config = configDeTeste(opcoes.config);
  const avisos: Cenario["avisos"] = [];
  const motor = new MotorDoTeste({
    db: banco.prisma,
    ia,
    config,
    agora: relogio.agora,
    logger: { warn: (dados, mensagem) => avisos.push({ dados, mensagem }) }
  });

  const ator: LabAtor = {
    userId: ctx.userId,
    role: "COMUM",
    participanteId: ctx.participanteId,
    permissoes: []
  };

  if (opcoes.termoAceito !== false) await motor.aceitarTermo(ator);
  return { banco, ia, relogio, motor, ctx, ator, config, avisos };
}

/**
 * Faz um teste inteiro: inicia e responde cada situação depois de `segundosPorResposta`.
 * Devolve todas as respostas na ordem (a da abertura primeiro, a do resultado por último).
 */
export async function jogar(
  c: Cenario,
  escolhas: LabEscolha[],
  segundosPorResposta = 10
): Promise<RespostaDoTeste[]> {
  const respostas: RespostaDoTeste[] = [await c.motor.iniciar(c.ator)];
  let atual = respostas[0] as RespostaDoTeste;
  for (const [i, escolha] of escolhas.entries()) {
    if (atual.tipo !== "situacao") throw new Error(`jogar: teste acabou antes da escolha ${i + 1}`);
    c.relogio.avancar(segundosPorResposta * 1000);
    atual = await c.motor.responder(c.ator, atual.sessaoId, {
      numero: atual.situacao.numero,
      escolha
    });
    respostas.push(atual);
  }
  return respostas;
}

/** Espera uma condição ficar verdadeira (para sincronizar requisições simultâneas). */
export async function esperarAte(condicao: () => boolean, limiteMs = 3000): Promise<void> {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error("esperarAte: condição não ocorreu a tempo");
    await new Promise((resolver) => setTimeout(resolver, 5));
  }
}
