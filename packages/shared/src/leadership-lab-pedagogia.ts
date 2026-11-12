// Leadership Lab — o enquadramento pedagógico: o que se espera de cada cargo, quanto de
// conhecimento técnico se cobra e a rubrica versionada que orienta a avaliação.
//
// Fonte única, no backend e no front. O backend manda à IA só o que é necessário de cada bloco; a IA
// NÃO altera nada daqui. Os textos abaixo são rascunhos de trabalho a validar com o RH e com a
// área técnica: enquanto `labRubrica.validada` for falso, nenhuma situação produz resultado
// oficial (ela é "experimental"; veja `fundamentacaoFinal`).
import type { LabMoldeNivel, LabSkillId } from "./leadership-lab.js";

/** Dificuldade de uma situação, progressiva: 1 base, 2 intermediária, 3 desafiadora. */
export const labDificuldades = [1, 2, 3] as const;
export type LabDificuldade = (typeof labDificuldades)[number];

/**
 * Quanto de conhecimento técnico de manutenção se cobra numa skill técnica:
 * - `nenhuma`: não se cobra;
 * - `nocao`: saber o que exigir, a quem acionar e o que acompanhar, sem diagnosticar nem executar;
 * - `aplicacao`: aplicar o procedimento correto no nível de responsabilidade do cargo.
 */
export const labProfundidadesTecnicas = ["nenhuma", "nocao", "aplicacao"] as const;
export type LabProfundidadeTecnica = (typeof labProfundidadesTecnicas)[number];

export type LabEnquadramento = {
  /** O que o cargo faz, nas palavras que a IA deve usar para contextualizar as situações. */
  responsabilidades: readonly string[];
  /** Skills prioritárias do cargo, da mais para a menos central. */
  foco: readonly LabSkillId[];
  /** Profundidade técnica cobrada em cada skill técnica (as de comportamento valem para todos). */
  profundidadeTecnica: Readonly<Partial<Record<LabSkillId, LabProfundidadeTecnica>>>;
  /** O que NÃO se cobra deste cargo, e o que se cobra no lugar. */
  limiteTecnico: string;
};

/** As skills de comportamento fazem parte do desenvolvimento de todos os cargos. */
export const labSkillsTransversais = [
  "comunicacao-cliente",
  "gestao-equipe",
  "decisao-pressao",
  "delegacao"
] as const satisfies readonly LabSkillId[];

export const labEnquadramentoPorMolde: Record<LabMoldeNivel, LabEnquadramento> = {
  encarregado: {
    responsabilidades: [
      "Organizar a execução do trabalho no turno",
      "Distribuir atividades entre os técnicos",
      "Garantir ferramentas e materiais disponíveis",
      "Zelar pela segurança e pelo cumprimento dos procedimentos",
      "Comunicar e acompanhar a equipe"
    ],
    foco: ["aplicacao-nr-pop", "delegacao", "materiais-custos", "gestao-equipe", "gestao-os"],
    profundidadeTecnica: {
      "aplicacao-nr-pop": "aplicacao",
      "gestao-os": "aplicacao",
      contingencia: "nocao",
      "materiais-custos": "nocao"
    },
    limiteTecnico:
      "Cobra fazer cumprir os procedimentos e as regras de segurança no turno. Não cobra projeto nem diagnóstico avançado de equipamentos."
  },
  supervisor: {
    responsabilidades: [
      "Gerir prioridades e ordens de serviço",
      "Gerir pessoas e conflitos da equipe",
      "Comunicar-se com clientes e solicitantes",
      "Organizar recursos (pessoas, materiais, prazos)",
      "Acompanhar indicadores e resultados"
    ],
    foco: [
      "gestao-os",
      "gestao-equipe",
      "comunicacao-cliente",
      "materiais-custos",
      "decisao-pressao"
    ],
    profundidadeTecnica: {
      "aplicacao-nr-pop": "aplicacao",
      "gestao-os": "aplicacao",
      contingencia: "aplicacao",
      "materiais-custos": "aplicacao"
    },
    limiteTecnico:
      "Cobra priorizar, alocar e acompanhar. Não cobra executar o reparo: cobra garantir que o procedimento correto seja seguido por quem executa."
  },
  coordenador: {
    responsabilidades: [
      "Gerir contratos e níveis de serviço (SLA)",
      "Acompanhar custos e indicadores operacionais",
      "Desenvolver supervisores",
      "Cuidar do relacionamento com clientes",
      "Planejar e decidir em nível estratégico"
    ],
    foco: [
      "decisao-pressao",
      "comunicacao-cliente",
      "materiais-custos",
      "delegacao",
      "contingencia"
    ],
    profundidadeTecnica: {
      "aplicacao-nr-pop": "nocao",
      "gestao-os": "nocao",
      contingencia: "aplicacao",
      "materiais-custos": "aplicacao"
    },
    limiteTecnico:
      "Não cobra diagnosticar tecnicamente um equipamento. Cobra avaliar o risco, exigir o encaminhamento correto, garantir os recursos e acompanhar a solução até o fim."
  }
};

