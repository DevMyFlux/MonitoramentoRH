// Leadership Lab — IA falsa, SÓ para testes e desenvolvimento local.
//
// Obedece ao contrato (ia-contrato.ts) e é rigorosa com o que recebe: cada requisição passa
// pelos schemas estritos, então um campo a mais que o motor mandasse (dado pessoal, nota)
// derruba o teste. Guarda o corpo de tudo o que recebeu em `corpos`, para auditar que nada
// pessoal chegou à IA.
//
// Também sabe falhar sob comando: erro de rede, tempo esgotado, resposta fora do contrato,
// resposta adulterada, e segurar uma chamada para testar requisições simultâneas.
//
// Não é importada por nenhum código de produção; o bundle do servidor não a inclui.
import type { LabEscolha, LabEstilo } from "@my-flux/shared";
import {
  conversaIaRequestSchema,
  guardaIaRequestSchema,
  iniciarSessaoIaRequestSchema,
  proximoTurnoIaRequestSchema
} from "../ia/ia-contrato.js";
import type { ClienteIa } from "./cliente-ia.js";

type Json = Record<string, unknown>;

/** Único entre instâncias: os testes compartilham um banco, e ia_sessao_id é único. */
let contadorDeSessoes = 0;

/** Aparece na justificativa de toda avaliação: não pode vazar para o participante durante o teste. */
export const CANARIO_JUSTIFICATIVA = "SEGREDO-DA-AVALIACAO";

export type Roteiro = {
  aderencia(numero: number, escolha: LabEscolha): 100 | 70 | 40 | 10;
  skills(numero: number): string[];
  estilo(numero: number): LabEstilo | null;
  estiloAdequado(numero: number): LabEstilo;
  contribuicao(numero: number): string | null;
};

/** A=100, B=70, C=40. Skills e estilos fixos por situação. */
export const roteiroPadrao: Roteiro = {
  aderencia: (_n, escolha) => ({ A: 100, B: 70, C: 40 })[escolha] as 100 | 70 | 40,
  skills: (n) => [
    ["gestao-os", "comunicacao-cliente", "delegacao", "gestao-equipe", "contingencia"][n - 1] ??
      "gestao-os"
  ],
  estilo: (n) => (n === 4 ? null : "orientacao"),
  estiloAdequado: () => "orientacao",
  contribuicao: () => null
};

export type TipoDeFalha = "erro" | "timeout" | "invalida";
export type AlvoDaFalha = "abrir" | "turno" | "guarda" | "conversa";
export type DecisaoDaGuardaFalsa = "seguir" | "mascarar" | "bloquear" | "invalida" | "erro";

export class IaFalsa implements ClienteIa {
  readonly chamadas = { abrir: 0, turno: 0, guarda: 0, conversa: 0 };
  /** O corpo, em JSON, de cada requisição recebida. */
  readonly corpos: string[] = [];
  /** O mesmo, separado por tipo de chamada. */
  readonly corposPorAlvo: Record<AlvoDaFalha, string[]> = {
    abrir: [],
    turno: [],
    guarda: [],
    conversa: []
  };
  /** O que o facilitador falso responde. */
  respostaDaConversa = "Resposta do facilitador falso.";
  /** As fontes que o facilitador falso cita. */
  fontesDaConversa: Array<Record<string, unknown>> = [];
  roteiro: Roteiro = roteiroPadrao;
  decisaoDaGuarda: DecisaoDaGuardaFalsa = "seguir";

  private readonly sessoes = new Map<string, { total: number; molde: string }>();
  private readonly falhas: Array<{ alvo: AlvoDaFalha; tipo: TipoDeFalha }> = [];
  private readonly adulteracoes: Array<(resposta: Json) => Json> = [];
  private readonly portoes: Array<Promise<void>> = [];
  private readonly portoesDeAbertura: Array<Promise<void>> = [];

  /** A próxima `vezes` chamadas ao alvo falham do jeito pedido. */
  falharNa(alvo: AlvoDaFalha, tipo: TipoDeFalha, vezes = 1): this {
    for (let i = 0; i < vezes; i++) this.falhas.push({ alvo, tipo });
    return this;
  }

  /** A próxima resposta de turno sai alterada por `alterar` (para testar o contrato). */
  adulterarProximoTurno(alterar: (resposta: Json) => Json): this {
    this.adulteracoes.push(alterar);
    return this;
  }

  /** Faz a próxima chamada de turno esperar até `liberar()` ser chamado. */
  segurarProximoTurno(): () => void {
    let liberar!: () => void;
    this.portoes.push(new Promise<void>((resolver) => (liberar = resolver)));
    return liberar;
  }

  private registrar(alvo: AlvoDaFalha, corpo: unknown): void {
    const json = JSON.stringify(corpo);
    this.corpos.push(json);
    this.corposPorAlvo[alvo].push(json);
  }

  /** Faz a próxima abertura de sessão esperar até `liberar()` ser chamado. */
  segurarProximaAbertura(): () => void {
    let liberar!: () => void;
    this.portoesDeAbertura.push(new Promise<void>((resolver) => (liberar = resolver)));
    return liberar;
  }

  private falhaPendente(alvo: AlvoDaFalha): TipoDeFalha | undefined {
    const i = this.falhas.findIndex((f) => f.alvo === alvo);
    return i < 0 ? undefined : this.falhas.splice(i, 1)[0]?.tipo;
  }

