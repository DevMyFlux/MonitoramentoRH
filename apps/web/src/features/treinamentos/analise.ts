// Análise interativa de causa e consequência — funções puras. O grafo vem das REGRAS do cenário
// (devolvidas pelo servidor depois de concluir) e o estado de cada nó vem do DESFECHO (o retrato
// gravado ou um "e se?" calculado pelo servidor em /simular). A tela não calcula desfecho: só
// desenha o que o motor do servidor respondeu.
import type {
  TreinoCausa,
  TreinoCondicao,
  TreinoDesfecho,
  TreinoNivel,
  TreinoRegra
} from "@my-flux/shared";
import type { ResultadoDaTentativa } from "./api";

export type TipoDoNo = "decisao" | "acontecimento" | "resultado";
export type NoDoGrafo = { id: string; tipo: TipoDoNo; rotulo: string };
/** Uma aresta: a condição `is` sobre o nó `de` participa da regra do nó `para`. */
export type ArestaDoGrafo = { chave: string; de: string; para: string; is: boolean };
export type Grafo = { nos: NoDoGrafo[]; arestas: ArestaDoGrafo[] };

/** Ids de nó únicos entre colunas: decisões, acontecimentos e resultados podem repetir nomes. */
export const idDoNo = (tipo: TipoDoNo, id: string) => `${tipo}:${id}`;
const origemDa = (c: TreinoCondicao) =>
  "decision" in c ? idDoNo("decisao", c.decision) : idDoNo("acontecimento", c.event);
const condicoes = (regra: TreinoRegra) => [...(regra.all ?? []), ...(regra.any ?? [])];

export function montarGrafo(resultado: Pick<ResultadoDaTentativa, "decisoes" | "regras">): Grafo {
  const nos: NoDoGrafo[] = [
    ...resultado.decisoes.map((d) => ({
      id: idDoNo("decisao", d.id),
      tipo: "decisao" as const,
      rotulo: d.label
    })),
    ...resultado.regras.events.map((e) => ({
      id: idDoNo("acontecimento", e.id),
      tipo: "acontecimento" as const,
      rotulo: e.label
    })),
    ...resultado.regras.outcomes.map((o) => ({
      id: idDoNo("resultado", o.id),
      tipo: "resultado" as const,
      rotulo: o.label
    }))
  ];
  const arestas = new Map<string, ArestaDoGrafo>();
  const ligar = (para: string, lista: TreinoCondicao[]) => {
    for (const c of lista) {
      const de = origemDa(c);
      const chave = `${de}->${para}`;
      if (!arestas.has(chave)) arestas.set(chave, { chave, de, para, is: c.is });
    }
  };
  for (const e of resultado.regras.events) ligar(idDoNo("acontecimento", e.id), condicoes(e.when));
  for (const o of resultado.regras.outcomes)
    ligar(idDoNo("resultado", o.id), [...condicoes(o.when.ok), ...condicoes(o.when.warn)]);
  return { nos, arestas: [...arestas.values()] };
}

/** O estado de cada nó para um desfecho e um conjunto de decisões. */
export type EstadoDosNos = Record<
  string,
  | { tipo: "decisao"; cumpriu: boolean }
  | { tipo: "acontecimento"; aconteceu: boolean; tom: "good" | "bad" }
  | { tipo: "resultado"; nivel: TreinoNivel; texto: string }
>;

export function estadoDosNos(
  decisoes: Record<string, boolean>,
  desfecho: TreinoDesfecho
): EstadoDosNos {
  const estado: EstadoDosNos = {};
  for (const [id, cumpriu] of Object.entries(decisoes))
    estado[idDoNo("decisao", id)] = { tipo: "decisao", cumpriu };
  for (const e of desfecho.events)
    estado[idDoNo("acontecimento", e.id)] = {
      tipo: "acontecimento",
      aconteceu: e.aconteceu,
      tom: e.tone
    };
  for (const o of desfecho.outcomes)
    estado[idDoNo("resultado", o.id)] = { tipo: "resultado", nivel: o.nivel, texto: o.texto };
  return estado;
}

/** As causas registradas pelo motor para um nó (acontecimento ou resultado). */
function causasDe(desfecho: TreinoDesfecho, no: string): TreinoCausa[] {
  const [tipo, id] = no.split(":") as [TipoDoNo, string];
  if (tipo === "acontecimento") return desfecho.events.find((e) => e.id === id)?.causas ?? [];
  if (tipo === "resultado") return desfecho.outcomes.find((o) => o.id === id)?.causas ?? [];
  return [];
}

/**
 * A cadeia de causas de um nó: os nós e as arestas que o explicam, voltando até as decisões.
 * Para um resultado ou acontecimento, segue as condições que o motor apontou como decisivas.
 */
export function cadeiaDeCausas(
  desfecho: TreinoDesfecho,
  alvo: string
): { nos: Set<string>; arestas: Set<string> } {
  const nos = new Set<string>([alvo]);
  const arestas = new Set<string>();
  const fila = [alvo];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const causa of causasDe(desfecho, atual)) {
      const origem = origemDa(causa);
      arestas.add(`${origem}->${atual}`);
      if (!nos.has(origem)) {
        nos.add(origem);
        fila.push(origem);
      }
    }
  }
  return { nos, arestas };
}

/** As arestas "ativas": as condições que o motor apontou como decisivas em algum nó. */
export function arestasAtivas(desfecho: TreinoDesfecho): Set<string> {
  const ativas = new Set<string>();
  for (const e of desfecho.events)
    for (const c of e.causas) ativas.add(`${origemDa(c)}->${idDoNo("acontecimento", e.id)}`);
  for (const o of desfecho.outcomes)
    for (const c of o.causas) ativas.add(`${origemDa(c)}->${idDoNo("resultado", o.id)}`);
  return ativas;
}

/**
 * O que de fato aconteceu numa condição, em português: "“Medir a ausência de tensão” não foi
 * cumprida". Usa o valor REAL (a condição pode ter falhado: aí o real é o contrário do exigido).
 */
export function textoDaCausa(causa: TreinoCausa, rotulos: Record<string, string>): string {
  const real = causa.valeu ? causa.is : !causa.is;
  if ("decision" in causa) {
    const nome = rotulos[idDoNo("decisao", causa.decision)] ?? causa.decision;
    return real ? `“${nome}” foi cumprida` : `“${nome}” não foi cumprida`;
  }
  const nome = rotulos[idDoNo("acontecimento", causa.event)] ?? causa.event;
  return real ? `“${nome}” aconteceu` : `“${nome}” não aconteceu`;
}

/** As explicações de um nó, em texto: as causas que o motor apontou. */
export function explicacaoDe(
  desfecho: TreinoDesfecho,
  no: string,
  rotulos: Record<string, string>
): string[] {
  return causasDe(desfecho, no).map((c) => textoDaCausa(c, rotulos));
}

/** Os resultados que mudaram de nível em relação ao desfecho original. */
export function resultadosQueMudaram(original: TreinoDesfecho, atual: TreinoDesfecho): Set<string> {
  const antes = new Map(original.outcomes.map((o) => [o.id, o.nivel]));
  return new Set(atual.outcomes.filter((o) => antes.get(o.id) !== o.nivel).map((o) => o.id));
}
