// Leadership Lab — o cliente das rotas do participante.
//
// Toda resposta passa pelo schema compartilhado (packages/shared) antes de chegar a uma tela: se a
// API mandar um formato inesperado, o erro é claro e acontece aqui, não no meio de uma renderização.
// O schema também descarta o que não é do contrato, então um campo de avaliação que vazasse da API
// durante o teste nunca chegaria a ser exibido.
import {
  type LabEscolha,
  type LabClassificarEntrada,
  labAceiteDoTermoSchema,
  type LabConversaEntrada,
  labClassificacaoSchema,
  labConversaRespostaSchema,
  labEstadoDoTesteSchema,
  labPainelSchema,
  labRespostaDoTesteSchema,
  labResultadoSchema,
  labTemasSimuladosSchema
} from "@my-flux/shared";
import type { ZodType } from "zod";
import { request } from "../my-flux/client";

export class RespostaInesperadaError extends Error {
  readonly caminho: string;
  readonly problemas: string[];

  constructor(caminho: string, problemas: string[]) {
    super(`A resposta de ${caminho} não segue o contrato: ${problemas.join("; ")}`);
    this.name = "RespostaInesperadaError";
    this.caminho = caminho;
    this.problemas = problemas;
  }
}

export type MetodoHttp = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Chama a API do módulo e confere a resposta com o schema compartilhado. */
export async function chamar<T>(
  schema: ZodType<T>,
  metodo: MetodoHttp,
  caminho: string,
  corpo?: unknown
): Promise<T> {
  const bruto = await request<unknown>(`/leadership-lab${caminho}`, metodo, corpo);
  const lido = schema.safeParse(bruto);
  if (!lido.success) {
    throw new RespostaInesperadaError(
      caminho,
      lido.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
    );
  }
  return lido.data;
}

export type EntradaDeResposta = {
  numero: number;
  escolha: LabEscolha;
  /** Só vai se o participante escreveu algo; em branco, omita. */
  textoLivre?: string;
};

const daSessao = (sessaoId: string) => `/sessoes/${encodeURIComponent(sessaoId)}`;

export const labApi = {
  painel: () => chamar(labPainelSchema, "GET", "/painel"),
  aceitarTermo: () => chamar(labAceiteDoTermoSchema, "POST", "/termo"),
  /** Inicia um teste, ou retoma o que está em andamento. Só deve ser chamado por um clique. */
  iniciarTeste: (categoriaId?: string) =>
    chamar(
      labRespostaDoTesteSchema,
      "POST",
      "/sessoes",
      categoriaId === undefined ? undefined : { categoriaId }
    ),
  /** Simulação local (modo demonstração): os temas disponíveis. */
  temasSimulados: () => chamar(labTemasSimuladosSchema, "GET", "/simulador/temas"),
  /** Propõe um tema a partir do texto. O texto só viaja nesta chamada: o servidor não o guarda. */
  classificarProblema: (entrada: LabClassificarEntrada) =>
    chamar(labClassificacaoSchema, "POST", "/simulador/classificar", entrada),
  /** Só lê: nunca começa um teste. É o que a tela do teste usa ao abrir e ao recarregar. */
  testeEmAndamento: () => chamar(labEstadoDoTesteSchema, "GET", "/sessoes/atual"),
  responder: (sessaoId: string, entrada: EntradaDeResposta) =>
    chamar(labRespostaDoTesteSchema, "POST", `${daSessao(sessaoId)}/respostas`, entrada),
  tempoEsgotado: (sessaoId: string, numero: number) =>
    chamar(labRespostaDoTesteSchema, "POST", `${daSessao(sessaoId)}/tempo-esgotado`, { numero }),
  /** Conversa com o facilitador sobre o próprio resultado. Nada da conversa é guardado. */
  conversar: (sessaoId: string, entrada: LabConversaEntrada) =>
    chamar(labConversaRespostaSchema, "POST", `${daSessao(sessaoId)}/conversa`, entrada),
  /** Espaço de aprendizagem: dúvidas ao facilitador fora do teste. Nada é guardado. */
  aprender: (entrada: LabConversaEntrada) =>
    chamar(labConversaRespostaSchema, "POST", "/aprendizagem/conversa", entrada),
  resultado: (sessaoId: string) =>
    chamar(labResultadoSchema, "GET", `${daSessao(sessaoId)}/resultado`)
};