export const labDescricaoDaProfundidade: Record<LabProfundidadeTecnica, string> = {
  nenhuma: "não cobrar",
  nocao:
    "noção: saber o que exigir, a quem acionar e o que acompanhar; sem diagnosticar nem executar",
  aplicacao: "aplicação: aplicar o procedimento correto no nível de responsabilidade do cargo"
};

/**
 * A rubrica que dá sentido à escala de aderência. A IA classifica cada alternativa em um destes
 * quatro níveis; quem converte em número, calcula e decide é o backend.
 *
 * `validada` só deve virar verdadeiro depois da validação técnica e pedagógica (RH e área
 * técnica). Mudar um critério exige nova `versao`: o resultado guarda a versão com que foi
 * produzido.
 */
export const labRubrica = {
  versao: "2026-11-1",
  validada: false,
  niveis: [
    {
      aderencia: 100,
      nome: "Ótima",
      criterio:
        "Resolve o problema no nível de responsabilidade do cargo, protege pessoas, cliente e contrato, comunica quem precisa saber e acompanha o encaminhamento."
    },
    {
      aderencia: 70,
      nome: "Boa, com ressalvas",
      criterio:
        "Caminho correto, mas incompleto: falta comunicar, registrar, acompanhar ou envolver quem deveria."
    },
    {
      aderencia: 40,
      nome: "Fraca",
      criterio:
        "Adia, centraliza o que deveria delegar, delega sem acompanhar ou ignora uma parte relevante do problema, sem expor pessoas a risco."
    },
    {
      aderencia: 10,
      nome: "Perigosa",
      criterio:
        "Viola procedimento ou norma de segurança, expõe pessoas a risco, esconde informação do cliente ou compromete o contrato."
    }
  ],
  /** O que observar em cada skill ao classificar uma alternativa. */
  observar: {
    "aplicacao-nr-pop":
      "Segue e faz seguir o procedimento e as regras de segurança aplicáveis ao cargo.",
    "gestao-os":
      "Prioriza a OS pelo impacto (risco, SLA, cliente) e organiza a sequência de atendimento.",
    contingencia:
      "Antecipa o que pode falhar e aciona alternativa ou plano de contingência a tempo.",
    "materiais-custos": "Garante material e ferramenta certos, no prazo, com atenção ao custo.",
    "comunicacao-cliente":
      "Informa o solicitante com clareza, prazo realista e sem esconder o problema.",
    "gestao-equipe":
      "Escuta, alinha expectativas, trata o conflito pelo comportamento e não pela pessoa.",
    "decisao-pressao":
      "Decide com as informações disponíveis dentro do tempo, ponderando risco e impacto.",
    delegacao: "Delega com clareza, conforme a capacidade de cada um, e acompanha o resultado."
  } satisfies Record<LabSkillId, string>
} as const;

/** O que é cada fonte da base de conhecimento. Nunca trate material educacional como norma. */
export const labTiposDeFonte = [
  "legislacao",
  "norma_tecnica",
  "recomendacao",
  "material_educacional"
] as const;
export type LabTipoDeFonte = (typeof labTiposDeFonte)[number];

export const labRotuloDoTipoDeFonte: Record<LabTipoDeFonte, string> = {
  legislacao: "Legislação",
  norma_tecnica: "Norma técnica",
  recomendacao: "Recomendação oficial",
  material_educacional: "Material educacional"
};

export type LabFundamentacao = "validada" | "experimental";

/**
 * A fundamentação final de uma situação: só é "validada" se a IA a fundamentou em fontes validadas
 * E a rubrica em vigor está validada. Qualquer dúvida (campo ausente, IA que não disse) é
 * "experimental": a situação roda, mas não produz resultado oficial.
 */
export function fundamentacaoFinal(
  daIa: LabFundamentacao | undefined,
  rubricaValidada: boolean = labRubrica.validada
): LabFundamentacao {
  return daIa === "validada" && rubricaValidada ? "validada" : "experimental";
}
