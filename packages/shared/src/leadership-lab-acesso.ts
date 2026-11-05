// Leadership Lab — matriz de permissões.
//
// Pura e sem I/O. O backend a aplica em TODA rota do módulo (apps/api/.../lab-access.ts);
// o front pode consultá-la para montar o menu, mas esconder botão não é segurança.
//
// A matriz NÃO usa a hierarquia DEV > ADMIN > RH > COMUM do restante do sistema. Lá, um
// perfil mais alto herda o que o mais baixo faz. Aqui isso seria uma falha: ADMIN e DEV
// não usam dados de perfil, e quem acompanha pessoas (RH) não é participante. Cada papel
// do Lab recebe exatamente o que a documentação lhe dá, e mais nada.
//
// Como ler: cada ação lista os papéis que podem executá-la e, para cada um, QUE DADOS ele
// alcança (EscopoDados). É o escopo que impede um participante de ler a sessão do colega e
// um curador de ler gente de fora das turmas que acompanha.
import type { LabPermissao } from "./leadership-lab.js";

/** Os perfis do sistema de RH. Mantido igual a roleRank (conferido por teste). */
export type LabPerfil = "DEV" | "ADMIN" | "RH" | "COMUM";

/**
 * Papéis do módulo. Um usuário pode ter mais de um (ex.: RH que também recebeu lab_gestao).
 *
 * - participante: perfil COMUM.
 * - curador: perfil RH.
 * - administrador: perfis ADMIN e DEV.
 * - gestao: permissão lab_gestao (qualquer perfil).
 * - especialista: permissão lab_especialista (qualquer perfil). Versão 1: ainda sem ações.
 *
 * INTERPRETAÇÃO: só o perfil COMUM faz testes. RH, ADMIN e DEV não são participantes: o
 * curador não valida o próprio resultado e quem administra não gera dados de perfil. Se um
 * RH também for líder e precisar fazer o teste, é decisão do negócio.
 */
export type PapelLab = "participante" | "curador" | "administrador" | "gestao" | "especialista";

/**
 * Que dados o papel alcança numa ação:
 * - proprios: só os do próprio participante.
 * - turma: individuais, só de participantes das turmas que o curador acompanha.
 * - escopo-do-rh: só o CADASTRO (nome, matrícula, cargo) de colaboradores das operações do escopo
 *   (UserScope) do RH, para escolher quem será participante. Nenhum resultado de teste.
 * - agregados: somente números agrupados, nunca uma pessoa.
 * - configuracao: parâmetros do módulo (moldes, tempos). Sem dado de pessoa.
 */
export type EscopoDados = "proprios" | "turma" | "escopo-do-rh" | "agregados" | "configuracao";

export type LinhaDaMatriz = Readonly<Partial<Record<PapelLab, EscopoDados>>>;

const matriz = {
  // --- Participante (rotas /painel, /termo, /moldes, /sessoes, /resultados/:id/contestacoes)
  "painel:ler": { participante: "proprios" },
  "termo:ler": { participante: "proprios" },
  "termo:aceitar": { participante: "proprios" },
  "moldes:listar": { participante: "proprios" },
  "sessao:iniciar": { participante: "proprios" },
  "sessao:ler-atual": { participante: "proprios" },
  "sessao:responder": { participante: "proprios" },
  "sessao:tempo-esgotado": { participante: "proprios" },
  "contestacao:criar": { participante: "proprios" },
  "contestacao:ler-proprias": { participante: "proprios" },
  // Simulação local (só no modo demonstração): lista de temas e classificação do texto livre.
  "simulador:ler": { participante: "proprios" },

  // --- Participante e curador (GET /sessoes/:id/resultado)
  "resultado:ler": { participante: "proprios", curador: "turma" },

  // --- Curador (/revisao, /resultados/:id/validacao, /alertas, /contribuicoes, /contestacoes, /turmas)
  "revisao:listar": { curador: "turma" },
  "resultado:validar": { curador: "turma" },
  "alerta:listar": { curador: "turma" },
  "alerta:tratar": { curador: "turma" },
  "contribuicao:listar": { curador: "turma" },
  "contribuicao:decidir": { curador: "turma" },
  "contestacao:listar": { curador: "turma" },
  "contestacao:decidir": { curador: "turma" },
  "turma:listar": { curador: "turma" },
  "turma:criar": { curador: "turma" },
  "turma:atualizar": { curador: "turma" },

  // --- Curador, cadastro (/participantes, /colaboradores-elegiveis, /usuarios-elegiveis): quem será
  // participante. O alvo é o colaborador, e ele tem de estar nas operações do escopo do RH.
  "participante:listar": { curador: "escopo-do-rh" },
  "participante:cadastrar": { curador: "escopo-do-rh" },
  "participante:atualizar": { curador: "escopo-do-rh" },

  // --- Gestão (GET /agregados): só agregados, com mínimo de 5 pessoas por recorte
  "agregados:ler": { gestao: "agregados" },

  // --- Administrador (GET e PUT /config/moldes)
  "config-moldes:ler": { administrador: "configuracao" },
  "config-moldes:atualizar": { administrador: "configuracao" }
} as const satisfies Record<string, LinhaDaMatriz>;

