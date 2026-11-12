// Dados de exemplo da curadoria, tipados pelo contrato compartilhado.
import type {
  LabAlertaDoCurador,
  LabContestacaoDoCurador,
  LabContestacaoPropria,
  LabContribuicaoDoCurador,
  LabFichaDeRevisao,
  LabItemDaRevisao,
  LabParticipanteResumido,
  LabPendencias,
  LabSituacaoDaFicha
} from "@my-flux/shared";
import { AGORA } from "./dados-do-lab";

export function participanteResumido(
  extra: Partial<LabParticipanteResumido> = {}
): LabParticipanteResumido {
  return {
    id: "participante-1",
    nome: "Ana Souza",
    identificador: "MAT-001",
    cargo: "Supervisor de campo",
    operacao: "Operação Norte",
    ...extra
  };
}

export function pendencias(extra: Partial<LabPendencias> = {}): LabPendencias {
  return {
    resultadosAguardando: 0,
    alertasAbertos: 0,
    contestacoesPendentes: 0,
    contribuicoesPendentes: 0,
    ...extra
  };
}

export function itemDaRevisao(extra: Partial<LabItemDaRevisao> = {}): LabItemDaRevisao {
  return {
    resultadoId: "resultado-1",
    sessaoId: "sessao-1",
    concluidaEm: AGORA,
    statusValidacao: "aguardando_validacao",
    experimental: false,
    participante: participanteResumido(),
    moldeNome: "Supervisor",
    aderenciaGeral: 76,
    agilidade: 88.33,
    alertasAbertos: 0,
    contestacoesPendentes: 0,
    ...extra
  };
}

export function alerta(extra: Partial<LabAlertaDoCurador> = {}): LabAlertaDoCurador {
  return {
    id: "alerta-1",
    cor: "vermelho",
    status: "aberto",
    criadoEm: AGORA,
    skillNome: null,
    situacao: 2,
    participante: participanteResumido(),
    sessaoId: "sessao-1",
    resultadoId: "resultado-1",
    testeConcluido: true,
    tratadoEm: null,
    tratadoPor: null,
    nota: null,
    ...extra
  };
}

export function contribuicao(
  extra: Partial<LabContribuicaoDoCurador> = {}
): LabContribuicaoDoCurador {
  return {
    id: "contribuicao-1",
    texto: "Sugiro um checklist de abertura do turno.",
    status: "pendente",
    criadoEm: AGORA,
    situacao: 1,
    participante: participanteResumido(),
    sessaoId: "sessao-1",
    resultadoId: "resultado-1",
    testeConcluido: true,
    decididoEm: null,
    decididoPor: null,
    ...extra
  };
}

export function contestacao(extra: Partial<LabContestacaoDoCurador> = {}): LabContestacaoDoCurador {
  return {
    id: "contestacao-1",
    ponto: "Situação 2",
    motivo: "O cliente já tinha sido avisado.",
    status: "pendente",
    criadoEm: AGORA,
    participante: participanteResumido(),
    resultadoId: "resultado-1",
    sessaoId: "sessao-1",
    statusValidacao: "aguardando_validacao",
    decididoEm: null,
    decididoPor: null,
    nota: null,
    ...extra
  };
}

export function contestacaoPropria(
  extra: Partial<LabContestacaoPropria> = {}
): LabContestacaoPropria {
  return {
    id: "contestacao-1",
    ponto: "Situação 2",
    motivo: "O cliente já tinha sido avisado.",
    status: "pendente",
    criadoEm: AGORA,
    decididoEm: null,
    nota: null,
    ...extra
  };
}

export function situacaoDaFicha(
  numero = 1,
  extra: Partial<LabSituacaoDaFicha> = {}
): LabSituacaoDaFicha {
  return {
    numero,
    marco: numero === 3,
    texto: `Cenário da situação ${numero}.`,
    opcoes: [
      { id: "A", texto: "Reunir a equipe." },
      { id: "B", texto: "Resolver sozinho." },
      { id: "C", texto: "Esperar o cliente." }
    ],
    escolha: "A",
    tempoEsgotado: false,
    aderencia: 100,
    estilo: "orientacao",
    alertaVermelho: false,
    tempoRespostaMs: 8000,
    justificativa: `Avaliação da situação ${numero}.`,
    consequencia: null,
    ...extra
  };
}

export function ficha(extra: Partial<LabFichaDeRevisao> = {}): LabFichaDeRevisao {
  return {
    resultadoId: "resultado-1",
    sessaoId: "sessao-1",
    concluidaEm: AGORA,
    statusValidacao: "aguardando_validacao",
    experimental: false,
    participante: participanteResumido(),
    moldeNome: "Supervisor",
    aderenciaGeral: 76,
    agilidade: 88.33,
    estiloPredominante: "orientacao",
    flexibilidade: "media",
    flexibilidadePct: 50,
    resumo: "Você conduziu o turno com atenção.",
    pontoForte: "Comunicação.",
    pontoDesenvolvimento: "Delegação.",
    sugestoes: ["Praticar a delegação."],
    skills: [
      {
        skillId: "gestao-os",
        nome: "Gestão de OS e prioridades",
        tipo: "hard",
        nivelCalculado: 4,
        media: 85,
        nEvidencias: 2,
        nivelValidado: null
      },
      {
        skillId: "delegacao",
        nome: "Delegação",
        tipo: "soft",
        nivelCalculado: 2,
        media: 40,
        nEvidencias: 1,
        nivelValidado: null
      }
    ],
    situacoes: [
      situacaoDaFicha(1),
      situacaoDaFicha(2, { escolha: "C", aderencia: 10, alertaVermelho: true })
    ],
    validacao: { validadoPor: null, validadoEm: null, justificativa: null },
    alertas: [],
    contribuicoes: [],
    contestacoes: [],
    ...extra
  };
}
