// Leadership Lab — a montagem do painel, pura: recebe linhas já lidas e devolve o painel.
//
// Sem banco e sem relógio, para as regras do painel poderem ser testadas uma a uma:
//  - tendência e tipo de perfil só depois de 3 testes;
//  - o nível exibido de uma skill é o validado pelo curador, se houver; senão o calculado;
//  - o tipo de perfil junta as ESCOLHAS de todos os testes (não faz média de médias), com a mesma
//    definição de estilo predominante e flexibilidade usada em um teste (analisarEstilos);
//  - sugestões: até 3, as do teste mais recente;
//  - cada bloco é montado campo a campo, sem espalhar a linha de entrada.
import {
  type LabAlertaCor,
  type LabEstilo,
  type LabMoldeNivel,
  type LabStatusValidacao,
  LAB_TESTES_MINIMOS_TENDENCIA,
  analisarEstilos,
  arredondar,
  labAlertaCores,
  labSkillsPiloto,
  podeExibirTendencia
} from "@my-flux/shared";
import type { LabMolde } from "@prisma/client";
import { z } from "zod";
import type { EstadoDoInicio } from "../motor/precondicoes.js";
import {
  type AcaoDoPainel,
  type AlertaDoPainel,
  LIMITES_DO_PAINEL,
  type MoldeDoPainel,
  type PainelDoParticipante,
  type SkillDoPainel,
  type SugestoesDoPainel,
  type TipoDePerfilDoPainel
} from "./tipos.js";

// ---------------------------------------------------------------------------
// O que a leitura entrega
// ---------------------------------------------------------------------------

export type LinhaDeResultado = {
  resultadoId: string;
  sessaoId: string;
  concluidaEm: Date;
  aderenciaGeral: number;
  agilidade: number;
  statusValidacao: string;
  nSituacoes: number;
};

/** O nível MAIS RECENTE de uma skill (uma linha por skill). */
export type LinhaDeSkill = {
  skillId: string;
  nivel: number;
  nEvidencias: number;
  validado: boolean;
  nivelValidado: number | null;
  sessaoId: string;
  resultadoId: string;
  concluidaEm: Date;
};

/** Uma escolha que envolveu a equipe, de um teste concluído (omissão não entra). */
export type LinhaDeEscolha = {
  sessaoId: string;
  statusValidacao: string;
  estilo: string;
  estiloAdequado: string;
};

export type LinhaDeAlerta = {
  id: string;
  cor: string;
  criadoEm: Date;
  skillId: string | null;
  skillNome: string | null;
  situacao: number | null;
  sessaoId: string;
  resultadoId: string | null;
  concluidaEm: Date | null;
};

export type LinhaDoUltimoResultado = {
  resultadoId: string;
  sessaoId: string;
  concluidaEm: Date;
  statusValidacao: string;
  sugestoes: unknown;
};

export type DadosDoPainel = {
  termo: { versaoAtual: string; aceitoEm: Date | null };
  inicio: { estado: EstadoDoInicio; situacaoAtual: number | null };
  indicadores: {
    testesFeitos: number;
    testesValidados: number;
    aderenciaMedia: number | null;
    agilidadeMedia: number | null;
    ultimoTesteEm: Date | null;
  };
  /** Em ordem cronológica. */
  resultados: LinhaDeResultado[];
  skills: LinhaDeSkill[];
  escolhasDeEstilo: LinhaDeEscolha[];
  alertas: LinhaDeAlerta[];
  ultimoResultado: LinhaDoUltimoResultado | null;
};

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

function moldeDoPainel(molde: LabMolde): MoldeDoPainel {
  return { id: molde.id, nivel: molde.nivel as LabMoldeNivel, nome: molde.nome };
}

/** O botão: o mesmo estado que POST /sessoes usa para decidir, traduzido para a tela. */
export function acaoDoPainel(inicio: DadosDoPainel["inicio"]): AcaoDoPainel {
  const { estado, situacaoAtual } = inicio;
  const indisponivel = (
    motivo: Extract<AcaoDoPainel, { tipo: "indisponivel" }>["motivo"],
    molde: LabMolde | null,
    limiteDiario: number | null
  ): AcaoDoPainel => ({
    tipo: "indisponivel",
    motivo,
    molde: molde ? moldeDoPainel(molde) : null,
    limiteDiario
  });

  switch (estado.tipo) {
    case "iniciar":
      return { tipo: "iniciar", molde: moldeDoPainel(estado.molde) };
    case "continuar":
      if (situacaoAtual === null) {
        throw new Error(`Sessão ${estado.sessao.id} em andamento sem nenhuma situação.`);
      }
      return {
        tipo: "continuar",
        sessaoId: estado.sessao.id,
        situacaoAtual,
        totalSituacoes: estado.sessao.molde.numeroSituacoes,
        molde: moldeDoPainel(estado.sessao.molde)
      };
    case "termo-pendente":
      return indisponivel("termo-pendente", null, null);
    case "cargo-nao-informado":
      return indisponivel("cargo-nao-informado", null, null);
    case "molde-nao-mapeado":
      return indisponivel("molde-nao-mapeado", null, null);
    case "molde-inativo":
      return indisponivel("molde-inativo", estado.molde, null);
    case "limite-diario":
      return indisponivel("limite-diario", estado.molde, estado.limite);
  }
}

