// Leadership Lab — o contrato das respostas HTTP que o navegador recebe.
//
// Uma definição só, usada nas duas pontas:
//  - o front valida cada resposta com estes schemas e deriva os tipos daqui (uma resposta fora do
//    formato vira um erro claro na tela, não um `undefined.map` no meio da renderização);
//  - a API prova, nos testes de integração, que o que ela realmente envia obedece a eles.
//
// Os schemas são PERMISSIVOS com campo a mais (o Zod o descarta): a API pode crescer sem derrubar
// uma tela já publicada. O que protege dados é o outro lado: a API monta cada visão campo a campo
// (visoes.ts, painel/montagem.ts) e os testes dela conferem que a avaliação não vaza.
//
// Datas viajam como texto ISO 8601 (é o que o JSON faz com um Date).
import { z } from "zod";
import {
  labAlertaCores,
  labEscolhas,
  labEstilos,
  labFlexibilidades,
  labMoldeNiveis,
  labSkillTipos,
  labStatusValidacao
} from "./leadership-lab.js";

const dataIso = z.iso.datetime();
const inteiro = z.int();
const inteiroNaoNegativo = z.int().min(0);

const escolha = z.enum(labEscolhas);
const estilo = z.enum(labEstilos);
const statusValidacao = z.enum(labStatusValidacao);

// ---------------------------------------------------------------------------
// Termo de ciência
// ---------------------------------------------------------------------------

export const labTermoSchema = z.object({
  versaoAtual: z.string(),
  aceito: z.boolean(),
  aceitoEm: dataIso.nullable()
});
export type LabTermo = z.infer<typeof labTermoSchema>;

/** O que POST /termo devolve. */
export const labAceiteDoTermoSchema = z.object({
  versaoTermo: z.string(),
  aceitoEm: dataIso
});
export type LabAceiteDoTermo = z.infer<typeof labAceiteDoTermoSchema>;

// ---------------------------------------------------------------------------
// Painel (GET /painel)
// ---------------------------------------------------------------------------

export const labMoldeDoPainelSchema = z.object({
  id: z.string(),
  nivel: z.enum(labMoldeNiveis),
  nome: z.string()
});
export type LabMoldeDoPainel = z.infer<typeof labMoldeDoPainelSchema>;

export const labMotivosDeIndisponibilidade = [
  "termo-pendente",
  "cargo-nao-informado",
  "molde-nao-mapeado",
  "molde-inativo",
  "limite-diario"
] as const;
export type LabMotivoDeIndisponibilidade = (typeof labMotivosDeIndisponibilidade)[number];

export const labAcaoDoPainelSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("iniciar"), molde: labMoldeDoPainelSchema }),
  z.object({
    tipo: z.literal("continuar"),
    sessaoId: z.string(),
    situacaoAtual: inteiro,
    totalSituacoes: inteiro,
    molde: labMoldeDoPainelSchema
  }),
  z.object({
    tipo: z.literal("indisponivel"),
    motivo: z.enum(labMotivosDeIndisponibilidade),
    molde: labMoldeDoPainelSchema.nullable(),
    limiteDiario: inteiro.nullable()
  })
]);
export type LabAcaoDoPainel = z.infer<typeof labAcaoDoPainelSchema>;

export const labPontoDaEvolucaoSchema = z.object({
  resultadoId: z.string(),
  sessaoId: z.string(),
  concluidaEm: dataIso,
  aderenciaGeral: z.number(),
  agilidade: z.number(),
  statusValidacao,
  nSituacoes: inteiro
});
export type LabPontoDaEvolucao = z.infer<typeof labPontoDaEvolucaoSchema>;

export const labSkillDoPainelSchema = z.object({
  skillId: z.string(),
  nome: z.string(),
  tipo: z.enum(labSkillTipos),
  nivel: inteiro.nullable(),
  nivelCalculado: inteiro.nullable(),
  validado: z.boolean(),
  nEvidencias: inteiroNaoNegativo,
  resultadoId: z.string().nullable(),
  sessaoId: z.string().nullable(),
  atualizadoEm: dataIso.nullable()
});
export type LabSkillDoPainel = z.infer<typeof labSkillDoPainelSchema>;