  private lancar(tipo: TipoDeFalha): void {
    if (tipo === "timeout") {
      const erro = new Error("tempo esgotado ao chamar a IA");
      erro.name = "TimeoutError";
      throw erro;
    }
    if (tipo === "erro") throw new Error("IA indisponível (503)");
  }

  async abrirSessao(corpo: unknown): Promise<unknown> {
    this.chamadas.abrir++;
    this.registrar("abrir", corpo);
    const pedido = iniciarSessaoIaRequestSchema.parse(corpo);

    const portao = this.portoesDeAbertura.shift();
    if (portao) await portao;

    const falha = this.falhaPendente("abrir");
    if (falha) {
      this.lancar(falha);
      return { lixo: true };
    }

    const sessaoId = `ses_falsa_${++contadorDeSessoes}`;
    this.sessoes.set(sessaoId, { total: pedido.numero_situacoes, molde: pedido.molde });
    return {
      sessao_id: sessaoId,
      tipo: "situacao",
      avaliacao_anterior: null,
      consequencia: null,
      situacao: this.situacao(1, pedido.molde),
      resultado: null,
      uso: this.uso("agente_lab")
    };
  }

  async proximoTurno(corpo: unknown): Promise<unknown> {
    this.chamadas.turno++;
    this.registrar("turno", corpo);
    const pedido = proximoTurnoIaRequestSchema.parse(corpo);

    const portao = this.portoes.shift();
    if (portao) await portao;

    const falha = this.falhaPendente("turno");
    if (falha) {
      this.lancar(falha);
      return { lixo: true };
    }

    const sessao = this.sessoes.get(pedido.sessao_id);
    if (!sessao) throw new Error(`IaFalsa: sessão desconhecida ${pedido.sessao_id}`);

    const numero = pedido.numero;
    const omissao = pedido.escolha === null;
    const aderencia = omissao ? 0 : this.roteiro.aderencia(numero, pedido.escolha as LabEscolha);
    const ultima = numero === sessao.total;

    let resposta: Json = {
      tipo: ultima ? "resultado" : "situacao",
      avaliacao_anterior: {
        numero,
        escolha: pedido.escolha,
        aderencia,
        estilo: this.roteiro.estilo(numero),
        skills: this.roteiro.skills(numero),
        alerta: aderencia === 10 ? "vermelho" : null,
        contribuicao: this.roteiro.contribuicao(numero),
        justificativa: `${CANARIO_JUSTIFICATIVA}-${numero}`
      },
      consequencia: `[efeito-${numero}] ${omissao ? "Como ninguém decidiu, o problema cresceu." : "A equipe reagiu à sua decisão."}`,
      situacao: ultima ? null : this.situacao(numero + 1, sessao.molde),
      resultado: ultima
        ? {
            resumo: "Você conduziu o turno com atenção ao cliente e à equipe.",
            ponto_forte: "Comunicação com o solicitante.",
            ponto_desenvolvimento: "Registrar as decisões na hora.",
            sugestoes: ["Registre o aviso ao solicitante antes de remarcar."],
            contribuicoes: []
          }
        : null,
      uso: this.uso("agente_lab")
    };

    const adulterar = this.adulteracoes.shift();
    if (adulterar) resposta = adulterar(resposta);
    return resposta;
  }

  async guarda(corpo: unknown): Promise<unknown> {
    this.chamadas.guarda++;
    this.registrar("guarda", corpo);
    const pedido = guardaIaRequestSchema.parse(corpo);

    const falha = this.falhaPendente("guarda");
    if (falha) {
      this.lancar(falha);
      return { lixo: true };
    }

    const uso = this.uso("guarda");
    switch (this.decisaoDaGuarda) {
      case "erro":
        throw new Error("Guarda indisponível (503)");
      case "invalida":
        return { decisao: "liberar", uso };
      case "seguir":
        return { decisao: "seguir", texto: null, uso };
      case "bloquear":
        return { decisao: "bloquear", texto: null, uso };
      case "mascarar":
        return {
          decisao: "mascarar",
          texto: `[mascarado] ${pedido.texto.split(/\s+/).slice(0, 3).join(" ")}`,
          uso
        };
    }
  }

  async conversar(corpo: unknown): Promise<unknown> {
    this.chamadas.conversa++;
    this.registrar("conversa", corpo);
    conversaIaRequestSchema.parse(corpo);

    const falha = this.falhaPendente("conversa");
    if (falha) {
      this.lancar(falha);
      return { lixo: true };
    }
    return {
      resposta: this.respostaDaConversa,
      fontes: this.fontesDaConversa,
      uso: this.uso("facilitador")
    };
  }

  private uso(agente: string): Json {
    return {
      agente,
      modelo: "modelo-falso",
      versao_instrucao: "falsa-1",
      tokens_entrada: 100,
      tokens_saida: 50
    };
  }

  private situacao(numero: number, molde: string): Json {
    return {
      numero,
      marco: numero === 3,
      estilo_adequado: this.roteiro.estiloAdequado(numero),
      texto: `[situacao-${numero}] Cenário do molde ${molde}: a equipe precisa decidir o que fazer agora.`,
      opcoes: [
        { id: "A", texto: `Opção A da situação ${numero}.` },
        { id: "B", texto: `Opção B da situação ${numero}.` },
        { id: "C", texto: `Opção C da situação ${numero}.` }
      ]
    };
  }
}