/** As 8 skills do piloto, na ordem fixa. Uma skill sem evidência aparece, sem nível. */
function skillsDoPainel(linhas: readonly LinhaDeSkill[]): SkillDoPainel[] {
  const maisRecente = new Map(linhas.map((l) => [l.skillId, l]));
  return labSkillsPiloto.map((skill) => {
    const linha = maisRecente.get(skill.id);
    if (!linha) {
      return {
        skillId: skill.id,
        nome: skill.nome,
        tipo: skill.tipo,
        nivel: null,
        nivelCalculado: null,
        validado: false,
        nEvidencias: 0,
        resultadoId: null,
        sessaoId: null,
        atualizadoEm: null
      };
    }
    const validado = linha.validado && linha.nivelValidado !== null;
    return {
      skillId: skill.id,
      nome: skill.nome,
      tipo: skill.tipo,
      nivel: validado ? linha.nivelValidado : linha.nivel,
      nivelCalculado: linha.nivel,
      validado,
      nEvidencias: linha.nEvidencias,
      resultadoId: linha.resultadoId,
      sessaoId: linha.sessaoId,
      atualizadoEm: linha.concluidaEm
    };
  });
}

/** Só depois de 3 testes. O perfil junta as escolhas de todos os testes concluídos. */
function tipoDePerfil(
  testesFeitos: number,
  escolhas: readonly LinhaDeEscolha[]
): TipoDePerfilDoPainel {
  if (!podeExibirTendencia(testesFeitos)) {
    return {
      disponivel: false,
      testesFeitos,
      testesNecessarios: LAB_TESTES_MINIMOS_TENDENCIA
    };
  }
  const analise = analisarEstilos(
    escolhas.map((e) => ({
      estilo: e.estilo as LabEstilo,
      estiloAdequado: e.estiloAdequado as LabEstilo
    }))
  );
  const testes = new Map<string, string>();
  for (const e of escolhas) testes.set(e.sessaoId, e.statusValidacao);

  return {
    disponivel: true,
    estiloPredominante: analise.estiloPredominante,
    estilosEmpatados: analise.estilosEmpatados,
    distribuicao: analise.distribuicao,
    flexibilidade: analise.flexibilidade,
    flexibilidadePct: analise.flexibilidadePct,
    nEscolhas: analise.nEscolhas,
    testesConsiderados: testes.size,
    testesAguardandoValidacao: [...testes.values()].filter((s) => s === "aguardando_validacao")
      .length
  };
}

/** Vermelhos primeiro; dentro de cada cor, os mais recentes. */
function alertasDoPainel(linhas: readonly LinhaDeAlerta[]): AlertaDoPainel[] {
  const ordem = (cor: string) => labAlertaCores.indexOf(cor as LabAlertaCor);
  return linhas
    .filter((l) => ordem(l.cor) >= 0)
    .sort(
      (a, b) =>
        ordem(a.cor) - ordem(b.cor) ||
        b.criadoEm.getTime() - a.criadoEm.getTime() ||
        a.id.localeCompare(b.id)
    )
    .slice(0, LIMITES_DO_PAINEL.alertas)
    .map((l) => ({
      id: l.id,
      cor: l.cor as LabAlertaCor,
      criadoEm: l.criadoEm,
      skill: l.skillId !== null ? { id: l.skillId, nome: l.skillNome ?? l.skillId } : null,
      situacao: l.situacao,
      teste: { sessaoId: l.sessaoId, resultadoId: l.resultadoId, concluidaEm: l.concluidaEm }
    }));
}

const textos = z.array(z.string());

function sugestoesDoPainel(ultimo: LinhaDoUltimoResultado | null): SugestoesDoPainel {
  if (!ultimo) return { itens: [], origem: null };
  const lidas = textos.safeParse(ultimo.sugestoes);
  const itens = (lidas.success ? lidas.data : [])
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .slice(0, LIMITES_DO_PAINEL.sugestoes);
  return {
    itens,
    origem: {
      resultadoId: ultimo.resultadoId,
      sessaoId: ultimo.sessaoId,
      concluidaEm: ultimo.concluidaEm,
      statusValidacao: ultimo.statusValidacao as LabStatusValidacao
    }
  };
}

// ---------------------------------------------------------------------------
// O painel
// ---------------------------------------------------------------------------

export function montarPainel(dados: DadosDoPainel): PainelDoParticipante {
  const { termo, indicadores } = dados;
  const media = (valor: number | null) => (valor === null ? null : arredondar(valor, 2));

  return {
    termo: {
      versaoAtual: termo.versaoAtual,
      aceito: termo.aceitoEm !== null,
      aceitoEm: termo.aceitoEm
    },
    acao: acaoDoPainel(dados.inicio),
    indicadores: {
      testesFeitos: indicadores.testesFeitos,
      testesValidados: indicadores.testesValidados,
      aderenciaMedia: media(indicadores.aderenciaMedia),
      agilidadeMedia: media(indicadores.agilidadeMedia),
      ultimoTesteEm: indicadores.ultimoTesteEm
    },
    evolucao: {
      pontos: dados.resultados.map((r) => ({
        resultadoId: r.resultadoId,
        sessaoId: r.sessaoId,
        concluidaEm: r.concluidaEm,
        aderenciaGeral: r.aderenciaGeral,
        agilidade: r.agilidade,
        statusValidacao: r.statusValidacao as LabStatusValidacao,
        nSituacoes: r.nSituacoes
      })),
      tendenciaDisponivel: podeExibirTendencia(indicadores.testesFeitos)
    },
    skills: skillsDoPainel(dados.skills),
    tipoDePerfil: tipoDePerfil(indicadores.testesFeitos, dados.escolhasDeEstilo),
    alertas: alertasDoPainel(dados.alertas),
    sugestoes: sugestoesDoPainel(dados.ultimoResultado)
  };
}