export type LabAcao = keyof typeof matriz;

export const labMatrizAcesso: Readonly<Record<LabAcao, LinhaDaMatriz>> = matriz;
export const labAcoes = Object.keys(matriz) as LabAcao[];

/** Quem está agindo, já com o que o banco sabe sobre ele. */
export type LabAtor = {
  userId: string;
  role: LabPerfil;
  /** Id em leadership_lab.participante; nulo se o usuário não foi vinculado a um colaborador. */
  participanteId: string | null;
  /** Permissões do módulo concedidas ao usuário (leadership_lab.permissao_usuario). */
  permissoes: readonly LabPermissao[];
};

/** O recurso sobre o qual a ação é pedida. Omita em listagens e criações sem alvo. */
export type AlvoLab = {
  /** Dono do recurso (a sessão, o resultado, o alerta...). */
  participanteId?: string | undefined;
  /** Participantes das turmas que o curador acompanha. Sem isto, o escopo "turma" nega. */
  participantesDasTurmas?: ReadonlySet<string> | undefined;
  /**
   * O colaborador alvo está numa operação do escopo (UserScope) do usuário? Quem decide é o backend,
   * com a política de escopo do sistema (a matriz não conhece operações). Omitido, o escopo
   * "escopo-do-rh" permite (listagens: é a consulta que filtra); informado como `false`, nega.
   */
  dentroDoEscopoDoRh?: boolean | undefined;
};

/**
 * Por que o acesso foi negado. O backend responde 403 a "perfil" e "sem-vinculo" e 404 a
 * "alheio", "fora-da-turma" e "fora-do-escopo", para não revelar que o recurso de outra pessoa
 * existe.
 */
export type MotivoNegacao =
  "perfil" | "sem-vinculo" | "alheio" | "fora-da-turma" | "fora-do-escopo";

export type DecisaoDeAcesso = { permitido: true } | { permitido: false; motivo: MotivoNegacao };

export function papeisLab(ator: LabAtor): ReadonlySet<PapelLab> {
  const papeis = new Set<PapelLab>();
  if (ator.role === "COMUM") papeis.add("participante");
  if (ator.role === "RH") papeis.add("curador");
  if (ator.role === "ADMIN" || ator.role === "DEV") papeis.add("administrador");
  if (ator.permissoes.includes("lab_gestao")) papeis.add("gestao");
  if (ator.permissoes.includes("lab_especialista")) papeis.add("especialista");
  return papeis;
}

function avaliarEscopo(
  ator: LabAtor,
  escopo: EscopoDados,
  alvo: AlvoLab
): true | Exclude<MotivoNegacao, "perfil"> {
  switch (escopo) {
    case "proprios":
      if (ator.participanteId === null) return "sem-vinculo";
      if (alvo.participanteId !== undefined && alvo.participanteId !== ator.participanteId) {
        return "alheio";
      }
      return true;
    case "turma":
      // Sem alvo (listar, criar): a consulta é quem filtra pelas turmas do curador.
      if (alvo.participanteId === undefined) return true;
      // Com alvo, falha fechado: sem o conjunto de turmas informado, nega.
      return alvo.participantesDasTurmas?.has(alvo.participanteId) === true
        ? true
        : "fora-da-turma";
    case "escopo-do-rh":
      // Sem alvo (listar, buscar): a consulta filtra pelo escopo. Com alvo, só `true` passa:
      // falha fechado, como a turma.
      if (alvo.dentroDoEscopoDoRh === undefined) return true;
      return alvo.dentroDoEscopoDoRh ? true : "fora-do-escopo";
    case "agregados":
    case "configuracao":
      return true;
  }
}

/**
 * Decide se `ator` pode executar `acao`. Se o ator tem vários papéis que a ação admite,
 * basta um permitir. Ao negar, devolve o motivo do papel que chegou mais perto.
 */
export function avaliarAcesso(ator: LabAtor, acao: LabAcao, alvo: AlvoLab = {}): DecisaoDeAcesso {
  const linha = labMatrizAcesso[acao];
  const papeis = papeisLab(ator);
  const aplicaveis = (Object.keys(linha) as PapelLab[]).filter((papel) => papeis.has(papel));
  if (aplicaveis.length === 0) return { permitido: false, motivo: "perfil" };

  let motivo: MotivoNegacao = "perfil";
  for (const papel of aplicaveis) {
    const escopo = linha[papel];
    if (escopo === undefined) continue;
    const resultado = avaliarEscopo(ator, escopo, alvo);
    if (resultado === true) return { permitido: true };
    motivo = resultado;
  }
  return { permitido: false, motivo };
}

export function podeExecutar(ator: LabAtor, acao: LabAcao, alvo: AlvoLab = {}): boolean {
  return avaliarAcesso(ator, acao, alvo).permitido;
}
