// Leadership Lab — o que sai do servidor para o navegador.
//
// ESTE É O ÚNICO LUGAR que decide o que o participante enxerga. Cada visão é montada campo a
// campo, nunca por espalhamento de uma linha do banco, então um campo novo na tabela não vaza
// sem alguém escrevê-lo aqui.
//
// Durante o teste, o front recebe só: número, marco, texto, opções, consequência e tempo.
// NUNCA aderência, estilo, skills, alerta, estilo adequado nem a justificativa da avaliação.
// Só depois do último turno o participante vê o resultado (aderência por situação, agilidade,
// níveis, resumo).
import {
  type LabEscolha,
  type LabSkillTipo,
  type LabStatusValidacao,
  labEscolhas,
  labSkillsPiloto
} from "@my-flux/shared";
import type { LabResultado, LabSessao, LabTurno } from "@prisma/client";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Durante o teste
// ---------------------------------------------------------------------------

export type OpcaoVisivel = { id: LabEscolha; texto: string };

export type SituacaoVisivel = {
  numero: number;
  marco: boolean;
  texto: string;
  opcoes: OpcaoVisivel[];
  /** O efeito da escolha anterior, mostrado antes da situação. Nulo na primeira. */
  consequencia: string | null;
  tempoLimiteS: number;
  /** Quanto falta, calculado no servidor. Garante que recarregar a página não zera o relógio. */
  tempoRestanteMs: number;
};

export type RespostaDeSituacao = {
  tipo: "situacao";
  sessaoId: string;
  totalSituacoes: number;
  /** A situação anterior passou do tempo e contou como omissão. */
  tempoEsgotadoNaAnterior: boolean;
  situacao: SituacaoVisivel;
};

export type RespostaDeResultado = {
  tipo: "resultado";
  sessaoId: string;
  tempoEsgotadoNaAnterior: boolean;
  /** O efeito da última escolha. */
  consequencia: string | null;
  resultado: VisaoDoResultado;
};

export type RespostaDoTeste = RespostaDeSituacao | RespostaDeResultado;

const opcoesDoBanco = z.array(z.object({ id: z.enum(labEscolhas), texto: z.string() })).length(3);

export function visaoDaSituacao(args: {
  turno: Pick<LabTurno, "numero" | "marco" | "texto" | "opcoes" | "apresentadaEm">;
  consequenciaAnterior: string | null;
  tempoLimiteS: number;
  agora: Date;
}): SituacaoVisivel {
  const { turno, consequenciaAnterior, tempoLimiteS, agora } = args;
  const decorridoMs = Math.max(0, agora.getTime() - turno.apresentadaEm.getTime());
  return {
    numero: turno.numero,
    marco: turno.marco,
    texto: turno.texto,
    opcoes: opcoesDoBanco.parse(turno.opcoes).map((o) => ({ id: o.id, texto: o.texto })),
    consequencia: consequenciaAnterior,
    tempoLimiteS,
    tempoRestanteMs: Math.max(0, tempoLimiteS * 1000 - decorridoMs)
  };
}

// ---------------------------------------------------------------------------
// Depois do último turno
// ---------------------------------------------------------------------------

export type SituacaoDoResultado = {
  numero: number;
  marco: boolean;
  texto: string;
  opcoes: OpcaoVisivel[];
  /** A opção escolhida; nula quando o tempo esgotou. */
  escolha: LabEscolha | null;
  tempoEsgotado: boolean;
  aderencia: number;
  tempoRespostaMs: number | null;
  justificativa: string | null;
  consequencia: string | null;
};

export type NivelDeSkillVisivel = {
  skillId: string;
  nome: string;
  tipo: LabSkillTipo | null;
  nivel: number;
  media: number;
  /** Quantas escolhas sustentam o nível. */
  nEvidencias: number;
};

export type VisaoDoResultado = {
  resultadoId: string;
  sessaoId: string;
  concluidaEm: string | null;
  /** "aguardando_validacao" aparece como selo: o curador ainda não revisou. */
  statusValidacao: LabStatusValidacao;
  aderenciaGeral: number;
  agilidade: number;
  niveisPorSkill: NivelDeSkillVisivel[];
  resumo: string;
  pontoForte: string | null;
  pontoDesenvolvimento: string | null;
  sugestoes: string[];
  situacoes: SituacaoDoResultado[];
};

const niveisDoBanco = z.record(
  z.string(),
  z.object({ nivel: z.int().min(1).max(5), media: z.number(), nEvidencias: z.int().min(1) })
);
const textosDoBanco = z.array(z.string());

export function visaoDoResultado(args: {
  sessao: Pick<LabSessao, "id" | "concluidaEm">;
  resultado: Pick<
    LabResultado,
    | "id"
    | "statusValidacao"
    | "aderenciaGeral"
    | "agilidade"
    | "niveisPorSkill"
    | "resumo"
    | "pontoForte"
    | "pontoDesenvolvimento"
    | "sugestoes"
  >;
  turnos: ReadonlyArray<
    Pick<
      LabTurno,
      | "numero"
      | "marco"
      | "texto"
      | "opcoes"
      | "escolha"
      | "tempoEsgotado"
      | "aderencia"
      | "tempoRespostaMs"
      | "justificativa"
      | "consequencia"
    >
  >;
}): VisaoDoResultado {
  const { sessao, resultado, turnos } = args;
  const niveis = niveisDoBanco.parse(resultado.niveisPorSkill);
  const ordem = new Map<string, number>(labSkillsPiloto.map((s, i) => [s.id, i]));

  return {
    resultadoId: resultado.id,
    sessaoId: sessao.id,
    concluidaEm: sessao.concluidaEm?.toISOString() ?? null,
    statusValidacao: resultado.statusValidacao as LabStatusValidacao,
    aderenciaGeral: resultado.aderenciaGeral,
    agilidade: resultado.agilidade,
    niveisPorSkill: Object.entries(niveis)
      .map(([skillId, n]) => {
        const conhecida = labSkillsPiloto.find((s) => s.id === skillId);
        return {
          skillId,
          nome: conhecida?.nome ?? skillId,
          tipo: conhecida?.tipo ?? null,
          nivel: n.nivel,
          media: n.media,
          nEvidencias: n.nEvidencias
        };
      })
      .sort((a, b) => (ordem.get(a.skillId) ?? 99) - (ordem.get(b.skillId) ?? 99)),
    resumo: resultado.resumo,
    pontoForte: resultado.pontoForte,
    pontoDesenvolvimento: resultado.pontoDesenvolvimento,
    sugestoes: textosDoBanco.parse(resultado.sugestoes),
    situacoes: [...turnos]
      .sort((a, b) => a.numero - b.numero)
      .map((t) => ({
        numero: t.numero,
        marco: t.marco,
        texto: t.texto,
        opcoes: opcoesDoBanco.parse(t.opcoes).map((o) => ({ id: o.id, texto: o.texto })),
        escolha: (t.escolha as LabEscolha | null) ?? null,
        tempoEsgotado: t.tempoEsgotado,
        aderencia: t.aderencia ?? 0,
        tempoRespostaMs: t.tempoRespostaMs,
        justificativa: t.justificativa,
        consequencia: t.consequencia
      }))
  };
}
