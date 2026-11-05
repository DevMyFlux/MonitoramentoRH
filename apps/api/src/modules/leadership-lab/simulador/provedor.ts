// Leadership Lab — o provedor local de situações: traduz um cenário da biblioteca nas respostas do
// contrato da IA. É a peça que o provedor real (Gemini) vai substituir, sem mexer no motor nem na
// tela: as respostas têm exatamente a mesma forma.
//
// Tudo aqui é puro. A avaliação sai da opção escolhida (dados do cenário), nunca de texto livre.
import { randomUUID } from "node:crypto";
import { type LabEscolha, type LabMoldeNivel, labMoldeNiveis } from "@my-flux/shared";
import { CAMADAS_DO_CENARIO, type CenarioDaBiblioteca, type NoDoCenario } from "./tipos.js";

export const PREFIXO_DA_SIMULACAO = "(Simulação local) ";
const PREFIXO_DO_ID = "sim";

type Json = Record<string, unknown>;

export type IdDaSimulacao = { total: number; nivel: LabMoldeNivel; categoriaId: string };

export class SimulacaoInvalida extends Error {
  constructor(motivo: string) {
    super(`Simulação local inválida: ${motivo}`);
    this.name = "SimulacaoInvalida";
  }
}

/** sim.<total>.<cargo>.<tema>.<uuid>: o cenário inteiro vem do identificador, sem estado em memória. */
export function criarIdDaSimulacao(args: IdDaSimulacao): string {
  return [PREFIXO_DO_ID, args.total, args.nivel, args.categoriaId, randomUUID()].join(".");
}

export function ehSimulacao(sessaoId: string): boolean {
  return sessaoId.startsWith(`${PREFIXO_DO_ID}.`);
}

export function lerIdDaSimulacao(sessaoId: string): IdDaSimulacao {
  const [prefixo, total, nivel, categoriaId, ...resto] = sessaoId.split(".");
  const n = Number(total);
  const nivelValido = labMoldeNiveis.find((x) => x === nivel);
  if (
    prefixo !== PREFIXO_DO_ID ||
    resto.length !== 1 ||
    n !== CAMADAS_DO_CENARIO ||
    !nivelValido ||
    !categoriaId
  ) {
    throw new SimulacaoInvalida(sessaoId.slice(0, 60));
  }
  return { total: n, nivel: nivelValido, categoriaId };
}

const uso = (agente: "agente_lab"): Json => ({
  agente,
  modelo: "simulador-local",
  versao_instrucao: "simulador-1",
  tokens_entrada: 0,
  tokens_saida: 0
});
export const usoDoSimulador = (): Json => uso("agente_lab");

/** A situação `numero` a partir do nó. A 3 (o marco) recorda o que o participante já fez. */
export function situacaoDaSimulacao(args: {
  cenario: CenarioDaBiblioteca;
  nivel: LabMoldeNivel;
  numero: number;
  nos: readonly NoDoCenario[];
  escolhas: ReadonlyArray<LabEscolha | null>;
}): Json {
  const { cenario, nivel, numero, nos, escolhas } = args;
  const no = nos[numero - 1];
  if (!no) throw new SimulacaoInvalida(`sem nó para a situação ${numero}`);
  const corpo =
    numero === 1
      ? cenario.aberturas[nivel]
      : numero === 3
        ? `${recordacao(nos, escolhas)} ${no.contexto}`
        : no.contexto;
  return {
    numero,
    marco: numero === 3,
    estilo_adequado: no.estiloAdequado,
    texto: `${PREFIXO_DA_SIMULACAO}${corpo}`,
    opcoes: (["A", "B", "C"] as const).map((id) => ({ id, texto: no.opcoes[id].texto }))
  };
}

