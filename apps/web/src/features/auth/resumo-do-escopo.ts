// O que o cabeçalho mostra sobre quem está logado: o perfil e o alcance dos dados (escopo). Só
// orientação para a pessoa; quem decide o que ela vê é a API (canAccessScope).
import type { AuthenticatedUser, Role } from "@my-flux/types";

const nomeDoPerfil: Record<Role, string> = {
  DEV: "Dev",
  ADMIN: "Admin",
  RH: "RH",
  COMUM: "Colaborador"
};

function contagem(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`;
}

export function resumoDoEscopo(usuario: Pick<AuthenticatedUser, "role" | "scopes">): {
  perfil: string;
  alcance: string;
} {
  const perfil = nomeDoPerfil[usuario.role] ?? usuario.role;
  if (usuario.role === "DEV") return { perfil, alcance: "acesso total" };
  if (usuario.scopes.some((escopo) => escopo.isGlobal)) return { perfil, alcance: "global" };

  const distintos = (chave: "companyId" | "unitId" | "operationId") =>
    new Set(usuario.scopes.map((escopo) => escopo[chave]).filter(Boolean)).size;
  const partes = [
    [distintos("companyId"), "empresa", "empresas"],
    [distintos("unitId"), "unidade", "unidades"],
    [distintos("operationId"), "operação", "operações"]
  ] as const;
  const alcance = partes
    .filter(([total]) => total > 0)
    .map(([total, singular, plural]) => contagem(total, singular, plural))
    .join(", ");
  return { perfil, alcance: alcance || "sem escopo" };
}
