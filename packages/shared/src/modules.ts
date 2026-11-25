// Registro único dos módulos do MY FLUX: o que cada um é, se está ativo ou oculto, e por onde se
// chega a ele (rotas da web e prefixos da API). É a fonte da verdade de "este módulo existe para
// quem?": a API (trava de rota) e a interface (menu, roteador, busca) leem daqui, e as decisões de
// acesso (acessos.ts) também.
//
// Status:
//  - "active": existe para quem o perfil permite.
//  - "hidden": INACESSÍVEL PARA TODOS (inclusive DEV): fora do menu, das rotas web e da API
//    (404 igual ao de rota inexistente). O código segue no repositório e compilando; religar é trocar
//    uma linha aqui (veja docs/modulos-ocultos.md, a ser escrito na Fase 9).
//
// `apiPrefixos` lista só os prefixos EXCLUSIVOS do módulo. Módulos de cadastro (Operações, Funções,
// Parâmetros, Eventos, Documentos...) não têm prefixo próprio: os endpoints deles alimentam as telas
// ativas (Colaboradores e Escalas chamam /operations, /functions, /parameters, /event-types,
// /documents e /calendar), então esconder o módulo é esconder a TELA, nunca o endpoint compartilhado.
//
// ATENÇÃO (decisão pendente com o negócio): hoje só QLP e Recrutamento estão marcados como ocultos.
// Os demais itens que o menu esconde (`hidden: true` em nav-items.ts) seguem "active" aqui, ou seja,
// continuam abrindo por URL como antes, até a lista final de módulos ocultos ser confirmada.

export type StatusDoModulo = "active" | "hidden";

export type ModuloDef = {
  id: string;
  rotulo: string;
  status: StatusDoModulo;
  /** O perfil COMUM enxerga este módulo? Só o Leadership Lab (e, transitoriamente, Treinamentos). */
  comumPode: boolean;
  /** Prefixos das rotas da web (React Router) deste módulo. */
  rotasWeb: readonly string[];
  /** Prefixos EXCLUSIVOS da API (sem /api/v1). Vazio = endpoints compartilhados com telas ativas. */
  apiPrefixos: readonly string[];
};

function modulo(
  id: string,
  rotulo: string,
  rotasWeb: readonly string[],
  opcoes: { status?: StatusDoModulo; comumPode?: boolean; apiPrefixos?: readonly string[] } = {}
): ModuloDef {
  return {
    id,
    rotulo,
    status: opcoes.status ?? "active",
    comumPode: opcoes.comumPode ?? false,
    rotasWeb,
    apiPrefixos: opcoes.apiPrefixos ?? []
  };
}