/** "Até aqui, você alinhou com a responsável e montou um plano." Só com as escolhas 1 e 2. */
function recordacao(
  nos: readonly NoDoCenario[],
  escolhas: ReadonlyArray<LabEscolha | null>
): string {
  const feitas = [0, 1].map((i) => resumoDaEscolha(nos[i], escolhas[i]));
  return `Até aqui, você ${feitas[0]} e ${feitas[1]}.`;
}

function resumoDaEscolha(
  no: NoDoCenario | undefined,
  escolha: LabEscolha | null | undefined
): string {
  if (!no) throw new SimulacaoInvalida("percurso curto demais para o marco");
  return escolha ? no.opcoes[escolha].resumo : "não decidiu a tempo";
}

/** A avaliação e a consequência da escolha (ou da omissão) feita no último nó de `nos`. */
export function avaliarNoDaSimulacao(
  no: NoDoCenario,
  numero: number,
  escolha: LabEscolha | null
): { avaliacao: Json; consequencia: string } {
  if (escolha === null) {
    return {
      avaliacao: {
        numero,
        escolha: null,
        aderencia: 0,
        estilo: null,
        // Uma omissão conta zero nas skills que a situação punha em jogo.
        skills: [...no.skillsEmJogo],
        alerta: null,
        contribuicao: null,
        justificativa:
          "O tempo acabou antes da escolha, então a situação conta como sem resposta (aderência 0)."
      },
      consequencia:
        no.consequenciaOmissao ?? "Como ninguém decidiu a tempo, o problema seguiu sem resposta."
    };
  }
  const o = no.opcoes[escolha];
  return {
    avaliacao: {
      numero,
      escolha,
      aderencia: o.aderencia,
      estilo: o.estilo,
      skills: [...o.skills],
      alerta: o.linhaVermelha ? "vermelho" : null,
      contribuicao: null,
      justificativa: o.justificativa
    },
    consequencia: o.consequencia
  };
}

/**
 * O fechamento: o caminho percorrido e, das justificativas escritas à mão, a melhor e a pior
 * decisão. Não traz número nenhum (os números são do backend).
 */
export function resultadoDaSimulacao(
  cenario: CenarioDaBiblioteca,
  nos: readonly NoDoCenario[],
  escolhas: ReadonlyArray<LabEscolha | null>
): Json {
  const passos = nos.map((no, i) => {
    const escolha = escolhas[i] ?? null;
    const opcao = escolha ? no.opcoes[escolha] : null;
    return {
      numero: i + 1,
      resumo: opcao ? opcao.resumo : "não decidiu a tempo",
      aderencia: opcao ? opcao.aderencia : 0,
      justificativa: opcao
        ? opcao.justificativa
        : "A situação ficou sem decisão porque o tempo acabou."
    };
  });
  const melhor = passos.reduce((a, b) => (b.aderencia > a.aderencia ? b : a));
  const pior = passos.reduce((a, b) => (b.aderencia < a.aderencia ? b : a));
  const caminho = passos.map((p) => `${p.numero}) ${p.resumo}`).join("; ");

  return {
    resumo: `Simulação local, com conteúdo demonstrativo: ${cenario.titulo}. Seu caminho: ${caminho}. Os números e os alertas desta tela foram calculados de verdade a partir das suas escolhas.`,
    ponto_forte:
      melhor.aderencia >= 70
        ? `Decisão ${melhor.numero}: ${melhor.justificativa}`
        : "Nenhuma decisão ficou muito próxima do esperado. Releia o mapa de decisões e compare com as alternativas.",
    ponto_desenvolvimento:
      pior.aderencia < 100
        ? `Decisão ${pior.numero}: ${pior.justificativa}`
        : "Todas as decisões ficaram alinhadas ao esperado nesta simulação.",
    sugestoes: [
      "Percorra o mapa de decisões e compare cada escolha com as alternativas que você não escolheu.",
      "Este conteúdo é demonstrativo e depende de validação técnica e pedagógica. Na prática valem a norma brasileira, o procedimento do Grand Massif e a recomendação do fabricante."
    ],
    contribuicoes: []
  };
}
