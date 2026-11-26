// Treinamentos Interativos — chamadas à API (/api/v1/treinamentos) e os tipos das respostas.
// Os tipos espelham o que treinamentos-servico.ts devolve. Quem decide tudo é a API: a tela só
// mostra o que recebe (e nunca recebe o gabarito antes da hora).
import type {
  TreinoBeat,
  TreinoDesfecho,
  TreinoNivel,
  TreinoPublico,
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

// --- Autoria (ADMIN, DEV) e curadoria (RH, DEV) ---

export type VersaoDaLista = {
  id: string;
  numero: number;
  scenePack: string;
  criadoEm: string;
  aprovadoEm: string | null;
  atribuicoes: number;
};
export type CenarioDaLista = {
  id: string;
  slug: string;
  area: string;
  /** O público da versão mais recente (nulo: cenário sem público). */
  publico: string | null;
  titulo: string;
  status: string;
  alteradoEm: string;
  versoes: VersaoDaLista[];
};
/** A regra de público como a tela a edita (nulo = qualquer). */
export type RegraDePublicoDaTela = {
  nivelGovernanca: "assistente" | "supervisor" | "coordenador" | "diretoria" | null;
  areaId: string | null;
  publico: TreinoPublico;
  ativa: boolean;
};
export type ItemDeQuantidade = {
  publico: TreinoPublico;
  turmaId: string | null;
  quantidade: number;
};

export type RelatorioDaImportacao = {
  criados: number;
  jaExistem: number;
  invalidos: number;
  itens: {
    indice: number;
    estado: "criado" | "ja_existe" | "invalido";
    slug: string | null;
    cenarioId?: string;
    problemas?: ProblemaDeAutoria[];
  }[];
};

export type ProblemaDeAutoria = { caminho: string; mensagem: string };
export type ValidacaoDoCenario = {
  valido: boolean;
  problemas: ProblemaDeAutoria[];
  resumo?: {
    slug: string;
    titulo: string;
    area: string;
    scenePack: string;
    exemplo: boolean;
    decisoes: number;
    acontecimentos: number;
    resultados: number;
  };
};
export type TurmaParaAtribuir = {
  id: string;
  nome: string;
  curador: string;
  participantes: number;
};
export type TentativaDoRh = {
  tentativaId: string;
  atribuicaoId: string;
  participante: string;
  turma: string;
  titulo: string;
  area: string;
  concluidaEm: string | null;
  resultados: { id: string; label: string; nivel: TreinoNivel }[];
  validada: boolean;
};
export type SituacaoDoRh = "pendentes" | "validadas" | "todas";

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
    request<TreinoDesfecho>(`${base}/tentativas/${tentativaId}/simular`, "POST", { decisoes }),
  // Autoria e configuração
  cenarios: () => request<CenarioDaLista[]>(`${base}/cenarios`),
  validarCenario: (conteudo: unknown) =>
    request<ValidacaoDoCenario>(`${base}/cenarios/validar`, "POST", { conteudo }),
  criarCenario: (conteudo: unknown) =>
    request<{ id: string; slug: string; versaoId: string; numero: number }>(
      `${base}/cenarios`,
      "POST",
      {
        conteudo
      }
    ),
  novaVersao: (cenarioId: string, conteudo: unknown) =>
    request<{ id: string; versaoId: string; numero: number }>(
      `${base}/cenarios/${cenarioId}/versoes`,
      "POST",
      { conteudo }
    ),
  lerVersao: (cenarioId: string, versaoId: string) =>
    request<{ id: string; numero: number; aprovadoEm: string | null; conteudo: unknown }>(
      `${base}/cenarios/${cenarioId}/versoes/${versaoId}`
    ),
  aprovar: (cenarioId: string, versaoId: string) =>
    request<{ versaoId: string; numero: number; aprovadoEm: string }>(
      `${base}/cenarios/${cenarioId}/aprovar`,
      "POST",
      { versaoId }
    ),
  importar: (cenarios: unknown[]) =>
    request<RelatorioDaImportacao>(`${base}/cenarios/importar`, "POST", { cenarios }),
  enviarParaRevisao: (cenarioId: string) =>
    request<{ id: string; status: string }>(`${base}/cenarios/${cenarioId}/revisao`, "POST", {}),
  aprovarEmLote: (itens: { cenarioId: string; versaoId: string }[]) =>
    request<{ aprovadas: number; recusadas: number }>(`${base}/cenarios/aprovar-em-lote`, "POST", {
      itens
    }),
  regras: () =>
    request<{
      regras: RegraDePublicoDaTela[];
      areas: { id: string; nome: string; ativa: boolean }[];
    }>(`${base}/configuracao/regras`),
  salvarRegras: (regras: RegraDePublicoDaTela[]) =>
    request<{ salvas: number }>(`${base}/configuracao/regras`, "PUT", { regras }),
  quantidades: () =>
    request<{
      padrao: number;
      itens: (ItemDeQuantidade & { turma: string | null })[];
    }>(`${base}/configuracao/quantidades`),
  salvarQuantidades: (itens: ItemDeQuantidade[]) =>
    request<{ salvas: number }>(`${base}/configuracao/quantidades`, "PUT", { itens }),
  turmas: () => request<TurmaParaAtribuir[]>(`${base}/turmas`),
  atribuir: (versaoId: string, turmaId: string, prazo: string | null) =>
    request<{ id: string }>(`${base}/atribuicoes`, "POST", { versaoId, turmaId, prazo }),
  // Curadoria
  tentativasDoRh: (situacao: SituacaoDoRh) =>
    request<TentativaDoRh[]>(`${base}/rh/tentativas?situacao=${situacao}`),
  validarTentativa: (tentativaId: string, nota: string) =>
    request<{ tentativaId: string; validadaEm: string; nota: string | null }>(
      `${base}/rh/tentativas/${tentativaId}/validar`,
      "POST",
      nota.trim() ? { nota } : {}
    )
};