const lista: readonly ModuloDef[] = [
  // --- Leadership Lab: o único módulo do COMUM ---
  modulo("lab", "Leadership Lab", ["/lab"], { comumPode: true, apiPrefixos: ["/leadership-lab"] }),
  // TRANSITÓRIO: o módulo Treinamentos independente some quando os cenários entrarem no teste do Lab
  // (Fase 6 do Prompt 2); aí `comumPode` passa a false e as rotas são redirecionadas.
  modulo("treinamentos", "Treinamentos", ["/treinamentos"], {
    comumPode: true,
    apiPrefixos: ["/treinamentos"]
  }),

  // --- Operação ---
  modulo("colaboradores", "Colaboradores", ["/colaboradores"], { apiPrefixos: ["/employees"] }),
  modulo("escalas", "Escalas", ["/escalas"], {
    apiPrefixos: ["/schedules", "/employee-schedules", "/schedule-day-overrides"]
  }),

  // --- Ocultos (confirmado: QLP; Recrutamento depende dele) ---
  modulo("qlp", "QLP", ["/qlp"], { status: "hidden", apiPrefixos: ["/qlp", "/positions"] }),
  modulo("recrutamento", "Recrutamento", ["/recrutamento"], {
    status: "hidden",
    apiPrefixos: ["/recruitment"]
  }),

  // --- Gestão (telas próprias) ---
  modulo("dashboard", "Dashboard", ["/dashboard"], { apiPrefixos: ["/dashboard"] }),
  modulo("usuarios", "Usuários", ["/usuarios"], { apiPrefixos: ["/users"] }),
  modulo("auditoria", "Auditoria", ["/auditoria"], { apiPrefixos: ["/audit"] }),
  modulo("importacoes", "Importações", ["/importacoes"], { apiPrefixos: ["/imports"] }),

  // --- Cadastros (página genérica; endpoints compartilhados, sem prefixo exclusivo) ---
  modulo("empresas", "Empresas", ["/empresas"]),
  modulo("clientes", "Clientes", ["/clientes"]),
  modulo("contratos", "Contratos", ["/contratos"]),
  modulo("unidades", "Unidades", ["/unidades"]),
  modulo("operacoes", "Operações", ["/operacoes"]),
  modulo("servicos", "Serviços", ["/servicos"]),
  modulo("obrigacoes", "Obrigações", ["/obrigacoes"]),
  modulo("funcoes", "Funções", ["/funcoes"]),
  modulo("requisitos", "Requisitos", ["/requisitos"]),
  modulo("documentos", "Documentos", ["/documentos"]),
  modulo("competencias", "Competências", ["/competencias"]),
  modulo("matriz", "Matriz", ["/matriz"]),
  modulo("criterios", "Critérios", ["/criterios"]),
  modulo("avaliacoes", "Avaliações", ["/avaliacoes"]),
  modulo("eventos", "Eventos", ["/eventos"]),
  modulo("tipos", "Tipos de evento", ["/tipos"]),
  modulo("planos", "Planos de desenvolvimento", ["/planos"]),
  modulo("parametros", "Parâmetros", ["/parametros"])
];

export const MODULOS: Readonly<Record<string, ModuloDef>> = Object.fromEntries(
  lista.map((m) => [m.id, m])
);

export const idsDosModulos: readonly string[] = lista.map((m) => m.id);

export function moduloPorId(id: string, registro: Readonly<Record<string, ModuloDef>> = MODULOS) {
  return registro[id];
}

/** Os módulos ocultos hoje (para as telas, os testes e a documentação). */
export function modulosOcultos(
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): ModuloDef[] {
  return Object.values(registro).filter((m) => m.status === "hidden");
}

function comecaCom(caminho: string, prefixo: string): boolean {
  return caminho === prefixo || caminho.startsWith(`${prefixo}/`);
}

/** O módulo dono de uma rota da API (caminho SEM /api/v1), pelos prefixos exclusivos. */
export function moduloDaRotaApi(
  caminho: string,
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): ModuloDef | undefined {
  return Object.values(registro).find((m) => m.apiPrefixos.some((p) => comecaCom(caminho, p)));
}

/** O módulo dono de uma rota da web (React Router). */
export function moduloDaRotaWeb(
  caminho: string,
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): ModuloDef | undefined {
  return Object.values(registro).find((m) => m.rotasWeb.some((p) => comecaCom(caminho, p)));
}

/** Rotas da API que não pertencem a módulo nenhum e valem para qualquer pessoa autenticada. */
const PREFIXOS_GLOBAIS_DA_API = ["/auth", "/health", "/suporte"] as const;

/**
 * O perfil COMUM pode chamar esta rota da API (caminho SEM /api/v1)? Só o que é global (login,
 * sessão, saúde, assistente) e os módulos que o COMUM enxerga. Todo o resto é negado por padrão: o
 * menu esconder um módulo nunca foi proteção, quem protege é esta regra, no servidor.
 */
export function rotaDaApiPermitidaAoComum(
  caminho: string,
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): boolean {
  if (PREFIXOS_GLOBAIS_DA_API.some((p) => comecaCom(caminho, p))) return true;
  return Object.values(registro).some(
    (m) => m.comumPode && m.apiPrefixos.some((p) => comecaCom(caminho, p))
  );
}
