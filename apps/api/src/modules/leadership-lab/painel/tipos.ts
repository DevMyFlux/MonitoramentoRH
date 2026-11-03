// Leadership Lab — o painel do participante (GET /painel): o que o servidor entrega à tela inicial.
//
// Um bloco por linha da tabela "Painel e perfil" da documentação, mais o termo de ciência (que a
// tela mostra no primeiro acesso). Cada tipo é montado campo a campo em montagem.ts, nunca
// espalhando uma linha do banco, então coluna nova não vaza sozinha.
//
// REGRA CENTRAL: o painel só enxerga TESTES CONCLUÍDOS. A aderência é escondida durante o teste,
// e o alerta vermelho nasce na hora (para o curador ser avisado); mostrá-lo aqui antes do fim
// revelaria a avaliação no meio do teste. O que está em andamento aparece só como a ação
// "continuar", sem nenhum dado de avaliação.
import type {
  LabAlertaCor,
  LabEstilo,
  LabFlexibilidade,
  LabMoldeNivel,
  LabSkillTipo,
  LabStatusValidacao
} from "@my-flux/shared";

export const LIMITES_DO_PAINEL = {
  /** "Até 3 sugestões práticas" (documentação). */
  sugestoes: 3,
  /** Proteção, não regra de negócio: a evolução devolve os testes mais recentes, no máximo isto. */
  pontosDaEvolucao: 100,
  /** Proteção, não regra de negócio: máximo de alertas abertos devolvidos. */
  alertas: 100
} as const;

// ---------------------------------------------------------------------------
// Ação: o botão "Iniciar teste"
// ---------------------------------------------------------------------------

export type MoldeDoPainel = { id: string; nivel: LabMoldeNivel; nome: string };

/** Por que o botão não pode iniciar. É o mesmo motivo que POST /sessoes devolveria como erro. */
export type MotivoDeIndisponibilidade =
  | "termo-pendente"
  | "cargo-nao-informado"
  | "molde-nao-mapeado"
  | "molde-inativo"
  | "limite-diario";

export type AcaoDoPainel =
  | { tipo: "iniciar"; molde: MoldeDoPainel }
  | {
      tipo: "continuar";
      sessaoId: string;
      /** O número da situação em que o participante parou. Nenhum dado de avaliação. */
      situacaoAtual: number;
      totalSituacoes: number;
      molde: MoldeDoPainel;
    }
  | {
      tipo: "indisponivel";
      motivo: MotivoDeIndisponibilidade;
      molde: MoldeDoPainel | null;
      /** Só quando o motivo é "limite-diario"; nulo nos demais. */
      limiteDiario: number | null;
    };

// ---------------------------------------------------------------------------
// Indicadores e evolução
// ---------------------------------------------------------------------------

/** Os cartões com número. As médias consideram todos os testes concluídos, validados ou não. */
export type IndicadoresDoPainel = {
  testesFeitos: number;
  /** Quantos dos testes feitos já foram validados pelo curador; os demais levam o selo "aguardando validação". */
  testesValidados: number;
  aderenciaMedia: number | null;
  agilidadeMedia: number | null;
  ultimoTesteEm: Date | null;
};

export type PontoDaEvolucao = {
  resultadoId: string;
  sessaoId: string;
  concluidaEm: Date;
  aderenciaGeral: number;
  agilidade: number;
  /** "aguardando_validacao" aparece como selo no ponto. */
  statusValidacao: LabStatusValidacao;
  /** Quantas escolhas sustentam o ponto. */
  nSituacoes: number;
};

export type EvolucaoDoPainel = {
  /** Em ordem cronológica, do mais antigo ao mais recente. */
  pontos: PontoDaEvolucao[];
  /**
   * Tendência só aparece depois de 3 testes. A documentação não define como se calcula, então o
   * servidor expõe a série e a regra de liberação, e não uma direção calculada.
   */
  tendenciaDisponivel: boolean;
};

// ---------------------------------------------------------------------------
// Skills (radar)
// ---------------------------------------------------------------------------

/** Uma das 8 skills do piloto, na ordem fixa (4 hard e depois 4 soft). */
export type SkillDoPainel = {
  skillId: string;
  nome: string;
  tipo: LabSkillTipo;
  /** O nível exibido: o validado pelo curador, se houver; senão o calculado. Nulo sem evidência. */
  nivel: number | null;
  /** O nível calculado pelo backend, antes de qualquer ajuste do curador. */
  nivelCalculado: number | null;
  /** O curador já revisou este nível. Falso mostra o selo "aguardando validação". */
  validado: boolean;
  /** Quantas escolhas sustentam o nível. Zero quando a skill ainda não teve evidência. */
  nEvidencias: number;
  /** O resultado de onde o nível veio, para o participante poder contestá-lo. */
  resultadoId: string | null;
  sessaoId: string | null;
  atualizadoEm: Date | null;
};

// ---------------------------------------------------------------------------
// Tipo de perfil (quadrante dos 4 estilos)
// ---------------------------------------------------------------------------

export type TipoDePerfilDoPainel =
  /** Antes de 3 testes não há perfil: nada de estilo nem de flexibilidade é enviado. */
  | { disponivel: false; testesFeitos: number; testesNecessarios: number }
  | {
      disponivel: true;
      /** Nulo se nenhuma escolha envolveu a equipe, ou se houve empate (veja estilosEmpatados). */
      estiloPredominante: LabEstilo | null;
      estilosEmpatados: LabEstilo[];
      /** Quantas escolhas de cada estilo: é o que desenha o quadrante. */
      distribuicao: Record<LabEstilo, number>;
      flexibilidade: LabFlexibilidade | null;
      flexibilidadePct: number | null;
      /** Quantas escolhas sustentam o perfil. */
      nEscolhas: number;
      /** Quantos testes contribuíram com ao menos uma escolha. */
      testesConsiderados: number;
      /** Destes, quantos ainda aguardam validação. */
      testesAguardandoValidacao: number;
    };

// ---------------------------------------------------------------------------
// Alertas e sugestões
// ---------------------------------------------------------------------------

export type AlertaDoPainel = {
  id: string;
  cor: LabAlertaCor;
  criadoEm: Date;
  /** O alerta amarelo é de uma skill. */
  skill: { id: string; nome: string } | null;
  /** O alerta vermelho é de uma situação do teste. */
  situacao: number | null;
  teste: { sessaoId: string; resultadoId: string | null; concluidaEm: Date | null };
};

export type SugestoesDoPainel = {
  /** Até 3, as do debriefing do teste mais recente. */
  itens: string[];
  origem: {
    resultadoId: string;
    sessaoId: string;
    concluidaEm: Date;
    statusValidacao: LabStatusValidacao;
  } | null;
};

// ---------------------------------------------------------------------------
// O painel
// ---------------------------------------------------------------------------

export type PainelDoParticipante = {
  termo: { versaoAtual: string; aceito: boolean; aceitoEm: Date | null };
  acao: AcaoDoPainel;
  indicadores: IndicadoresDoPainel;
  evolucao: EvolucaoDoPainel;
  skills: SkillDoPainel[];
  tipoDePerfil: TipoDePerfilDoPainel;
  alertas: AlertaDoPainel[];
  sugestoes: SugestoesDoPainel;
};
