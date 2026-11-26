// Treinamentos — a configuração do teste do Lab: a regra nível + área -> público e a quantidade de
// cenários de cada público (e de cada turma). ADMIN e DEV editam; o RH (e o DEV) só leem. Cada
// mudança grava a tabela anterior e a nova no AuditLog, na mesma transação.
//
// Salvar SUBSTITUI a tabela inteira (é o que o editor da tela faz): a lista que chega é a verdade.
import {
  type TreinoPublico,
  LAB_CENARIOS_POR_TESTE_PADRAO,
  perfilPermite,
  type TreinoAtor
} from "@my-flux/shared";
import { Prisma, type PrismaClient, type RoleName } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";

type Db = PrismaClient;

export type RegraDaConfiguracao = {
  nivelGovernanca: "assistente" | "supervisor" | "coordenador" | "diretoria" | null;
  areaId: string | null;
  publico: TreinoPublico;
  ativa: boolean;
};

export type ItemDeQuantidade = {
  publico: TreinoPublico;
  turmaId: string | null;
  quantidade: number;
};

const json = (valor: unknown) => valor as Prisma.InputJsonValue;

export class ConfiguracaoDosTreinamentos {
  constructor(
    private readonly db: Db,
    private readonly agora: () => Date = () => new Date(),
    /** Quantos cenários compõem o teste quando nada foi configurado (LAB_TESTE_CENARIOS). */
    private readonly quantidadePadrao: number = LAB_CENARIOS_POR_TESTE_PADRAO
  ) {}

  private exigirLeitura(ator: TreinoAtor): void {
    if (!perfilPermite(ator, "administrador") && !perfilPermite(ator, "curador"))
      throw new HttpError(403, "TREINO_FORBIDDEN", "Seu perfil não tem permissão para esta ação.");
  }

  private exigirEdicao(ator: TreinoAtor): void {
    if (!perfilPermite(ator, "administrador"))
      throw new HttpError(403, "TREINO_FORBIDDEN", "Seu perfil não tem permissão para esta ação.");
  }

  private async auditar(
    tx: Prisma.TransactionClient,
    ator: TreinoAtor,
    entity: string,
    before: unknown,
    after: unknown
  ) {
    await tx.auditLog.create({
      data: {
        userId: ator.userId,
        userRole: ator.role as RoleName,
        action: "UPDATE",
        entity,
        entityId: entity,
        before: json(before),
        after: json(after),
        origin: "api"
      }
    });
  }

  // -------------------------------------------------------------------------
  // Regra de público
  // -------------------------------------------------------------------------

  async lerRegras(ator: TreinoAtor) {
    this.exigirLeitura(ator);
    const [regras, areas] = await Promise.all([
      this.db.treinoRegraPublico.findMany({ orderBy: [{ criadoEm: "asc" }, { id: "asc" }] }),
      this.db.area.findMany({
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, ativa: true }
      })
    ]);
    return {
      regras: regras.map((r) => ({
        nivelGovernanca: r.nivel as RegraDaConfiguracao["nivelGovernanca"],
        areaId: r.areaId,
        publico: r.publico as TreinoPublico,
        ativa: r.ativa
      })),
      areas
    };
  }

  async salvarRegras(ator: TreinoAtor, regras: readonly RegraDaConfiguracao[]) {
    this.exigirEdicao(ator);
    const areaIds = [...new Set(regras.flatMap((r) => (r.areaId ? [r.areaId] : [])))];
    const existentes = await this.db.area.findMany({
      where: { id: { in: areaIds } },
      select: { id: true }
    });
    const faltando = areaIds.filter((id) => !existentes.some((a) => a.id === id));
    if (faltando.length)
      throw new HttpError(400, "TREINO_AREA_INEXISTENTE", "Há regra com uma área que não existe.", {
        areaIds: faltando
      });
    return this.db.$transaction(async (tx) => {
      const antes = await tx.treinoRegraPublico.findMany({ orderBy: { criadoEm: "asc" } });
      const agora = this.agora();
      await tx.treinoRegraPublico.deleteMany({});
      // A ordem da lista é a de desempate: cada regra nasce um milissegundo depois da anterior.
      for (const [i, r] of regras.entries())
        await tx.treinoRegraPublico.create({
          data: {
            nivel: r.nivelGovernanca,
            areaId: r.areaId,
            publico: r.publico,
            ativa: r.ativa,
            criadoEm: new Date(agora.getTime() + i),
            alteradoEm: agora,
            alteradoPor: ator.userId
          }
        });
      await this.auditar(
        tx,
        ator,
        "treinamentos.regra_publico",
        antes.map((r) => ({
          nivel: r.nivel,
          areaId: r.areaId,
          publico: r.publico,
          ativa: r.ativa
        })),
        regras
      );
      return { salvas: regras.length };
    });
  }

  // -------------------------------------------------------------------------
  // Quantidade de cenários
  // -------------------------------------------------------------------------

  async lerQuantidades(ator: TreinoAtor) {
    this.exigirLeitura(ator);
    const itens = await this.db.treinoTesteConfig.findMany({
      orderBy: [{ publico: "asc" }, { turmaId: "asc" }],
      include: { turma: { select: { nome: true } } }
    });
    return {
      padrao: this.quantidadePadrao,
      itens: itens.map((i) => ({
        publico: i.publico as TreinoPublico,
        turmaId: i.turmaId,
        turma: i.turma?.nome ?? null,
        quantidade: i.quantidade
      }))
    };
  }

  async salvarQuantidades(ator: TreinoAtor, itens: readonly ItemDeQuantidade[]) {
    this.exigirEdicao(ator);
    const turmaIds = [...new Set(itens.flatMap((i) => (i.turmaId ? [i.turmaId] : [])))];
    const turmas = await this.db.labTurma.findMany({
      where: { id: { in: turmaIds } },
      select: { id: true }
    });
    const faltando = turmaIds.filter((id) => !turmas.some((t) => t.id === id));
    if (faltando.length)
      throw new HttpError(
        400,
        "TREINO_TURMA_INEXISTENTE",
        "Há quantidade com uma turma que não existe.",
        {
          turmaIds: faltando
        }
      );
    return this.db.$transaction(async (tx) => {
      const antes = await tx.treinoTesteConfig.findMany();
      const agora = this.agora();
      await tx.treinoTesteConfig.deleteMany({});
      for (const i of itens)
        await tx.treinoTesteConfig.create({
          data: {
            publico: i.publico,
            turmaId: i.turmaId,
            quantidade: i.quantidade,
            alteradoEm: agora,
            alteradoPor: ator.userId
          }
        });
      await this.auditar(
        tx,
        ator,
        "treinamentos.teste_config",
        antes.map((c) => ({ publico: c.publico, turmaId: c.turmaId, quantidade: c.quantidade })),
        itens
      );
      return { salvas: itens.length };
    });
  }
}
