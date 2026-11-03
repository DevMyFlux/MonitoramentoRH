// Leadership Lab — valores fechados do módulo.
//
// Fonte única no código para o que o banco restringe com CHECK
// (apps/api/prisma/migrations/0015_leadership_lab). Um teste de integração confere
// que as duas listas dizem a mesma coisa; se mudar uma, mude a outra.

export const labSkillTipos = ["hard", "soft"] as const;
export type LabSkillTipo = (typeof labSkillTipos)[number];

/** As 8 skills do piloto (4 hard e 4 soft). O id é um slug estável. */
export const labSkillsPiloto = [
  { id: "aplicacao-nr-pop", nome: "Aplicação de NR e POP", tipo: "hard" },
  { id: "gestao-os", nome: "Gestão de OS e prioridades", tipo: "hard" },
  { id: "contingencia", nome: "Plano de contingência", tipo: "hard" },
  { id: "materiais-custos", nome: "Gestão de materiais e custos", tipo: "hard" },
  { id: "comunicacao-cliente", nome: "Comunicação com o cliente", tipo: "soft" },
  { id: "gestao-equipe", nome: "Gestão de equipe e conflitos", tipo: "soft" },
  { id: "decisao-pressao", nome: "Decisão sob pressão", tipo: "soft" },
  { id: "delegacao", nome: "Delegação e desenvolvimento do time", tipo: "soft" }
] as const satisfies ReadonlyArray<{ id: string; nome: string; tipo: LabSkillTipo }>;
export type LabSkillId = (typeof labSkillsPiloto)[number]["id"];

export const labMoldeNiveis = ["encarregado", "supervisor", "coordenador"] as const;
export type LabMoldeNivel = (typeof labMoldeNiveis)[number];

/** Moldes do piloto. Entram inativos e sem tempo: o tempo por situação é decisão de negócio. */
export const labMoldesPiloto = [
  {
    nivel: "encarregado",
    nome: "Encarregado",
    temas: ["Execução no turno", "EPI", "Ferramentas", "Distribuição de tarefas"]
  },
  {
    nivel: "supervisor",
    nome: "Supervisor",
    temas: [
      "Prioridade de OS",
      "Falta de material",
      "Comunicação com o solicitante",
      "Conflito na equipe"
    ]
  },
  {
    nivel: "coordenador",
    nome: "Coordenador",
    temas: [
      "Contrato e SLA",
      "Cliente insatisfeito",
      "Indicadores",
      "Desempenho de supervisores",
      "Custos"
    ]
  }
] as const satisfies ReadonlyArray<{
  nivel: LabMoldeNivel;
  nome: string;
  temas: readonly string[];
}>;

/** Estilos da Liderança Situacional (Hersey e Blanchard). */
export const labEstilos = ["direcao", "orientacao", "apoio", "delegacao"] as const;
export type LabEstilo = (typeof labEstilos)[number];

/** Escala fixa de aderência. 0 só existe para tempo esgotado. */
export const labAderenciaEscala = [100, 70, 40, 10, 0] as const;
export type LabAderencia = (typeof labAderenciaEscala)[number];

export const labEscolhas = ["A", "B", "C"] as const;
export type LabEscolha = (typeof labEscolhas)[number];

/** No piloto só existe o modo dinâmico; "validado" entra na versão 1. */
export const labModos = ["dinamico"] as const;
export type LabModo = (typeof labModos)[number];

export const labSessaoStatus = ["em_andamento", "concluida", "cancelada"] as const;
export type LabSessaoStatus = (typeof labSessaoStatus)[number];

export const labDecisoesGuarda = ["seguir", "mascarar", "bloquear"] as const;
export type LabDecisaoGuarda = (typeof labDecisoesGuarda)[number];

export const labFlexibilidades = ["alta", "media", "baixa"] as const;
export type LabFlexibilidade = (typeof labFlexibilidades)[number];

export const labStatusValidacao = ["aguardando_validacao", "validado", "ajustado"] as const;
export type LabStatusValidacao = (typeof labStatusValidacao)[number];

export const labAlertaCores = ["vermelho", "amarelo"] as const;
export type LabAlertaCor = (typeof labAlertaCores)[number];

export const labAlertaStatus = ["aberto", "encerrado"] as const;
export type LabAlertaStatus = (typeof labAlertaStatus)[number];

export const labContribuicaoStatus = ["pendente", "aprovada", "rejeitada"] as const;
export type LabContribuicaoStatus = (typeof labContribuicaoStatus)[number];

export const labContestacaoStatus = ["pendente", "aceita", "rejeitada"] as const;
export type LabContestacaoStatus = (typeof labContestacaoStatus)[number];

/** Permissões por usuário, além do perfil (DEV, ADMIN, RH, COMUM). */
export const labPermissoes = ["lab_gestao", "lab_especialista"] as const;
export type LabPermissao = (typeof labPermissoes)[number];

export const labAgentesIa = ["agente_lab", "guarda", "autor", "analista", "agente_forms"] as const;
export type LabAgenteIa = (typeof labAgentesIa)[number];

/**
 * Versão do termo de ciência exibido no primeiro acesso. O texto do termo ainda não foi
 * definido; este valor é um marcador. Trocá-lo exige novo aceite de todos os participantes.
 */
export const labTermoVersaoAtual = "2026-1";
