// Leadership Lab — os dados do mapa de decisões (React Flow) a partir do resultado do teste.
//
// Puro. Só usa o que o resultado já mostra ao participante: o texto de cada situação, as três
// opções, a escolha, a aderência e a consequência. O caminho percorrido é o das situações como
// foram vividas; as opções não escolhidas aparecem como alternativas, sem consequência (o servidor
// não revela o que teria acontecido).
import type { LabSituacaoDoResultado } from "@my-flux/shared";
import type { Edge, Node } from "@xyflow/react";

export const LARGURA_DO_NO = 248;
const ESPACO_ENTRE_COLUNAS = 56;
const ALTURA_DA_SITUACAO = 96;
const ESPACO_VERTICAL = 22;

export type DadosDaSituacao = {
  numero: number;
  resumo: string;
  marco: boolean;
  aderencia: number;
  semResposta: boolean;
};
export type DadosDaOpcao = {
  letra: string;
  texto: string;
  escolhida: boolean;
  consequencia: string | null;
};
export type DadosDaOmissao = { consequencia: string | null };

export type NoDoMapa =
  | Node<DadosDaSituacao & Record<string, unknown>, "situacao">
  | Node<DadosDaOpcao & Record<string, unknown>, "opcao">
  | Node<DadosDaOmissao & Record<string, unknown>, "omissao">;

export const idDaSituacao = (numero: number) => `s${numero}`;
export const idDaOpcao = (numero: number, letra: string) => `s${numero}-${letra}`;
export const idDaOmissao = (numero: number) => `s${numero}-omissao`;

/** Corta o texto da situação para caber no cartão, sem cortar no meio de uma palavra. */
export function resumir(texto: string, limite = 96): string {
  const limpo = texto
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), 40))}…`;
}

/** Uma estimativa da altura do cartão (o React Flow mede depois; isto só evita sobreposição). */
function alturaEstimada(texto: string, consequencia: string | null): number {
  const linhas = (t: string) => Math.max(1, Math.ceil(t.length / 34));
  return 40 + linhas(texto) * 18 + (consequencia ? 18 + linhas(consequencia) * 17 : 0);
}

export function montarMapaDeDecisoes(situacoes: readonly LabSituacaoDoResultado[]): {
  nodes: NoDoMapa[];
  edges: Edge[];
} {
  const ordenadas = [...situacoes].sort((a, b) => a.numero - b.numero);
  const nodes: NoDoMapa[] = [];
  const edges: Edge[] = [];

  ordenadas.forEach((s, coluna) => {
    const x = coluna * (LARGURA_DO_NO + ESPACO_ENTRE_COLUNAS);
    const semResposta = s.escolha === null || s.tempoEsgotado;
    nodes.push({
      id: idDaSituacao(s.numero),
      type: "situacao",
      position: { x, y: 0 },
      initialWidth: LARGURA_DO_NO,
      initialHeight: ALTURA_DA_SITUACAO,
      draggable: false,
      data: {
        numero: s.numero,
        resumo: resumir(s.texto),
        marco: s.marco,
        aderencia: s.aderencia,
        semResposta
      }
    });

    let y = ALTURA_DA_SITUACAO + 44;
    for (const opcao of s.opcoes) {
      const escolhida = s.escolha === opcao.id && !semResposta;
      const consequencia = escolhida ? s.consequencia : null;
      const id = idDaOpcao(s.numero, opcao.id);
      const altura = alturaEstimada(opcao.texto, consequencia);
      nodes.push({
        id,
        type: "opcao",
        position: { x, y },
        initialWidth: LARGURA_DO_NO,
        initialHeight: altura,
        draggable: false,
        data: { letra: opcao.id, texto: opcao.texto, escolhida, consequencia }
      });
      edges.push({
        id: `e-${idDaSituacao(s.numero)}-${id}`,
        source: idDaSituacao(s.numero),
        target: id,
        sourceHandle: "baixo",
        targetHandle: "cima",
        type: "smoothstep",
        className: escolhida ? "caminho-escolhido" : "alternativa",
        style: escolhida
          ? { stroke: "#047857", strokeWidth: 3 }
          : { stroke: "#cbd5e1", strokeWidth: 1.5, strokeDasharray: "5 4" }
      });
      y += altura + ESPACO_VERTICAL;
    }

    if (semResposta) {
      nodes.push({
        id: idDaOmissao(s.numero),
        type: "omissao",
        position: { x, y },
        initialWidth: LARGURA_DO_NO,
        initialHeight: alturaEstimada("Tempo esgotado", s.consequencia),
        draggable: false,
        data: { consequencia: s.consequencia }
      });
      edges.push({
        id: `e-${idDaSituacao(s.numero)}-omissao`,
        source: idDaSituacao(s.numero),
        target: idDaOmissao(s.numero),
        sourceHandle: "baixo",
        targetHandle: "cima",
        type: "smoothstep",
        style: { stroke: "#b45309", strokeWidth: 3 }
      });
    }

    // O caminho segue da escolha (ou da omissão) para a situação seguinte.
    const proxima = ordenadas[coluna + 1];
    if (proxima) {
      const origem = semResposta ? idDaOmissao(s.numero) : idDaOpcao(s.numero, s.escolha ?? "A");
      edges.push({
        id: `e-${origem}-${idDaSituacao(proxima.numero)}`,
        source: origem,
        target: idDaSituacao(proxima.numero),
        sourceHandle: "direita",
        targetHandle: "esquerda",
        type: "smoothstep",
        animated: true,
        className: "caminho-escolhido",
        style: { stroke: semResposta ? "#b45309" : "#047857", strokeWidth: 3 }
      });
    }
  });

  return { nodes, edges };
}

/** O mesmo caminho em texto, para leitor de tela e para quem não usa o mapa. */
export function descreverCaminho(situacoes: readonly LabSituacaoDoResultado[]): string[] {
  return [...situacoes]
    .sort((a, b) => a.numero - b.numero)
    .map((s) => {
      if (s.escolha === null || s.tempoEsgotado)
        return `Situação ${s.numero}: sem resposta, o tempo acabou.`;
      const opcao = s.opcoes.find((o) => o.id === s.escolha);
      return `Situação ${s.numero}: escolheu a opção ${s.escolha}${opcao ? `, ${opcao.texto}` : ""}.`;
    });
}
