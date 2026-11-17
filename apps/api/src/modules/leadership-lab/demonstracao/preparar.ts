// Leadership Lab — prepara o participante de demonstração.
//
// Chamado na subida do servidor, só no modo demonstração. Deixa tudo pronto para o participante
// de demonstração (a conta COMUM do seed) fazer um teste inteiro, sem ninguém mexer no banco:
//   1. o molde "supervisor" liberado (com tempo por situação, se ainda não tinha);
//   2. uma operação fictícia SÓ da demonstração (com empresa, cliente e unidade): o colaborador
//      fictício precisa de uma operação, e colocá-lo numa operação real o poria nas listas e nas
//      escalas de gente de verdade;
//   3. um cargo fictício, ligado a esse molde, e um colaborador fictício nesse cargo, nessa operação;
//   4. o participante: a conta COMUM ligada a esse colaborador.
//
// Seguro e repetível: cada passo só cria o que falta, nunca altera dado real, e uma conta que já
// está ligada a outro colaborador é respeitada. Se algo faltar (a conta não existe, não é COMUM),
// não faz nada e diz por quê; nunca derruba o servidor.
import type { Prisma, PrismaClient } from "@prisma/client";

export const EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO = "comum@myflux.local";
/** A conta de administração que, no modo demonstração, também enxerga os agregados e a área de especialista. */
export const EMAIL_DO_ADMIN_DE_DEMONSTRACAO = "dev@myflux.local";
export const PERMISSOES_DO_ADMIN_DE_DEMONSTRACAO = ["lab_gestao", "lab_especialista"] as const;
export const IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO = "DEMO-LAB";
export const NOME_DO_COLABORADOR_DE_DEMONSTRACAO = "Participante de demonstração";
export const NOME_DO_CARGO_DE_DEMONSTRACAO = "Supervisor (demonstração)";
/** Tempo por situação da demonstração, só quando o molde ainda não tem um tempo definido. */
export const TEMPO_DA_DEMONSTRACAO_S = 90;
export const NOME_DA_OPERACAO_DE_DEMONSTRACAO = "Demonstração do Leadership Lab";
const NOME_DA_EMPRESA_DE_DEMONSTRACAO = "Demonstração (Leadership Lab)";
/**
 * Chave do advisory lock do PostgreSQL que serializa o preparo entre instâncias. Várias instâncias
 * do servidor (Cloud Run) sobem ao mesmo tempo, e sem isto duas criariam o cargo fictício juntas
 * (ele não tem restrição de unicidade) ou colidiriam no mapeamento cargo -> molde.
 */
const CHAVE_DO_LOCK_DA_DEMONSTRACAO = 7_240_117;
const NOTA_DO_REGISTRO_FICTICIO =
  "Registro fictício criado pelo modo demonstração do Leadership Lab. Pode ser arquivado.";

export type LoggerDaDemonstracao = { info(mensagem: string): void; warn(mensagem: string): void };

export type ResultadoDaPreparacao = { preparado: true } | { preparado: false; motivo: string };

const naoPreparado = (motivo: string): ResultadoDaPreparacao => ({ preparado: false, motivo });

export async function prepararDemonstracao(
  db: PrismaClient,
  logger?: LoggerDaDemonstracao
): Promise<ResultadoDaPreparacao> {
  // Tudo numa transação que começa pegando o lock: quem chega depois espera e já encontra pronto o
  // que o primeiro criou. O lock se solta sozinho ao terminar (ou se a conexão cair).
  const resultado = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAVE_DO_LOCK_DA_DEMONSTRACAO}::bigint)`;
      await concederPermissoesAoAdmin(tx);
      const preparo = await preparar(tx);
      if (preparo.preparado) await prepararParticipanteDoAdmin(tx);
      return preparo;
    },
    { timeout: 30_000 }
  );
  if (resultado.preparado) {
    logger?.info("Leadership Lab (demonstração): participante de demonstração pronto.");
  } else {
    logger?.warn(`Leadership Lab (demonstração): nada preparado. ${resultado.motivo}`);
  }
  return resultado;
}

/**
 * Acesso total do perfil DEV ao Leadership Lab, com IA real ou de demonstração. Chamado em toda subida
 * do servidor com o Lab ligado. A matriz já dá ao DEV todos os papéis; o que falta para ele usar o
 * módulo inteiro sem trocar de conta é o que vem do BANCO:
 *   - as permissões lab_gestao e lab_especialista;
 *   - um vínculo de participante (colaborador fictício, no cargo fictício ligado ao molde
 *     "supervisor"), para fazer o teste e usar a aprendizagem.
 * Não liga nem altera molde nenhum: com a IA real, liberar o teste continua sendo decisão da
 * configuração. Seguro e repetível, como a demonstração; nunca derruba o servidor.
 */
export async function prepararAcessoTotalDoDev(
  db: PrismaClient,
  logger?: LoggerDaDemonstracao
): Promise<void> {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAVE_DO_LOCK_DA_DEMONSTRACAO}::bigint)`;
      await concederPermissoesAoAdmin(tx);
      const molde = await tx.labMolde.findFirst({ where: { nivel: "supervisor" } });
      if (!molde) {
        logger?.warn(
          'Leadership Lab: sem o molde "supervisor", o DEV fica sem vínculo de participante.'
        );
        return;
      }
      const operacaoId = await garantirOperacaoDeDemonstracao(tx);
      await garantirCargoDeDemonstracao(tx, operacaoId, molde.id);
      await prepararParticipanteDoAdmin(tx);
    },
    { timeout: 30_000 }
  );
  logger?.info(
    "Leadership Lab: perfil DEV com acesso total (participante, curador, gestão e configuração)."
  );
}

