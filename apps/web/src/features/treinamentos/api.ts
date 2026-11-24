// Treinamentos Interativos — chamadas à API (/api/v1/treinamentos) e os tipos das respostas.
// Os tipos espelham o que treinamentos-servico.ts devolve. Quem decide tudo é a API: a tela só
// mostra o que recebe (e nunca recebe o gabarito antes da hora).
import type {
  TreinoBeat,
  TreinoDesfecho,
  TreinoNivel,
  TreinoRegra,
  TreinoVisaoDoParticipante
} from "@my-flux/shared";
import { request } from "../my-flux/client";

export type ItemAberto = {
  atribuicaoId: string;
  titulo: string;
  area: string;
  exemplo: boolean;
  turma: string;
  prazo: string | null;
  emAndamento: { tentativaId: string; respondidas: number } | null;
  concluidas: number;
};

export type ItemDoHistorico = {
  tentativaId: string;
  atribuicaoId: string;
  titulo: string;
  concluidaEm: string | null;
  resultados: { id: string; label: string; nivel: TreinoNivel; texto: string }[];
  validada: boolean;
};

export type Minhas = { abertas: ItemAberto[]; historico: ItemDoHistorico[] };

export type RespostaDada = { perguntaId: string; alternativa: number; reacao: TreinoBeat };

export type EstadoDaAtribuicao = {
  atribuicao: { id: string; turma: string; prazo: string | null };
  cenario: TreinoVisaoDoParticipante;
  tentativa: { id: string; iniciadaEm: string; respostas: RespostaDada[] } | null;
  retomada?: boolean;
};

export type RespostaDoServidor = RespostaDada & { respondidas: number };

export type ResultadoDaTentativa = {
  tentativaId: string;
  atribuicaoId: string;
  acesso: "dono" | "curador";
  participante?: string;
  turma: string;
  iniciadaEm: string;
  concluidaEm: string | null;
  cenario: { titulo: string; area: string; exemplo: boolean; scenePack: string; versao: number };
  decisoes: { id: string; label: string; procedure: string; cumpriu: boolean }[];
  respostas: {
    perguntaId: string;
    decisao: string | null;
    prompt: string;
    alternativa: number;
    texto: string;
    reacao: TreinoBeat;
  }[];
  desfecho: TreinoDesfecho;
  regras: {
    events: {
      id: string;
      label: string;
      tone: "good" | "bad";
      when: TreinoRegra;
      scene: Record<string, string>;
    }[];
    outcomes: {
      id: string;
      label: string;
      levels: { ok: string; warn: string; bad: string };
      when: { ok: TreinoRegra; warn: TreinoRegra };
    }[];
  };
  validacao: { validada: boolean; validadaEm: string | null; nota: string | null };
};

const base = "/treinamentos";

export const apiDosTreinamentos = {
  minhas: () => request<Minhas>(`${base}/minhas`),
  lerAtribuicao: (id: string) => request<EstadoDaAtribuicao>(`${base}/atribuicoes/${id}`),
  iniciar: (id: string) =>
    request<EstadoDaAtribuicao>(`${base}/atribuicoes/${id}/tentativas`, "POST", {}),
  responder: (tentativaId: string, perguntaId: string, alternativa: number) =>
    request<RespostaDoServidor>(`${base}/tentativas/${tentativaId}/respostas`, "POST", {
      perguntaId,
      alternativa
    }),
  concluir: (tentativaId: string) =>
    request<ResultadoDaTentativa>(`${base}/tentativas/${tentativaId}/concluir`, "POST", {}),
  resultado: (tentativaId: string) =>
    request<ResultadoDaTentativa>(`${base}/tentativas/${tentativaId}/resultado`),
  simular: (tentativaId: string, decisoes: Record<string, boolean>) =>
    request<TreinoDesfecho>(`${base}/tentativas/${tentativaId}/simular`, "POST", { decisoes })
};
