// Leadership Lab — filtros, tendência e detalhamento da visão geral do RH. Puro: recebe a lista de
// resultados que a API já entrega (e já limita às turmas do curador) e devolve recortes dela. Nada aqui
// amplia o que o curador pode ver; só escolhe um pedaço do que ele já vê.
import { arredondar, type LabItemDaRevisao, type LabStatusValidacao } from "@my-flux/shared";

export const periodos = ["7d", "30d", "90d", "tudo"] as const;
export type Periodo = (typeof periodos)[number];
export const rotulosDoPeriodo: Record<Periodo, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  tudo: "Tudo"
};
const DIAS: Record<Exclude<Periodo, "tudo">, number> = { "7d": 7, "30d": 30, "90d": 90 };
const DIA_MS = 86_400_000;

export type FiltrosDaVisaoGeral = {
  periodo: Periodo;
  /** Só os participantes da turma escolhida (nulo: todas as turmas). */
  turmaId: string | null;
  /** O nome do teste (molde), como vem na lista. */
  teste: string | null;
  status: "todos" | LabStatusValidacao;
  participanteId: string | null;
};

export const filtrosPadrao: FiltrosDaVisaoGeral = {
  periodo: "tudo",
  turmaId: null,
  teste: null,
  status: "todos",
  participanteId: null
};

export function haFiltroAtivo(f: FiltrosDaVisaoGeral): boolean {
  return (Object.keys(filtrosPadrao) as (keyof FiltrosDaVisaoGeral)[]).some(
    (k) => f[k] !== filtrosPadrao[k]
  );
}

type Contexto = {
  /** Os participantes da turma do filtro; só é lido quando há turma escolhida. */
  participantesDaTurma: ReadonlySet<string> | null;
  agora: Date;
};

const media = (valores: readonly number[]): number | null =>
  valores.length === 0 ? null : arredondar(valores.reduce((s, v) => s + v, 0) / valores.length, 1);

function passa(
  item: LabItemDaRevisao,
  f: FiltrosDaVisaoGeral,
  c: Contexto,
  janela?: { de: number; ate: number }
): boolean {
  const quando = new Date(item.concluidaEm).getTime();
  if (janela) {
    if (quando < janela.de || quando >= janela.ate) return false;
  } else if (f.periodo !== "tudo" && quando < c.agora.getTime() - DIAS[f.periodo] * DIA_MS) {
    return false;
  }
  // Turma escolhida sem a lista de participantes ainda carregada: nada passa (falha fechado).
  if (f.turmaId !== null && !(c.participantesDaTurma?.has(item.participante.id) ?? false)) {
    return false;
  }
  if (f.teste !== null && item.moldeNome !== f.teste) return false;
  if (f.status !== "todos" && item.statusValidacao !== f.status) return false;
  if (f.participanteId !== null && item.participante.id !== f.participanteId) return false;
  return true;
}

export function filtrarResultados(
  itens: readonly LabItemDaRevisao[],
  filtros: FiltrosDaVisaoGeral,
  contexto: Contexto
): LabItemDaRevisao[] {
  return itens.filter((i) => passa(i, filtros, contexto));
}

/**
 * Os resultados da janela de mesmo tamanho imediatamente antes do período, com os outros filtros
 * aplicados igualmente. Nulo em "Tudo": não há "antes" para comparar.
 */
export function resultadosDoPeriodoAnterior(
  itens: readonly LabItemDaRevisao[],
  filtros: FiltrosDaVisaoGeral,
  contexto: Contexto
): LabItemDaRevisao[] | null {
  if (filtros.periodo === "tudo") return null;
  const dias = DIAS[filtros.periodo] * DIA_MS;
  const fim = contexto.agora.getTime() - dias;
  const janela = { de: fim - dias, ate: fim };
  return itens.filter((i) => passa(i, filtros, contexto, janela));
}

