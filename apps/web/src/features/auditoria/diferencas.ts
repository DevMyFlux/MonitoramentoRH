// Auditoria em linguagem de gente: o nome de cada ação, os registros agrupados por dia e o que
// mudou entre o "antes" e o "depois" de um registro (AuditLog). Funções puras, sem relógio.

export type Mudanca = {
  campo: string;
  tipo: "adicionado" | "removido" | "alterado";
  antes?: string;
  depois?: string;
};

export const rotuloDaAcao: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Alteração",
  ARCHIVE: "Arquivamento",
  RESTORE: "Restauração",
  APPROVE: "Aprovação",
  REJECT: "Reprovação",
  PUBLISH: "Publicação",
  UNPUBLISH: "Despublicação",
  OVERRIDE: "Ajuste manual",
  ROLE_CHANGE: "Troca de perfil",
  PERMISSION_CHANGE: "Troca de permissão",
  USER_INVITE: "Convite de usuário",
  USER_DISABLE: "Desativação de usuário"
};

const PROFUNDIDADE = 3;

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Achata um objeto em caminhos ("contrato.inicio"), até 3 níveis; listas viram um valor só. */
function achatar(valor: unknown, prefixo = "", nivel = 0, saida = new Map<string, string>()) {
  if (ehObjeto(valor) && nivel < PROFUNDIDADE) {
    const chaves = Object.keys(valor);
    if (chaves.length === 0 && prefixo) saida.set(prefixo, "{}");
    for (const chave of chaves) {
      achatar(valor[chave], prefixo ? `${prefixo}.${chave}` : chave, nivel + 1, saida);
    }
    return saida;
  }
  if (valor === undefined) return saida;
  saida.set(prefixo || "(valor)", typeof valor === "string" ? valor : JSON.stringify(valor));
  return saida;
}

/** O que mudou, campo a campo, na ordem em que os campos aparecem. Iguais ficam de fora. */
export function diferencas(antes: unknown, depois: unknown): Mudanca[] {
  const a = achatar(antes ?? undefined);
  const d = achatar(depois ?? undefined);
  const campos = [...new Set([...a.keys(), ...d.keys()])];
  const mudancas: Mudanca[] = [];
  for (const campo of campos) {
    const valorAntes = a.get(campo);
    const valorDepois = d.get(campo);
    if (valorAntes === valorDepois) continue;
    if (valorAntes === undefined) {
      if (valorDepois !== undefined)
        mudancas.push({ campo, tipo: "adicionado", depois: valorDepois });
    } else if (valorDepois === undefined) {
      mudancas.push({ campo, tipo: "removido", antes: valorAntes });
    } else {
      mudancas.push({ campo, tipo: "alterado", antes: valorAntes, depois: valorDepois });
    }
  }
  return mudancas;
}

/**
 * Agrupa registros por dia (na data do fuso informado), mantendo a ordem recebida. O dia vem como
 * "AAAA-MM-DD", para a tela formatar.
 */
export function agruparPorDia<T extends { createdAt: string }>(
  registros: readonly T[],
  fuso = "America/Sao_Paulo"
): { dia: string; registros: T[] }[] {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const grupos: { dia: string; registros: T[] }[] = [];
  for (const registro of registros) {
    const dia = formato.format(new Date(registro.createdAt));
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.registros.push(registro);
    else grupos.push({ dia, registros: [registro] });
  }
  return grupos;
}
