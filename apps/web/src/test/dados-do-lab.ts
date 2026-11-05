// Dados de exemplo das respostas da API, tipados pelo contrato compartilhado: se o contrato mudar,
// os testes deixam de compilar em vez de testar um formato que não existe mais.
import {
  type LabPainel,
  type LabRespostaDeResultado,
  type LabRespostaDeSituacao,
  type LabResultado,
  type LabSituacao,
  labSkillsPiloto
} from "@my-flux/shared";

export const AGORA = "2026-03-02T13:00:00.000Z";

export const moldeDeExemplo = { id: "molde-1", nivel: "supervisor", nome: "Supervisor" } as const;

export const skillsSemEvidencia: LabPainel["skills"] = labSkillsPiloto.map((s) => ({
  skillId: s.id,
  nome: s.nome,
  tipo: s.tipo,
  nivel: null,
  nivelCalculado: null,
  validado: false,
  nEvidencias: 0,
  resultadoId: null,
  sessaoId: null,
  atualizadoEm: null
}));

export function painel(extra: Partial<LabPainel> = {}): LabPainel {
  return {
    demonstracao: false,
    termo: { versaoAtual: "2026-1", aceito: true, aceitoEm: AGORA },
    acao: { tipo: "iniciar", molde: moldeDeExemplo },
    indicadores: {
      testesFeitos: 0,
      testesValidados: 0,
      aderenciaMedia: null,
      agilidadeMedia: null,
      ultimoTesteEm: null
    },
    evolucao: { pontos: [], tendenciaDisponivel: false },
    skills: skillsSemEvidencia,
    tipoDePerfil: { disponivel: false, testesFeitos: 0, testesNecessarios: 3 },
    alertas: [],
    sugestoes: { itens: [], origem: null },
    ...extra
  };
}

export function situacao(numero = 1, extra: Partial<LabSituacao> = {}): LabSituacao {
  return {
    numero,
    marco: numero === 3,
    texto: `Texto da situação ${numero}.`,
    opcoes: [
      { id: "A", texto: `Opção A da situação ${numero}.` },
      { id: "B", texto: `Opção B da situação ${numero}.` },
      { id: "C", texto: `Opção C da situação ${numero}.` }
    ],
    consequencia: numero === 1 ? null : `Consequência da escolha anterior (${numero - 1}).`,
    tempoLimiteS: 60,
    tempoRestanteMs: 60_000,
    cena: null,
    ...extra
  };
}

export function respostaDeSituacao(
  numero = 1,
  extra: Omit<Partial<LabRespostaDeSituacao>, "situacao"> & { situacao?: Partial<LabSituacao> } = {}
): LabRespostaDeSituacao {
  const { situacao: situacaoExtra, ...resto } = extra;
  return {
    tipo: "situacao",
    sessaoId: "sessao-1",
    totalSituacoes: 5,
    tempoEsgotadoNaAnterior: false,
    ...resto,
    situacao: situacao(numero, situacaoExtra)
  };
}

export function resultado(extra: Partial<LabResultado> = {}): LabResultado {
  return {
    simulacao: null,
    resultadoId: "resultado-1",
    sessaoId: "sessao-1",
    concluidaEm: AGORA,
    statusValidacao: "aguardando_validacao",
    aderenciaGeral: 76,
    agilidade: 88.33,
    niveisPorSkill: [
      {
        skillId: "gestao-os",
        nome: "Gestão de OS e prioridades",
        tipo: "hard",
        nivel: 4,
        media: 85,
        nEvidencias: 2,
        nivelValidado: null
      }
    ],
    resumo: "Você conduziu o turno com atenção.",
    pontoForte: "Comunicação.",
    pontoDesenvolvimento: "Registrar as decisões.",
    sugestoes: ["Registre o aviso ao solicitante."],
    situacoes: [1, 2, 3, 4, 5].map((numero) => ({
      numero,
      marco: numero === 3,
      texto: `Texto da situação ${numero}.`,
      opcoes: situacao(numero).opcoes,
      escolha: "A" as const,
      tempoEsgotado: false,
      aderencia: 100,
      tempoRespostaMs: 8000,
      justificativa: `Justificativa ${numero}.`,
      consequencia: `Consequência ${numero}.`
    })),
    ...extra
  };
}

export function respostaDeResultado(extra: Partial<LabResultado> = {}): LabRespostaDeResultado {
  return {
    tipo: "resultado",
    sessaoId: "sessao-1",
    tempoEsgotadoNaAnterior: false,
    consequencia: "Fim do teste.",
    resultado: resultado(extra)
  };
}
