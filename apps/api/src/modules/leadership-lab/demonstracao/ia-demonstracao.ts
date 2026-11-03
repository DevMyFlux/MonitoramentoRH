// Leadership Lab — a IA de demonstração.
//
// Faz o papel do serviço de IA (as mesmas três chamadas e as mesmas respostas do contrato) com as
// situações fixas de conteudo.ts, SEM nenhum serviço externo. Existe para mostrar as telas
// funcionando enquanto o serviço real não existe; só entra com LAB_MODO_DEMO e sem LAB_IA_URL.
//
// Não guarda estado na memória: o total de situações vai dentro do identificador da sessão, então
// um teste continua certo se o servidor reiniciar ou se outra instância atender a próxima chamada.
// O texto livre é ignorado (ele nem vira contribuição para o curador): o que o participante digita
// não sai do servidor e não alimenta nada.
import { randomUUID } from "node:crypto";
import type { LabEscolha } from "@my-flux/shared";
import {
  guardaIaRequestSchema,
  iniciarSessaoIaRequestSchema,
  proximoTurnoIaRequestSchema
} from "../ia/ia-contrato.js";
import type { ClienteIa } from "../motor/cliente-ia.js";
import {
  PREFIXO_DA_DEMONSTRACAO,
  type SituacaoDeDemonstracao,
  situacoesDeDemonstracao
} from "./conteudo.js";

type Json = Record<string, unknown>;

const PREFIXO_DO_ID = "demo";

export class SessaoDeDemonstracaoInvalida extends Error {
  constructor(sessaoId: string) {
    super(`Identificador de sessão de demonstração inválido: ${sessaoId.slice(0, 40)}`);
    this.name = "SessaoDeDemonstracaoInvalida";
  }
}

/** demo.<total de situações>.<uuid> */
function totalDaSessao(sessaoId: string): number {
  const [prefixo, total, ...resto] = sessaoId.split(".");
  const n = Number(total);
  if (prefixo !== PREFIXO_DO_ID || resto.length === 0 || !Number.isInteger(n) || n < 1 || n > 10) {
    throw new SessaoDeDemonstracaoInvalida(sessaoId);
  }
  return n;
}

/** O conteúdo da situação `numero` (1 em diante). Passando de cinco, o conteúdo recomeça. */
function conteudoDa(numero: number): SituacaoDeDemonstracao {
  const conteudo = situacoesDeDemonstracao[(numero - 1) % situacoesDeDemonstracao.length];
  if (!conteudo) throw new Error(`Sem conteúdo de demonstração para a situação ${numero}.`);
  return conteudo;
}

const uso = (agente: "agente_lab" | "guarda"): Json => ({
  agente,
  modelo: "demonstracao",
  versao_instrucao: "demo-1",
  tokens_entrada: 0,
  tokens_saida: 0
});

function situacao(numero: number): Json {
  const conteudo = conteudoDa(numero);
  return {
    numero,
    marco: numero === 3,
    estilo_adequado: conteudo.estiloAdequado,
    texto: `${PREFIXO_DA_DEMONSTRACAO}${conteudo.texto}`,
    opcoes: (["A", "B", "C"] as const).map((id) => ({ id, texto: conteudo.opcoes[id].texto }))
  };
}

const RESULTADO_DE_DEMONSTRACAO = {
  resumo:
    "Este é um resultado de demonstração: o texto do resumo é o mesmo para todos. Os números, os níveis e os alertas desta tela foram calculados de verdade a partir das suas escolhas.",
  ponto_forte:
    "Demonstração: no teste real, aqui aparece o ponto forte que a IA observou nas suas escolhas.",
  ponto_desenvolvimento:
    "Demonstração: no teste real, aqui aparece o ponto a desenvolver que a IA observou nas suas escolhas.",
  sugestoes: [
    "Demonstração: no teste real, as sugestões nascem das suas escolhas.",
    "Releia cada situação e compare a sua escolha com a justificativa mostrada."
  ],
  contribuicoes: []
};

export class IaDemonstracao implements ClienteIa {
  async abrirSessao(corpo: unknown): Promise<unknown> {
    const pedido = iniciarSessaoIaRequestSchema.parse(corpo);
    return {
      sessao_id: `${PREFIXO_DO_ID}.${pedido.numero_situacoes}.${randomUUID()}`,
      tipo: "situacao",
      avaliacao_anterior: null,
      consequencia: null,
      situacao: situacao(1),
      resultado: null,
      uso: uso("agente_lab")
    };
  }

  async proximoTurno(corpo: unknown): Promise<unknown> {
    const pedido = proximoTurnoIaRequestSchema.parse(corpo);
    const total = totalDaSessao(pedido.sessao_id);
    const { numero } = pedido;
    const conteudo = conteudoDa(numero);
    const ultima = numero >= total;

    const opcao = pedido.escolha === null ? null : conteudo.opcoes[pedido.escolha as LabEscolha];
    const avaliacao = opcao
      ? {
          numero,
          escolha: pedido.escolha,
          aderencia: opcao.aderencia,
          estilo: opcao.estilo,
          skills: [...opcao.skills],
          alerta: opcao.aderencia === 10 ? "vermelho" : null,
          contribuicao: null,
          justificativa: opcao.justificativa
        }
      : {
          numero,
          escolha: null,
          aderencia: 0,
          estilo: null,
          // Uma omissão conta zero nas skills que a situação punha em jogo.
          skills: [...conteudo.skillsEmJogo],
          alerta: null,
          contribuicao: null,
          justificativa:
            "O tempo acabou antes da escolha, então a situação conta como sem resposta (aderência 0)."
        };

    return {
      tipo: ultima ? "resultado" : "situacao",
      avaliacao_anterior: avaliacao,
      consequencia: opcao
        ? opcao.consequencia
        : "Como ninguém decidiu a tempo, o problema seguiu sem resposta.",
      situacao: ultima ? null : situacao(numero + 1),
      resultado: ultima ? RESULTADO_DE_DEMONSTRACAO : null,
      uso: uso("agente_lab")
    };
  }

  async guarda(corpo: unknown): Promise<unknown> {
    guardaIaRequestSchema.parse(corpo);
    // O texto livre não sai do servidor e esta IA o ignora: seguir como está.
    return { decisao: "seguir", texto: null, uso: uso("guarda") };
  }
}
