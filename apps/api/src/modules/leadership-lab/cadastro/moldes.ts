// Leadership Lab — configuração dos moldes: o tempo por situação, a liberação do teste e quais
// cargos do RH usam cada molde. É decisão do administrador (ADMIN e DEV), e é configuração do
// módulo: nenhum dado de pessoa passa por aqui.
//
// O tempo por situação é decisão de NEGÓCIO em aberto. Esta tela não sugere nem preenche nenhum
// valor: o molde nasce sem tempo e desligado, e só vale o que o administrador digitar.
//
// Duas travas protegem testes em curso, porque o motor lê o tempo do molde a cada resposta:
//   - o tempo não muda enquanto houver teste em andamento nesse molde;
//   - a mudança e a criação de um teste se serializam (linha do molde travada), então um teste não
//     começa no meio da troca.
import {
  type LabAtor,
  type LabAtualizarMoldeEntrada,
  type LabConfigDosMoldes,
  labMoldeNiveis
} from "@my-flux/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@my-flux/types";
import { z } from "zod";
import { assertAcesso } from "../lab-access.js";
import { registrarAuditoria } from "./auditoria.js";
import { errosDoCadastro } from "./erros.js";
import { nivelDoMolde } from "./visoes.js";

const temasSchema = z.array(z.string());

type Db = PrismaClient | Prisma.TransactionClient;

/** A ordem natural dos níveis, não a do banco. */
const ORDEM = new Map<string, number>(labMoldeNiveis.map((nivel, i) => [nivel, i]));

async function lerConfiguracao(db: Db): Promise<LabConfigDosMoldes> {
  const [moldes, cargos, emAndamento] = await Promise.all([
    db.labMolde.findMany({ include: { cargos: { select: { jobFunctionId: true } } } }),
    db.jobFunction.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        labMolde: { select: { molde: { select: { nivel: true } } } }
      },
      orderBy: [{ name: "asc" }, { id: "asc" }]
    }),
    db.labSessao.groupBy({
      by: ["moldeId"],
      where: { status: "em_andamento" },
      _count: { _all: true }
    })
  ]);
  const testes = new Map(emAndamento.map((g) => [g.moldeId, g._count._all]));

  return {
    moldes: moldes
      .sort((a, b) => (ORDEM.get(a.nivel) ?? 99) - (ORDEM.get(b.nivel) ?? 99))
      .map((m) => ({
        id: m.id,
        nivel: nivelDoMolde(m.nivel),
        nome: m.nome,
        temas: temasSchema.catch([]).parse(m.temas),
        numeroSituacoes: m.numeroSituacoes,
        tempoLimiteS: m.tempoLimiteS,
        ativo: m.ativo,
        cargoIds: m.cargos.map((c) => c.jobFunctionId).sort(),
        testesEmAndamento: testes.get(m.id) ?? 0
      })),
    cargos: cargos.map((c) => ({
      id: c.id,
      nome: c.name,
      moldeNivel: c.labMolde ? nivelDoMolde(c.labMolde.molde.nivel) : null
    }))
  };
}

export class ConfigDosMoldes {
  constructor(private readonly db: PrismaClient) {}

  async ler(ator: LabAtor): Promise<LabConfigDosMoldes> {
    assertAcesso(ator, "config-moldes:ler");
    return lerConfiguracao(this.db);
  }

  /** Aplica o estado desejado do molde do nível dado. Tudo ou nada. */
  async atualizar(
    user: AuthenticatedUser,
    ator: LabAtor,
    nivel: string,
    entrada: LabAtualizarMoldeEntrada
  ): Promise<LabConfigDosMoldes> {
    assertAcesso(ator, "config-moldes:atualizar");
    if (!(labMoldeNiveis as readonly string[]).includes(nivel))
      throw errosDoCadastro.naoEncontrado();

    // Falha antes de abrir a transação: o banco recusaria do mesmo jeito (CHECK), mas com um
    // erro técnico.
    if (entrada.ativo && entrada.tempoLimiteS === null) throw errosDoCadastro.moldeSemTempo();
    const cargoIds = [...new Set(entrada.cargoIds)];

    await this.db.$transaction(async (tx) => {
      // Trava a linha do molde: uma sessão nova referencia o molde (chave estrangeira) e espera
      // esta transação terminar, então nenhum teste começa no meio da troca.
      const [travado] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM leadership_lab.molde WHERE nivel = ${nivel} FOR UPDATE`;
      if (!travado) throw errosDoCadastro.naoEncontrado();
      const antes = await tx.labMolde.findUniqueOrThrow({
        where: { id: travado.id },
        include: { cargos: { select: { jobFunctionId: true } } }
      });

      if (entrada.tempoLimiteS !== antes.tempoLimiteS) {
        const testes = await tx.labSessao.count({
          where: { moldeId: antes.id, status: "em_andamento" }
        });
        if (testes > 0) throw errosDoCadastro.moldeComTestesEmAndamento(testes);
      }

      const existentes = await tx.jobFunction.findMany({
        where: { id: { in: cargoIds }, status: "ACTIVE" },
        select: { id: true, name: true, labMolde: { select: { moldeId: true } } }
      });
      if (existentes.length !== cargoIds.length) throw errosDoCadastro.cargoInexistente();
      const emOutro = existentes.filter(
        (c) => c.labMolde !== null && c.labMolde.moldeId !== antes.id
      );
      if (emOutro.length > 0) {
        throw errosDoCadastro.cargoEmOutroMolde(emOutro.map((c) => c.name).sort());
      }

      await tx.labMoldeCargo.deleteMany({
        where: { moldeId: antes.id, jobFunctionId: { notIn: cargoIds } }
      });
      await tx.labMoldeCargo.createMany({
        data: cargoIds.map((jobFunctionId) => ({
          jobFunctionId,
          moldeId: antes.id,
          criadoPor: user.id
        })),
        skipDuplicates: true
      });
      const depois = await tx.labMolde.update({
        where: { id: antes.id },
        data: {
          tempoLimiteS: entrada.tempoLimiteS,
          ativo: entrada.ativo,
          atualizadoPor: user.id
        }
      });

      await registrarAuditoria(tx, user, {
        acao: "UPDATE",
        entidade: "LabMolde",
        entidadeId: antes.id,
        antes: {
          nivel,
          tempoLimiteS: antes.tempoLimiteS,
          ativo: antes.ativo,
          cargoIds: antes.cargos.map((c) => c.jobFunctionId).sort()
        },
        depois: {
          nivel,
          tempoLimiteS: depois.tempoLimiteS,
          ativo: depois.ativo,
          cargoIds: [...cargoIds].sort()
        }
      });
    });

    return lerConfiguracao(this.db);
  }
}
