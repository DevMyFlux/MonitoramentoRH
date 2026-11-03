// Leadership Lab — quem está agindo.
//
// Junta o usuário autenticado (JWT -> User, via authenticateRequest) ao que o BANCO sabe
// dele no módulo: se está vinculado a um colaborador (leadership_lab.participante) e quais
// permissões do Lab recebeu (leadership_lab.permissao_usuario). Nada disso vem do token:
// vínculo e permissão mudam sem que o usuário precise entrar de novo.
import { type LabAtor, type LabPermissao, labPermissoes } from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const permissoesConhecidas: readonly string[] = labPermissoes;

function ehPermissaoDoLab(valor: string): valor is LabPermissao {
  return permissoesConhecidas.includes(valor);
}

/**
 * Monta o ator da requisição. Um vínculo desativado vale como ausência de vínculo.
 * Permissão desconhecida é ignorada (o banco já a recusa por CHECK; isto é só defesa).
 */
export async function carregarAtorLab(db: Db, user: AuthenticatedUser): Promise<LabAtor> {
  const [participante, permissoes] = await Promise.all([
    db.labParticipante.findUnique({
      where: { userId: user.id },
      select: { id: true, ativo: true }
    }),
    db.labPermissaoUsuario.findMany({
      where: { userId: user.id },
      select: { permissao: true }
    })
  ]);

  return {
    userId: user.id,
    role: user.role,
    participanteId: participante?.ativo ? participante.id : null,
    permissoes: permissoes.map((p) => p.permissao).filter(ehPermissaoDoLab)
  };
}

/**
 * Participantes das turmas ATIVAS que o curador acompanha. É o `participantesDasTurmas`
 * que o escopo "turma" da matriz exige; sem ele, o acesso a um participante específico
 * é negado.
 */
export async function carregarParticipantesDasTurmas(
  db: Db,
  curadorUserId: string
): Promise<ReadonlySet<string>> {
  const linhas = await db.labTurmaParticipante.findMany({
    where: { turma: { curadorId: curadorUserId, ativa: true } },
    select: { participanteId: true }
  });
  return new Set(linhas.map((l) => l.participanteId));
}