/** Diferença, em pontos, entre a média atual e a anterior; nula se faltar uma das duas. */
export function variacaoEmPontos(atual: number | null, anterior: number | null): number | null {
  return atual === null || anterior === null ? null : arredondar(atual - anterior, 1);
}

export type Granularidade = "dia" | "semana" | "mes";
export const granularidadeDoPeriodo = (p: Periodo): Granularidade =>
  p === "7d" ? "dia" : p === "tudo" ? "mes" : "semana";

export type PontoDaTendencia = {
  /** "2026-03-09" (o dia, ou a segunda-feira da semana) ou "2026-03" (o mês). */
  chave: string;
  rotulo: string;
  resultados: number;
  aderencia: number;
  agilidade: number;
};

const dois = (n: number) => String(n).padStart(2, "0");

/** A chave do intervalo a que a data pertence. A semana começa na segunda-feira. */
export function chaveDoIntervalo(iso: string, g: Granularidade): string {
  const d = new Date(iso);
  if (g === "mes") return `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
  if (g === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

function rotuloDoIntervalo(chave: string, g: Granularidade): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const data = new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1);
  const formato = new Intl.DateTimeFormat(
    "pt-BR",
    g === "mes" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" }
  );
  const texto = formato.format(data).replace(/\./g, "");
  return g === "semana" ? `Sem. ${texto}` : texto;
}

/** A média de aderência e de agilidade de cada intervalo, do mais antigo ao mais novo. */
export function tendenciaDosResultados(
  itens: readonly LabItemDaRevisao[],
  g: Granularidade
): PontoDaTendencia[] {
  const grupos = new Map<string, LabItemDaRevisao[]>();
  for (const item of itens) {
    const chave = chaveDoIntervalo(item.concluidaEm, g);
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, grupo]) => ({
      chave,
      rotulo: rotuloDoIntervalo(chave, g),
      resultados: grupo.length,
      aderencia: media(grupo.map((i) => i.aderenciaGeral)) ?? 0,
      agilidade: media(grupo.map((i) => i.agilidade)) ?? 0
    }));
}

export type MotivoDeAtencao = "alerta" | "contestacao" | "validacao-atrasada";
export type ItemDeAtencao = { item: LabItemDaRevisao; motivos: MotivoDeAtencao[] };
/** Um resultado aguardando validação há mais que isto passa a pedir atenção. */
export const DIAS_PARA_ATRASO_DA_VALIDACAO = 3;

export const rotulosDoMotivo: Record<MotivoDeAtencao, string> = {
  alerta: "Alerta aberto",
  contestacao: "Contestação pendente",
  "validacao-atrasada": "Validação parada"
};

/** O que pede atenção do curador: alerta aberto, contestação pendente ou validação parada. */
export function itensDeAtencao(itens: readonly LabItemDaRevisao[], agora: Date): ItemDeAtencao[] {
  const limite = agora.getTime() - DIAS_PARA_ATRASO_DA_VALIDACAO * DIA_MS;
  return itens
    .flatMap((item): ItemDeAtencao[] => {
      const motivos: MotivoDeAtencao[] = [];
      if (item.alertasAbertos > 0) motivos.push("alerta");
      if (item.contestacoesPendentes > 0) motivos.push("contestacao");
      if (
        item.statusValidacao === "aguardando_validacao" &&
        new Date(item.concluidaEm).getTime() < limite
      ) {
        motivos.push("validacao-atrasada");
      }
      return motivos.length > 0 ? [{ item, motivos }] : [];
    })
    .sort(
      (a, b) =>
        b.motivos.length - a.motivos.length || a.item.concluidaEm.localeCompare(b.item.concluidaEm)
    );
}

export function opcoesDeTeste(itens: readonly LabItemDaRevisao[]): string[] {
  return [...new Set(itens.map((i) => i.moldeNome))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function opcoesDeParticipante(
  itens: readonly LabItemDaRevisao[]
): { id: string; nome: string }[] {
  const mapa = new Map(itens.map((i) => [i.participante.id, i.participante.nome]));
  return [...mapa.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
