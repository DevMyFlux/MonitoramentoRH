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
 * Dá à conta de administração as permissões do módulo (lab_gestao e lab_especialista). Só essas duas
 * permissões, só a essa conta, e só se ela existir: a matriz de papéis não muda (o perfil DEV
 * continua administrador e não vira participante nem curador). Repetir não faz nada.
 */
async function concederPermissoesAoAdmin(db: Prisma.TransactionClient): Promise<void> {
  const admin = await db.user.findUnique({ where: { email: EMAIL_DO_ADMIN_DE_DEMONSTRACAO } });
  if (!admin) return;
  for (const permissao of PERMISSOES_DO_ADMIN_DE_DEMONSTRACAO) {
    await db.labPermissaoUsuario.upsert({
      where: { userId_permissao: { userId: admin.id, permissao } },
      update: {},
      create: { userId: admin.id, permissao }
    });
  }
}

/**
 * O perfil DEV também faz o teste: liga a conta de administração a um segundo colaborador fictício
 * do mesmo cargo de demonstração. Nada é alterado se a conta já estiver ligada a um colaborador.
 */
async function prepararParticipanteDoAdmin(db: Prisma.TransactionClient): Promise<void> {
  const admin = await db.user.findUnique({ where: { email: EMAIL_DO_ADMIN_DE_DEMONSTRACAO } });
  if (!admin || (await db.labParticipante.findUnique({ where: { userId: admin.id } }))) return;
  const operacao = await db.operation.findFirst({
    where: { name: NOME_DA_OPERACAO_DE_DEMONSTRACAO }
  });
  const cargo = operacao
    ? await db.jobFunction.findFirst({
        where: { name: NOME_DO_CARGO_DE_DEMONSTRACAO, operationId: operacao.id }
      })
    : null;
  if (!operacao || !cargo) return;
  const colaborador = await db.employee.upsert({
    where: {
      operationId_identifier: { operationId: operacao.id, identifier: "DEMO-LAB-ADMIN" }
    },
    update: { functionId: cargo.id },
    create: {
      operationId: operacao.id,
      functionId: cargo.id,
      name: "Administrador de demonstração",
      identifier: "DEMO-LAB-ADMIN",
      notes: NOTA_DO_REGISTRO_FICTICIO
    }
  });
  await db.labParticipante.create({ data: { userId: admin.id, employeeId: colaborador.id } });
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
    create: { jobFunctionId: cargo.id, moldeId: molde.id }
  });

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
