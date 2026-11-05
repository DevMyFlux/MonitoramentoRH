// Leadership Lab — a IA de demonstração.
//
// Faz o papel do serviço de IA (as mesmas três chamadas e as mesmas respostas do contrato), SEM
// nenhum serviço externo. Existe para mostrar as telas funcionando enquanto o serviço real não
// existe; só entra com LAB_MODO_DEMO e sem LAB_IA_URL. Tem dois modos de sessão:
//
//  - simulação local (tema escolhido): percorre um cenário ramificado da biblioteca
//    (simulador/). O tema vem em `temas`; o caminho já feito vem do banco, pelo LeitorDoPercurso.
//  - demonstração geral (sem tema): as cinco situações fixas de conteudo.ts.
//
// Não guarda estado na memória: o total, o cargo e o tema vão dentro do identificador da sessão, e
// o caminho é relido do banco a cada turno, então um teste continua certo se o servidor reiniciar
// ou se outra instância atender a próxima chamada. O texto livre é ignorado (ele nem vira
// contribuição para o curador): o que o participante digita não sai do servidor e não alimenta nada.
import { randomUUID } from "node:crypto";
import type { LabEscolha } from "@my-flux/shared";
import {
  guardaIaRequestSchema,
  iniciarSessaoIaRequestSchema,
  proximoTurnoIaRequestSchema
} from "../ia/ia-contrato.js";
import type { ClienteIa } from "../motor/cliente-ia.js";
import { cenarioDe, idsDasCategorias } from "../simulador/catalogo.js";
import { nosDoPercurso, type PassoDoPercurso } from "../simulador/percurso.js";
import {
  avaliarNoDaSimulacao,
  criarIdDaSimulacao,
  ehSimulacao,
  lerIdDaSimulacao,
  resultadoDaSimulacao,
  SimulacaoInvalida,
  situacaoDaSimulacao,
  usoDoSimulador
} from "../simulador/provedor.js";
import {
  PREFIXO_DA_DEMONSTRACAO,
  type SituacaoDeDemonstracao,
  situacoesDeDemonstracao
} from "./conteudo.js";

type Json = Record<string, unknown>;

const PREFIXO_DO_ID = "demo";

type IniciarNivel = ReturnType<typeof iniciarSessaoIaRequestSchema.parse>["molde"];

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

/**
 * Lê as escolhas já gravadas de uma sessão (o que o participante respondeu em cada situação).
 * A IA de demonstração não guarda estado: refaz o caminho do cenário a partir disto.
 */
export type LeitorDoPercurso = (iaSessaoId: string) => Promise<readonly PassoDoPercurso[]>;

export class IaDemonstracao implements ClienteIa {
  constructor(private readonly leitor?: LeitorDoPercurso) {}

  async abrirSessao(corpo: unknown): Promise<unknown> {
    const pedido = iniciarSessaoIaRequestSchema.parse(corpo);
    const tema = pedido.temas.length === 1 ? pedido.temas[0] : undefined;
    if (tema !== undefined && idsDasCategorias.has(tema)) {
      return this.abrirSimulacao(pedido.molde, tema, pedido.numero_situacoes);
    }
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

  private abrirSimulacao(
    nivel: IniciarNivel,
    categoriaId: string,
    total: number
  ): Record<string, unknown> {
    const cenario = cenarioDe(categoriaId, nivel);
    if (!cenario) throw new SimulacaoInvalida(`sem cenário "${categoriaId}" para ${nivel}`);
    if (total !== 5) throw new SimulacaoInvalida("a simulação local tem exatamente 5 situações");
    const nos = nosDoPercurso(cenario, [], 1);
    return {
      sessao_id: criarIdDaSimulacao({ total, nivel, categoriaId }),
      tipo: "situacao",
      avaliacao_anterior: null,
      consequencia: null,
      situacao: situacaoDaSimulacao({ cenario, nivel, numero: 1, nos, escolhas: [] }),
      resultado: null,
      uso: usoDoSimulador()
    };
  }

  private async proximoTurnoDaSimulacao(
    pedido: ReturnType<typeof proximoTurnoIaRequestSchema.parse>
  ): Promise<Record<string, unknown>> {
    if (!this.leitor) throw new SimulacaoInvalida("sem leitor do percurso");
    const { total, nivel, categoriaId } = lerIdDaSimulacao(pedido.sessao_id);
    const cenario = cenarioDe(categoriaId, nivel);
    if (!cenario) throw new SimulacaoInvalida(`sem cenário "${categoriaId}" para ${nivel}`);
    const { numero } = pedido;

    const gravados = await this.leitor(pedido.sessao_id);
    // A escolha da situação atual vem no pedido; as anteriores, do banco.
    const passos: PassoDoPercurso[] = [
      ...gravados.filter((p) => p.numero < numero),
      { numero, escolha: pedido.escolha as LabEscolha | null }
    ];
    const nos = nosDoPercurso(cenario, passos, numero);
    const no = nos[numero - 1];
    if (!no) throw new SimulacaoInvalida(`sem nó para a situação ${numero}`);
    const escolhas = passos.map((p) => p.escolha);

    const { avaliacao, consequencia } = avaliarNoDaSimulacao(
      no,
      numero,
      passos[numero - 1]?.escolha ?? null
    );
    if (numero >= total) {
      return {
        tipo: "resultado",
        avaliacao_anterior: avaliacao,
        consequencia,
        situacao: null,
        resultado: resultadoDaSimulacao(cenario, nos, escolhas),
        uso: usoDoSimulador()
      };
    }
    const proximos = nosDoPercurso(cenario, passos, numero + 1);
    return {
      tipo: "situacao",
      avaliacao_anterior: avaliacao,
      consequencia,
      situacao: situacaoDaSimulacao({
        cenario,
        nivel,
        numero: numero + 1,
        nos: proximos,
        escolhas
      }),
      resultado: null,
      uso: usoDoSimulador()
    };
  }

  async proximoTurno(corpo: unknown): Promise<unknown> {
    const pedido = proximoTurnoIaRequestSchema.parse(corpo);
    if (ehSimulacao(pedido.sessao_id)) return this.proximoTurnoDaSimulacao(pedido);
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