export const labTipoDePerfilSchema = z.discriminatedUnion("disponivel", [
  z.object({
    disponivel: z.literal(false),
    testesFeitos: inteiroNaoNegativo,
    testesNecessarios: inteiro
  }),
  z.object({
    disponivel: z.literal(true),
    estiloPredominante: estilo.nullable(),
    estilosEmpatados: z.array(estilo),
    distribuicao: z.object({
      direcao: inteiroNaoNegativo,
      orientacao: inteiroNaoNegativo,
      apoio: inteiroNaoNegativo,
      delegacao: inteiroNaoNegativo
    }),
    flexibilidade: z.enum(labFlexibilidades).nullable(),
    flexibilidadePct: z.number().nullable(),
    nEscolhas: inteiroNaoNegativo,
    testesConsiderados: inteiroNaoNegativo,
    testesAguardandoValidacao: inteiroNaoNegativo
  })
]);
export type LabTipoDePerfil = z.infer<typeof labTipoDePerfilSchema>;

export const labAlertaDoPainelSchema = z.object({
  id: z.string(),
  cor: z.enum(labAlertaCores),
  criadoEm: dataIso,
  skill: z.object({ id: z.string(), nome: z.string() }).nullable(),
  situacao: inteiro.nullable(),
  teste: z.object({
    sessaoId: z.string(),
    resultadoId: z.string().nullable(),
    concluidaEm: dataIso.nullable()
  })
});
export type LabAlertaDoPainel = z.infer<typeof labAlertaDoPainelSchema>;

export const labPainelSchema = z.object({
  /** Modo demonstração: a IA e o conteúdo são de exemplo. Servidor antigo (sem o campo) = falso. */
  demonstracao: z.boolean().default(false),
  termo: z.object({ versaoAtual: z.string(), aceito: z.boolean(), aceitoEm: dataIso.nullable() }),
  acao: labAcaoDoPainelSchema,
  indicadores: z.object({
    testesFeitos: inteiroNaoNegativo,
    testesValidados: inteiroNaoNegativo,
    aderenciaMedia: z.number().nullable(),
    agilidadeMedia: z.number().nullable(),
    ultimoTesteEm: dataIso.nullable()
  }),
  evolucao: z.object({
    pontos: z.array(labPontoDaEvolucaoSchema),
    tendenciaDisponivel: z.boolean()
  }),
  skills: z.array(labSkillDoPainelSchema),
  tipoDePerfil: labTipoDePerfilSchema,
  alertas: z.array(labAlertaDoPainelSchema),
  sugestoes: z.object({
    itens: z.array(z.string()),
    origem: z
      .object({
        resultadoId: z.string(),
        sessaoId: z.string(),
        concluidaEm: dataIso,
        statusValidacao
      })
      .nullable()
  })
});
export type LabPainel = z.infer<typeof labPainelSchema>;

// ---------------------------------------------------------------------------
// O teste: situação, resposta e resultado
// ---------------------------------------------------------------------------

export const labOpcaoSchema = z.object({ id: escolha, texto: z.string() });
export type LabOpcao = z.infer<typeof labOpcaoSchema>;

/** O que o participante vê DURANTE o teste: nunca aderência, estilo, skills nem justificativa. */
export const labSituacaoSchema = z.object({
  numero: inteiro,
  marco: z.boolean(),
  texto: z.string(),
  opcoes: z.array(labOpcaoSchema).length(3),
  /** O efeito da escolha anterior. Nulo na primeira situação. */
  consequencia: z.string().nullable(),
  tempoLimiteS: inteiro,
  /** Quanto falta, medido no servidor: recarregar a página não zera o relógio. */
  tempoRestanteMs: inteiroNaoNegativo
});
export type LabSituacao = z.infer<typeof labSituacaoSchema>;

export const labSituacaoDoResultadoSchema = z.object({
  numero: inteiro,
  marco: z.boolean(),
  texto: z.string(),
  opcoes: z.array(labOpcaoSchema).length(3),
  escolha: escolha.nullable(),
  tempoEsgotado: z.boolean(),
  aderencia: z.number(),
  tempoRespostaMs: inteiroNaoNegativo.nullable(),
  justificativa: z.string().nullable(),
  consequencia: z.string().nullable()
});
export type LabSituacaoDoResultado = z.infer<typeof labSituacaoDoResultadoSchema>;

