// Leadership Lab — aplicação da matriz de permissões nas rotas.
//
// A decisão vem de packages/shared (avaliarAcesso). Aqui ela vira resposta HTTP:
//   - 403 quando o PERFIL não pode a ação (ou o usuário não está vinculado a um colaborador);
//   - 404 quando o recurso é de outra pessoa ou de fora das turmas do curador. Responder 404 e
//     não 403 evita revelar que a sessão ou o resultado de um colega existe.
//
// Uso em uma rota (sempre depois de carregar o recurso, e com a MESMA mensagem de 404 para
// "não existe" e "não é seu"):
//
//   const ator = await carregarAtorLab(prisma, user);
//   const sessao = await repo.buscar(id);            // 404 se não existir
//   assertAcesso(ator, "sessao:responder", { participanteId: sessao.participanteId });
import { type AlvoLab, type LabAcao, type LabAtor, avaliarAcesso } from "@my-flux/shared";
import { HttpError } from "../../lib/http-error.js";

export const LAB_NAO_ENCONTRADO = {
  code: "LAB_NOT_FOUND",
  message: "Registro não encontrado."
} as const;

/** Lança HttpError se `ator` não puder executar `acao` sobre `alvo`. */
export function assertAcesso(ator: LabAtor, acao: LabAcao, alvo: AlvoLab = {}): void {
  const decisao = avaliarAcesso(ator, acao, alvo);
  if (decisao.permitido) return;

  switch (decisao.motivo) {
    case "perfil":
      throw new HttpError(
        403,
        "LAB_FORBIDDEN",
        "Seu perfil não tem permissão para esta ação do Leadership Lab."
      );
    case "sem-vinculo":
      throw new HttpError(
        403,
        "LAB_SEM_VINCULO",
        "Seu usuário ainda não está vinculado a um colaborador no Leadership Lab. Procure o RH."
      );
    case "alheio":
    case "fora-da-turma":
      throw new HttpError(404, LAB_NAO_ENCONTRADO.code, LAB_NAO_ENCONTRADO.message);
    default: {
      // Se o tipo MotivoNegacao ganhar um valor novo, isto deixa de compilar.
      const nunca: never = decisao.motivo;
      throw new Error(`Motivo de negação não tratado: ${String(nunca)}`);
    }
  }
}