/**
 * As contas que recebem o acesso total: a conta de administração do seed e toda conta ATIVA de
 * perfil DEV. Nenhum outro perfil é tocado.
 */
async function contasComAcessoTotal(
  db: Prisma.TransactionClient
): Promise<{ id: string; email: string }[]> {
  return db.user.findMany({
    where: {
      OR: [{ email: EMAIL_DO_ADMIN_DE_DEMONSTRACAO }, { role: { name: "DEV" }, status: "ACTIVE" }]
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" }
  });
}

/**
 * Dá às contas de acesso total as permissões do módulo (lab_gestao e lab_especialista). Só essas duas
 * permissões, só a essas contas: a matriz de papéis não muda. Repetir não faz nada.
 */
async function concederPermissoesAoAdmin(db: Prisma.TransactionClient): Promise<void> {
  for (const conta of await contasComAcessoTotal(db)) {
    for (const permissao of PERMISSOES_DO_ADMIN_DE_DEMONSTRACAO) {
      await db.labPermissaoUsuario.upsert({
        where: { userId_permissao: { userId: conta.id, permissao } },
        update: {},
        create: { userId: conta.id, permissao }
      });
    }
  }
}

/**
 * O perfil DEV também faz o teste: liga cada conta de acesso total a um colaborador fictício próprio,
 * do mesmo cargo de demonstração. Uma conta já ligada a um colaborador é respeitada.
 */
async function prepararParticipanteDoAdmin(db: Prisma.TransactionClient): Promise<void> {
  const operacao = await db.operation.findFirst({
    where: { name: NOME_DA_OPERACAO_DE_DEMONSTRACAO }
  });
  const cargo = operacao
    ? await db.jobFunction.findFirst({
        where: { name: NOME_DO_CARGO_DE_DEMONSTRACAO, operationId: operacao.id }
      })
    : null;
  if (!operacao || !cargo) return;
  for (const conta of await contasComAcessoTotal(db)) {
    if (await db.labParticipante.findUnique({ where: { userId: conta.id } })) continue;
    const daContaDoSeed = conta.email === EMAIL_DO_ADMIN_DE_DEMONSTRACAO;
    const identificador = daContaDoSeed ? "DEMO-LAB-ADMIN" : `DEMO-LAB-DEV-${conta.id.slice(0, 8)}`;
    const colaborador = await db.employee.upsert({
      where: { operationId_identifier: { operationId: operacao.id, identifier: identificador } },
      update: { functionId: cargo.id },
      create: {
        operationId: operacao.id,
        functionId: cargo.id,
        name: daContaDoSeed ? "Administrador de demonstração" : `Conta DEV (${conta.email})`,
        identifier: identificador,
        notes: NOTA_DO_REGISTRO_FICTICIO
      }
    });
    if (await db.labParticipante.findUnique({ where: { employeeId: colaborador.id } })) continue;
    await db.labParticipante.create({ data: { userId: conta.id, employeeId: colaborador.id } });
  }
}

/** O cargo fictício da demonstração, ligado ao molde. Só cria o que falta. */
async function garantirCargoDeDemonstracao(
  db: Prisma.TransactionClient,
  operacaoId: string,
  moldeId: string
): Promise<{ id: string }> {
  const cargo =
    (await db.jobFunction.findFirst({
      where: { name: NOME_DO_CARGO_DE_DEMONSTRACAO, operationId: operacaoId }
    })) ??
    (await db.jobFunction.create({
      data: {
        name: NOME_DO_CARGO_DE_DEMONSTRACAO,
        operationId: operacaoId,
        description: NOTA_DO_REGISTRO_FICTICIO
      }
    }));
  await db.labMoldeCargo.upsert({
    where: { jobFunctionId: cargo.id },
    update: {},
    create: { jobFunctionId: cargo.id, moldeId }
  });
  return cargo;
}

async function preparar(db: Prisma.TransactionClient): Promise<ResultadoDaPreparacao> {
  const usuario = await db.user.findUnique({
    where: { email: EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO },
    include: { role: true }
  });
  if (!usuario) {
    return naoPreparado(
      `A conta ${EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO} não existe (o seed rodou neste banco?).`
    );
  }
  if (usuario.role.name !== "COMUM") {
    return naoPreparado(
      `A conta ${EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO} não é do perfil COMUM, único que faz testes.`
    );
  }

  const molde = await db.labMolde.findFirst({ where: { nivel: "supervisor" } });
  if (!molde)
    return naoPreparado('O molde "supervisor" não existe (as migrações do Lab rodaram?).');

  // 1. Molde liberado. Só preenche o que falta: um tempo já definido pelo negócio é respeitado.
  if (!molde.ativo || molde.tempoLimiteS === null) {
    await db.labMolde.update({
      where: { id: molde.id },
      data: { ativo: true, tempoLimiteS: molde.tempoLimiteS ?? TEMPO_DA_DEMONSTRACAO_S }
    });
  }

  // Uma conta já ligada a um colaborador é respeitada: nada é criado, nada é alterado.
  const existente = await db.labParticipante.findUnique({
    where: { userId: usuario.id },
    include: { employee: { include: { function: { include: { labMolde: true } } } } }
  });
  if (existente) {
    return existente.employee.function?.labMolde
      ? { preparado: true }
      : naoPreparado(
          `A conta ${EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO} já está ligada a um colaborador cujo cargo não tem um teste. Não alterei nada.`
        );
  }

  // 2 a 4. Operação, cargo, colaborador e participante fictícios.
  const operacaoId = await garantirOperacaoDeDemonstracao(db);

  const cargo = await garantirCargoDeDemonstracao(db, operacaoId, molde.id);

  const chaveDoColaborador = {
    operationId_identifier: {
      operationId: operacaoId,
      identifier: IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO
    }
  };
  const colaborador = await db.employee.upsert({
    where: chaveDoColaborador,
    update: { functionId: cargo.id },
    create: {
      operationId: operacaoId,
      functionId: cargo.id,
      name: NOME_DO_COLABORADOR_DE_DEMONSTRACAO,
      identifier: IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO,
      notes: NOTA_DO_REGISTRO_FICTICIO
    }
  });

  await db.labParticipante.create({ data: { userId: usuario.id, employeeId: colaborador.id } });
  return { preparado: true };
}

/**
 * A operação fictícia da demonstração, com a empresa, o cliente e a unidade que ela exige. Nunca
 * reaproveita uma operação real: tudo o que o modo demonstração cria fica em nomes próprios.
 */
async function garantirOperacaoDeDemonstracao(db: Prisma.TransactionClient): Promise<string> {
  const existente = await db.operation.findFirst({
    where: { name: NOME_DA_OPERACAO_DE_DEMONSTRACAO }
  });
  if (existente) return existente.id;

  const nome = NOME_DA_EMPRESA_DE_DEMONSTRACAO;
  const empresa =
    (await db.company.findFirst({ where: { name: nome } })) ??
    (await db.company.create({ data: { name: nome } }));
  const cliente =
    (await db.client.findFirst({ where: { name: nome, companyId: empresa.id } })) ??
    (await db.client.create({ data: { name: nome, companyId: empresa.id } }));
  const unidade =
    (await db.unit.findFirst({ where: { name: nome, companyId: empresa.id } })) ??
    (await db.unit.create({ data: { name: nome, companyId: empresa.id } }));
  const operacao = await db.operation.create({
    data: {
      name: NOME_DA_OPERACAO_DE_DEMONSTRACAO,
      companyId: empresa.id,
      clientId: cliente.id,
      unitId: unidade.id
    }
  });
  return operacao.id;
}