export const labNivelDeSkillSchema = z.object({
  skillId: z.string(),
  nome: z.string(),
  tipo: z.enum(labSkillTipos).nullable(),
  nivel: inteiro,
  media: z.number(),
  nEvidencias: inteiro
});
export type LabNivelDeSkill = z.infer<typeof labNivelDeSkillSchema>;

export const labResultadoSchema = z.object({
  resultadoId: z.string(),
  sessaoId: z.string(),
  concluidaEm: dataIso.nullable(),
  /** "aguardando_validacao" vira o selo: o curador ainda não revisou. */
  statusValidacao,
  aderenciaGeral: z.number(),
  agilidade: z.number(),
  niveisPorSkill: z.array(labNivelDeSkillSchema),
  resumo: z.string(),
  pontoForte: z.string().nullable(),
  pontoDesenvolvimento: z.string().nullable(),
  sugestoes: z.array(z.string()),
  situacoes: z.array(labSituacaoDoResultadoSchema)
});
export type LabResultado = z.infer<typeof labResultadoSchema>;

export const labRespostaDeSituacaoSchema = z.object({
  tipo: z.literal("situacao"),
  sessaoId: z.string(),
  totalSituacoes: inteiro,
  /** A situação anterior passou do tempo e contou como omissão. */
  tempoEsgotadoNaAnterior: z.boolean(),
  situacao: labSituacaoSchema
});
export type LabRespostaDeSituacao = z.infer<typeof labRespostaDeSituacaoSchema>;

export const labRespostaDeResultadoSchema = z.object({
  tipo: z.literal("resultado"),
  sessaoId: z.string(),
  tempoEsgotadoNaAnterior: z.boolean(),
  /** O efeito da última escolha. */
  consequencia: z.string().nullable(),
  resultado: labResultadoSchema
});
export type LabRespostaDeResultado = z.infer<typeof labRespostaDeResultadoSchema>;

/** A resposta já foi dada, mas a IA ainda não a avaliou: a tela oferece "tentar de novo". */
export const labRespostaEmProcessamentoSchema = z.object({
  tipo: z.literal("em-processamento"),
  sessaoId: z.string(),
  numero: inteiro,
  totalSituacoes: inteiro
});
export type LabRespostaEmProcessamento = z.infer<typeof labRespostaEmProcessamentoSchema>;

/** O que POST /sessoes, /respostas e /tempo-esgotado devolvem. */
export const labRespostaDoTesteSchema = z.discriminatedUnion("tipo", [
  labRespostaDeSituacaoSchema,
  labRespostaDeResultadoSchema
]);
export type LabRespostaDoTeste = z.infer<typeof labRespostaDoTesteSchema>;

/** O que GET /sessoes/atual devolve. */
export const labEstadoDoTesteSchema = z.discriminatedUnion("tipo", [
  labRespostaDeSituacaoSchema,
  labRespostaEmProcessamentoSchema
]);
export type LabEstadoDoTeste = z.infer<typeof labEstadoDoTesteSchema>;

// ---------------------------------------------------------------------------
// Códigos de erro que a tela trata
// ---------------------------------------------------------------------------

/** Os códigos estáveis do módulo (motor/erros.ts e lab-access.ts). A tela reage a eles. */
export const labCodigosDeErro = [
  "LAB_FORBIDDEN",
  "LAB_SEM_VINCULO",
  "LAB_TERMO_PENDENTE",
  "LAB_NOT_FOUND",
  "LAB_CARGO_NAO_INFORMADO",
  "LAB_MOLDE_NAO_MAPEADO",
  "LAB_MOLDE_INATIVO",
  "LAB_MOLDE_DIVERGENTE",
  "LAB_LIMITE_DIARIO",
  "LAB_SESSAO_ENCERRADA",
  "LAB_SEM_TESTE_EM_ANDAMENTO",
  "LAB_TURNO_FORA_DE_ORDEM",
  "LAB_RESPOSTA_DIVERGENTE",
  "LAB_EM_PROCESSAMENTO",
  "LAB_TEMPO_NAO_ESGOTADO",
  "LAB_TESTE_EM_ANDAMENTO",
  "LAB_IA_INDISPONIVEL",
  "LAB_IA_RESPOSTA_INVALIDA"
] as const;
export type LabCodigoDeErro = (typeof labCodigosDeErro)[number];
